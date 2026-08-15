import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchPayment, verifyWebhookSignature } from "@/lib/mercadopago";
import { applyOrderStatusTransition } from "@/server/actions/order-actions";

/**
 * Mercado Pago's asynchronous payment confirmation (SPEC.md §5). Always responds 200 unless the
 * request itself is malformed/unauthenticated — MP retries aggressively on non-2xx, and a
 * business-logic issue (unknown payment, already processed) isn't something retrying fixes.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { type?: string; data?: { id?: string } } | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const dataId = body.data?.id;
  const isPaymentEvent = body.type === "payment";
  if (!isPaymentEvent || !dataId) {
    return NextResponse.json({ received: true });
  }

  const signatureValid = verifyWebhookSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
  });
  if (!signatureValid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let mpPayment;
  try {
    mpPayment = await fetchPayment(dataId);
  } catch (error) {
    console.error("Falha ao buscar pagamento no Mercado Pago:", error);
    return NextResponse.json({ error: "failed to fetch payment" }, { status: 502 });
  }

  const checkoutGroupId = mpPayment.external_reference;
  if (!checkoutGroupId) return NextResponse.json({ received: true });

  const payment = await db.query.payments.findFirst({
    where: eq(schema.payments.checkoutGroupId, checkoutGroupId),
  });
  if (!payment) return NextResponse.json({ received: true });

  const nextStatus = mapMpStatus(mpPayment.status);

  await db
    .update(schema.payments)
    .set({
      status: nextStatus,
      mpPaymentId: String(mpPayment.id),
      webhookPayload: mpPayment as unknown as object,
      updatedAt: new Date(),
    })
    .where(eq(schema.payments.id, payment.id));

  if (nextStatus === "pago" && payment.status !== "pago") {
    const orders = await db.query.orders.findMany({ where: eq(schema.orders.checkoutGroupId, checkoutGroupId) });
    for (const order of orders) {
      if (order.status !== "aguardando_pagamento") continue;
      // Shared with the buyer/supplier-triggered transitions in order-actions.ts — also sends
      // the "confirmação de pedido" e-mail (SPEC.md's transactional-e-mail requirement).
      await applyOrderStatusTransition(order.id, "pago", "Pagamento confirmado via webhook do Mercado Pago.", null);
    }
  }

  return NextResponse.json({ received: true });
}

function mapMpStatus(mpStatus: string | undefined): "aguardando_pagamento" | "pago" | "falhou" | "estornado" {
  switch (mpStatus) {
    case "approved":
      return "pago";
    case "rejected":
    case "cancelled":
      return "falhou";
    case "refunded":
    case "charged_back":
      return "estornado";
    default:
      return "aguardando_pagamento";
  }
}
