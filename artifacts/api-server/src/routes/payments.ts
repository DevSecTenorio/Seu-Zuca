import { Router, type IRouter } from "express";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { db, paymentMethodsTable, ordersTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { authMiddleware, requireApprovedBuyer, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getMpClient(): MercadoPagoConfig | null {
  const token = process.env["MERCADO_PAGO_ACCESS_TOKEN"];
  if (!token) return null;
  return new MercadoPagoConfig({ accessToken: token });
}

function getBaseUrl(req: import("express").Request): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]}`;
  if (process.env["VERCEL_URL"]) return `https://${process.env["VERCEL_URL"]}`;
  return `${req.protocol}://${req.get("host")}`;
}

// ── POST /payments/create ─────────────────────────────────────────────────────
router.post("/payments/create", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const { orderIds, metodo } = req.body as { orderIds: number[]; metodo: string };

  if (!orderIds?.length || !metodo) {
    res.status(400).json({ message: "orderIds e metodo são obrigatórios" });
    return;
  }
  if (!["pix", "boleto", "cartao"].includes(metodo)) {
    res.status(400).json({ message: "Método inválido. Use pix, boleto ou cartao" });
    return;
  }

  const orders = await db.select().from(ordersTable).where(inArray(ordersTable.id, orderIds));
  if (!orders.length || orders.some(o => o.buyerId !== req.userId)) {
    res.status(403).json({ message: "Pedidos não encontrados ou sem permissão" });
    return;
  }

  const total = orders.reduce((s, o) => s + o.total, 0);
  const primaryOrderId = orders[0].id;
  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));

  const existing = await db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.orderId, primaryOrderId));
  if (existing.length > 0) {
    res.json(existing[0]);
    return;
  }

  const client = getMpClient();

  if (!client) {
    logger.warn("MERCADO_PAGO_ACCESS_TOKEN não configurado — retornando dados simulados");
    const mockData = buildMockPayment(metodo, primaryOrderId, total);
    const [saved] = await db.insert(paymentMethodsTable).values({
      orderId: primaryOrderId,
      metodo,
      status: "pending",
      externalId: mockData.externalId,
      qrCode: mockData.qrCode,
      qrCodeBase64: mockData.qrCodeBase64,
      ticketUrl: mockData.ticketUrl,
      codigoBarras: mockData.codigoBarras,
      checkoutUrl: mockData.checkoutUrl,
      valor: total,
      metadata: JSON.stringify({ orderIds }),
      expiresAt: mockData.expiresAt ? new Date(mockData.expiresAt) : null,
    }).returning();
    res.json({ ...saved, ...mockData, mock: true });
    return;
  }

  try {
    if (metodo === "pix") {
      const payment = new Payment(client);
      const result = await payment.create({
        body: {
          transaction_amount: Math.round(total * 100) / 100,
          description: `Pedido(s) #${orderIds.join(", ")} — Seu Zuca`,
          payment_method_id: "pix",
          payer: {
            email: buyer.email,
            first_name: buyer.nome?.split(" ")[0] || "Comprador",
            last_name: buyer.nome?.split(" ").slice(1).join(" ") || "B2B",
            identification: { type: "CNPJ", number: buyer.cnpj?.replace(/\D/g, "") || "" },
          },
          notification_url: `${getBaseUrl(req)}/api/payments/webhook`,
          metadata: { order_ids: orderIds },
        },
      });

      const pixData = result.point_of_interaction?.transaction_data;
      const expiresAt = result.date_of_expiration ? new Date(result.date_of_expiration) : null;

      const [saved] = await db.insert(paymentMethodsTable).values({
        orderId: primaryOrderId,
        metodo: "pix",
        status: "pending",
        externalId: String(result.id),
        qrCode: pixData?.qr_code || null,
        qrCodeBase64: pixData?.qr_code_base64 || null,
        valor: total,
        metadata: JSON.stringify({ orderIds }),
        expiresAt,
      }).returning();

      res.json(saved);

    } else if (metodo === "boleto") {
      const payment = new Payment(client);
      const result = await payment.create({
        body: {
          transaction_amount: Math.round(total * 100) / 100,
          description: `Pedido(s) #${orderIds.join(", ")} — Seu Zuca`,
          payment_method_id: "bolbradesco",
          payer: {
            email: buyer.email,
            first_name: buyer.nome?.split(" ")[0] || "Comprador",
            last_name: buyer.nome?.split(" ").slice(1).join(" ") || "B2B",
            identification: { type: "CNPJ", number: buyer.cnpj?.replace(/\D/g, "") || "" },
          },
          notification_url: `${getBaseUrl(req)}/api/payments/webhook`,
          metadata: { order_ids: orderIds },
        },
      });

      const barcode = (result as { barcode?: { content?: string } }).barcode?.content || null;
      const ticketUrl = result.transaction_details?.external_resource_url || null;
      const expiresAt = result.date_of_expiration ? new Date(result.date_of_expiration) : null;

      const [saved] = await db.insert(paymentMethodsTable).values({
        orderId: primaryOrderId,
        metodo: "boleto",
        status: "pending",
        externalId: String(result.id),
        ticketUrl,
        codigoBarras: barcode,
        valor: total,
        metadata: JSON.stringify({ orderIds }),
        expiresAt,
      }).returning();

      res.json(saved);

    } else {
      const preference = new Preference(client);
      const result = await preference.create({
        body: {
          items: [{
            id: `orders-${orderIds.join("-")}`,
            title: `Pedido(s) #${orderIds.join(", ")} — Seu Zuca`,
            quantity: 1,
            unit_price: Math.round(total * 100) / 100,
            currency_id: "BRL",
          }],
          payer: { email: buyer.email },
          back_urls: {
            success: `${getBaseUrl(req)}/pagamento/sucesso`,
            failure: `${getBaseUrl(req)}/pagamento/falha`,
            pending: `${getBaseUrl(req)}/pagamento/pendente`,
          },
          auto_return: "approved",
          notification_url: `${getBaseUrl(req)}/api/payments/webhook`,
          metadata: { order_ids: orderIds },
          external_reference: orderIds.join(","),
        },
      });

      const [saved] = await db.insert(paymentMethodsTable).values({
        orderId: primaryOrderId,
        metodo: "cartao",
        status: "pending",
        externalId: result.id || null,
        checkoutUrl: result.init_point || null,
        valor: total,
        metadata: JSON.stringify({ orderIds }),
      }).returning();

      res.json(saved);
    }
  } catch (err) {
    logger.error({ err }, "Erro ao criar pagamento no Mercado Pago");
    res.status(502).json({ message: "Erro ao processar pagamento com Mercado Pago", detail: String(err) });
  }
});

