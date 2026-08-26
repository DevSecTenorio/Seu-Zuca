"use server";

import { redirect } from "next/navigation";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { validateQuantity } from "@/lib/quantity-rules";
import { calculateCommissionCents, commissionBaseCents } from "@/lib/commission";
import { getCommissionBase, getCommissionPercent } from "@/lib/settings";
import { onlyDigits } from "@/lib/cnpj";
import { FREIGHT_SURCHARGE_TYPES, type FreightSurchargeType } from "@/lib/freight";
import {
  createBoletoPayment,
  createCardCheckoutPreference,
  createPixPayment,
  isMercadoPagoConfigured,
} from "@/lib/mercadopago";
import { logAudit } from "@/lib/audit";
import { generatePickupCode } from "@/lib/pickup-code";
import { getBuyableProduct, ruleFor } from "@/server/queries/cart";
import { isProductCoveredForAddress } from "@/server/queries/logistics";
import { quoteSupplierFreight, resolveSupplierDistanceKm } from "@/server/queries/freight";
import type { FormState } from "./form-state";

function parseSelectedSurcharges(formData: FormData, supplierId: string): FreightSurchargeType[] {
  const raw = String(formData.get(`surcharges_${supplierId}`) ?? "");
  const requested = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return requested.filter((s): s is FreightSurchargeType => (FREIGHT_SURCHARGE_TYPES as readonly string[]).includes(s));
}

const DELIVERY_MODALITIES = ["entrega", "retirada", "transportadora"] as const;
type DeliveryModality = (typeof DELIVERY_MODALITIES)[number];

function parseModality(formData: FormData, supplierId: string): DeliveryModality {
  const raw = String(formData.get(`modality_${supplierId}`) ?? "");
  return (DELIVERY_MODALITIES as readonly string[]).includes(raw) ? (raw as DeliveryModality) : "entrega";
}