// ── GET /payments/status/:orderId ─────────────────────────────────────────────
router.get("/payments/status/:orderId", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId as string, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
  if (order.buyerId !== req.userId && req.userRole !== "admin") {
    res.status(403).json({ message: "Acesso negado" }); return;
  }

  const [payment] = await db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.orderId, orderId));
  res.json({ pago: order.pago, payment: payment || null });
});

// ── POST /payments/webhook ────────────────────────────────────────────────────
router.post("/payments/webhook", async (req, res): Promise<void> => {
  const { type, action, data } = req.body as {
    type?: string;
    action?: string;
    data?: { id?: string | number };
  };

  logger.info({ type, action, data }, "MP webhook received");

  const paymentId = data?.id ? String(data.id) : null;
  const isPaymentEvent = type === "payment" || action === "payment.updated" || action === "payment.created";

  if (!isPaymentEvent || !paymentId) {
    res.sendStatus(200);
    return;
  }

  const client = getMpClient();
  if (!client) {
    res.sendStatus(200);
    return;
  }

  try {
    const mpPayment = await new Payment(client).get({ id: paymentId });
    const status = mpPayment.status;
    logger.info({ paymentId, status }, "MP payment status fetched");

    const [record] = await db.select().from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.externalId, paymentId));

    if (!record) {
      res.sendStatus(200);
      return;
    }

    await db.update(paymentMethodsTable)
      .set({
        status: status || "unknown",
        paidAt: status === "approved" ? new Date() : null,
      })
      .where(eq(paymentMethodsTable.id, record.id));

    if (status === "approved") {
      const orderIds: number[] = record.metadata
        ? (JSON.parse(record.metadata) as { orderIds?: number[] }).orderIds || [record.orderId]
        : [record.orderId];

      await db.update(ordersTable)
        .set({ pago: true, status: "confirmado" })
        .where(inArray(ordersTable.id, orderIds));

      logger.info({ orderIds }, "Orders marked as paid after MP webhook");
    }
  } catch (err) {
    logger.error({ err, paymentId }, "Erro ao processar webhook do Mercado Pago");
  }

  res.sendStatus(200);
});

// ─────────────────────────────────────────────────────────────────────────────
function buildMockPayment(metodo: string, orderId: number, total: number) {
  const mockPixCode = "00020126580014BR.GOV.BCB.PIX0136a6b5d9b3-1234-4567-abcd-ef0123456789520400005303986540" + total.toFixed(2) + "5802BR5924Seu Zuca Materiais LTDA6009SAO PAULO62290525seuzuca" + orderId + "63041234";
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  if (metodo === "pix") {
    return {
      externalId: `mock-pix-${orderId}`,
      qrCode: mockPixCode,
      qrCodeBase64: null,
      ticketUrl: null,
      codigoBarras: null,
      checkoutUrl: null,
      expiresAt: expires,
    };
  } else if (metodo === "boleto") {
    return {
      externalId: `mock-boleto-${orderId}`,
      qrCode: null,
      qrCodeBase64: null,
      ticketUrl: `https://boleto.mercadopago.com.br/sandbox/boletos/mock-${orderId}`,
      codigoBarras: `34191.09008 04308.570001 07000.620003 1 99990000${String(Math.round(total * 100)).padStart(10, "0")}`,
      checkoutUrl: null,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
  } else {
    return {
      externalId: `mock-pref-${orderId}`,
      qrCode: null,
      qrCodeBase64: null,
      ticketUrl: null,
      codigoBarras: null,
      checkoutUrl: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=mock-${orderId}`,
      expiresAt: null,
    };
  }
}

export default router;