const PAYMENT_METHODS = ["pix", "boleto", "cartao"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

class InsufficientStockError extends Error {
  constructor(public productName: string) {
    super(`Insufficient stock for ${productName}`);
  }
}

class InvalidPickupLocationError extends Error {
  constructor() {
    super("Invalid or inactive pickup location");
  }
}

export async function createCheckoutAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const buyer = await requireApprovedUser(["comprador"]);
  if (!buyer.company) {
    return { status: "error", message: "Conta sem empresa vinculada." };
  }

  const addressId = String(formData.get("addressId") ?? "");
  const method = String(formData.get("method") ?? "");
  if (!addressId) {
    return { status: "error", message: "Selecione um endereço de entrega." };
  }
  if (!PAYMENT_METHODS.includes(method as PaymentMethod)) {
    return { status: "error", message: "Selecione uma forma de pagamento." };
  }

  const address = await db.query.addresses.findFirst({ where: eq(schema.addresses.id, addressId) });
  if (!address || address.companyId !== buyer.company.id) {
    return { status: "error", message: "Endereço inválido." };
  }

  const cart = await db.query.carts.findFirst({
    where: eq(schema.carts.buyerId, buyer.id),
    with: {
      items: {
        with: {
          product: { with: { category: { with: { minQuantityRule: true } }, unit: true, supplier: true } },
        },
      },
    },
  });
  if (!cart || cart.items.length === 0) {
    return { status: "error", message: "Seu carrinho está vazio." };
  }

  // Re-validate every line against current stock/moderation/quantity rules — the cart may be
  // stale (added minutes or days ago), and this is the last checkpoint before money changes hands.
  for (const item of cart.items) {
    const product = await getBuyableProduct(item.productId);
    if (!product) {
      return { status: "error", message: `"${item.product.name}" não está mais disponível. Remova-o do carrinho.` };
    }
    const validation = validateQuantity(item.quantity, ruleFor(product));
    if (!validation.valid) {
      return { status: "error", message: `"${product.name}": ${validation.reason}` };
    }
    if (item.quantity > product.stock) {
      return { status: "error", message: `"${product.name}": apenas ${product.stock} unidades em estoque.` };
    }
    const covered = await isProductCoveredForAddress(
      { supplierId: product.supplierId, categoryId: product.categoryId, id: product.id },
      { cep: address.cep, cidade: address.cidade, estado: address.estado, latitude: address.latitude, longitude: address.longitude },
    );
    if (!covered) {
      return { status: "error", message: `"${product.name}" não é entregue no endereço selecionado.` };
    }
  }

  const [commissionPercent, commissionBase] = await Promise.all([getCommissionPercent(), getCommissionBase()]);

  const bySupplier = new Map<string, typeof cart.items>();
  for (const item of cart.items) {
    const list = bySupplier.get(item.product.supplierId) ?? [];
    list.push(item);
    bySupplier.set(item.product.supplierId, list);
  }

  let checkoutGroupId = "";
  let grandTotalCents = 0;
  const orderIds: string[] = [];

  try {
    const destination = address.latitude !== null && address.longitude !== null ? { lat: address.latitude, lng: address.longitude } : null;

    const supplierGroups = await Promise.all(
      Array.from(bySupplier.entries()).map(async ([supplierId, items]) => {
        const subtotalCents = items.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);
        const modality = parseModality(formData, supplierId);

        let shippingCents = 0;
        let shippingBreakdown: { label: string; valueCents: number }[];
        let pickupLocationSnapshot: Record<string, unknown> | null = null;

        if (modality === "retirada") {
          // SPEC.md §10, LOG-05: the buyer collects in person — never charged for freight. The
          // chosen location's details are frozen onto the order (same reasoning as
          // productNameSnapshot) so a supplier editing/deleting the pickup_locations row later
          // never changes what an already-placed order promised the buyer.
          const pickupLocationId = String(formData.get(`pickupLocationId_${supplierId}`) ?? "");
          const location = await db.query.pickupLocations.findFirst({ where: eq(schema.pickupLocations.id, pickupLocationId) });
          if (!location || location.supplierId !== supplierId || !location.active) {
            throw new InvalidPickupLocationError();
          }
          pickupLocationSnapshot = {
            label: location.label,
            cep: location.cep,
            logradouro: location.logradouro,
            numero: location.numero,
            complemento: location.complemento,
            bairro: location.bairro,
            cidade: location.cidade,
            estado: location.estado,
            horarioFuncionamento: location.horarioFuncionamento,
            prazoDisponibilizacaoDias: location.prazoDisponibilizacaoDias,
            documentoExigido: location.documentoExigido,
          };
          shippingBreakdown = [{ label: "Retirada — sem frete", valueCents: 0 }];
        } else if (modality === "transportadora") {
          shippingBreakdown = [{ label: "Transportadora contratada — sem frete cobrado na plataforma", valueCents: 0 }];
        } else {
          const selectedSurcharges = parseSelectedSurcharges(formData, supplierId);
          const distanceKm = await resolveSupplierDistanceKm(supplierId, destination);
          const freight = await quoteSupplierFreight(
            supplierId,
            items.map((i) => ({
              weightGrams: i.product.weightGrams,
              lengthCm: i.product.lengthCm,
              widthCm: i.product.widthCm,
              heightCm: i.product.heightCm,
              quantity: i.quantity,
            })),
            subtotalCents,
            selectedSurcharges,
            distanceKm,
          );
          shippingCents = freight.totalCents;
          shippingBreakdown = freight.lines;
        }

        const commissionCents = calculateCommissionCents(commissionBaseCents(subtotalCents, shippingCents, commissionBase), commissionPercent);
        return {
          supplierId,
          items,
          subtotalCents,
          shippingCents,
          shippingBreakdown,
          deliveryModality: modality,
          pickupLocationSnapshot,
          totalCents: subtotalCents + shippingCents,
          commissionCents,
        };
      }),
    );
    grandTotalCents = supplierGroups.reduce((sum, g) => sum + g.totalCents, 0);

    await db.transaction(async (tx) => {

      const [checkoutGroup] = await tx
        .insert(schema.checkoutGroups)
        .values({ buyerId: buyer.id, deliveryAddressId: addressId, totalCents: grandTotalCents })
        .returning({ id: schema.checkoutGroups.id });
      checkoutGroupId = checkoutGroup.id;

      for (const group of supplierGroups) {
        const [order] = await tx
          .insert(schema.orders)
          .values({
            checkoutGroupId,
            buyerId: buyer.id,
            supplierId: group.supplierId,
            status: "aguardando_pagamento",
            subtotalCents: group.subtotalCents,
            shippingCents: group.shippingCents,
            shippingBreakdown: group.shippingBreakdown,
            deliveryModality: group.deliveryModality,
            pickupLocationSnapshot: group.pickupLocationSnapshot,
            totalCents: group.totalCents,
            commissionPercent: commissionPercent.toFixed(2),
            commissionCents: group.commissionCents,
          })
          .returning({ id: schema.orders.id });
        orderIds.push(order.id);

        if (group.deliveryModality === "retirada") {
          await tx.insert(schema.pickupCodes).values({ orderId: order.id, code: generatePickupCode() });
        }

        await tx.insert(schema.orderItems).values(
          group.items.map((item) => ({
            orderId: order.id,
            productId: item.productId,
            productNameSnapshot: item.product.name,
            unitPriceCents: item.product.priceCents,
            quantity: item.quantity,
            totalCents: item.product.priceCents * item.quantity,
          })),
        );

        await tx.insert(schema.orderStatusEvents).values({
          orderId: order.id,
          status: "aguardando_pagamento",
          note: "Pedido criado no checkout.",
          createdBy: null,
        });

        for (const item of group.items) {
          // Atomic, conditional decrement (not "current stock minus quantity" computed in JS
          // before the transaction) — under concurrent checkouts for the same product, the
          // WHERE clause guarantees this only succeeds while enough stock actually remains, and
          // the empty `returning()` below signals the race so the whole checkout rolls back
          // instead of silently overselling.
          const [updated] = await tx
            .update(schema.products)
            .set({ stock: sql`${schema.products.stock} - ${item.quantity}` })
            .where(and(eq(schema.products.id, item.productId), gte(schema.products.stock, item.quantity)))
            .returning({ id: schema.products.id });
          if (!updated) {
            throw new InsufficientStockError(item.product.name);
          }
        }
      }

      await tx.insert(schema.payments).values({
        checkoutGroupId,
        method: method as PaymentMethod,
        status: "aguardando_pagamento",
      });

      await tx.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cart.id));
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return {
        status: "error",
        message: `"${error.productName}" acabou de ficar sem estoque suficiente. Ajuste a quantidade no carrinho e tente novamente.`,
      };
    }
    if (error instanceof InvalidPickupLocationError) {
      return { status: "error", message: "Selecione um local de retirada válido para o fornecedor escolhido." };
    }
    return {
      status: "error",
      message: "Não foi possível criar o pedido. Tente novamente em instantes.",
    };
  }

  await logAudit({
    actorId: buyer.id,
    action: "checkout.create",
    entityType: "checkout_group",
    entityId: checkoutGroupId,
    after: { orderIds, grandTotalCents, method },
  });

  if (!isMercadoPagoConfigured()) {
    redirect(`/pagamento?checkout=${checkoutGroupId}`);
  }

  const description = `Pedido Seu Zuca — ${orderIds.length} pedido${orderIds.length > 1 ? "s" : ""}`;
  const cnpj = onlyDigits(buyer.company.cnpj);
  let cardInitPoint: string | null = null;

  try {
    if (method === "pix") {
      const result = await createPixPayment({
        checkoutGroupId,
        amountCents: grandTotalCents,
        description,
        payerEmail: buyer.email,
        payerCnpj: cnpj,
      });
      await db
        .update(schema.payments)
        .set({ mpPaymentId: result.mpPaymentId, webhookPayload: result.raw as object })
        .where(eq(schema.payments.checkoutGroupId, checkoutGroupId));
    } else if (method === "boleto") {
      const result = await createBoletoPayment({
        checkoutGroupId,
        amountCents: grandTotalCents,
        description,
        payerEmail: buyer.email,
        payerCnpj: cnpj,
      });
      await db
        .update(schema.payments)
        .set({ mpPaymentId: result.mpPaymentId, webhookPayload: result.raw as object })
        .where(eq(schema.payments.checkoutGroupId, checkoutGroupId));
    } else {
      const result = await createCardCheckoutPreference({
        checkoutGroupId,
        amountCents: grandTotalCents,
        description,
        payerEmail: buyer.email,
      });
      await db
        .update(schema.payments)
        .set({ mpPreferenceId: result.mpPreferenceId, webhookPayload: result.raw as object })
        .where(eq(schema.payments.checkoutGroupId, checkoutGroupId));
      cardInitPoint = result.initPoint;
    }
  } catch (error) {
    console.error("Falha ao criar pagamento no Mercado Pago:", error);
    // Order already exists (aguardando_pagamento); the buyer lands on /pagamento and can retry —
    // no need to fail the whole checkout just because the payment provider call errored.
  }

  // redirect() throws internally — deliberately called outside the try/catch above so that
  // throw is never mistaken for (and swallowed as) a Mercado Pago API error.
  if (cardInitPoint) redirect(cardInitPoint);
  redirect(`/pagamento?checkout=${checkoutGroupId}`);
}
