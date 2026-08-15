"use server";

import { redirect } from "next/navigation";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { validateQuantity } from "@/lib/quantity-rules";
import { calculateShippingCents } from "@/lib/shipping";
import { calculateCommissionCents } from "@/lib/commission";
import { getCommissionPercent } from "@/lib/settings";
import { onlyDigits } from "@/lib/cnpj";
import {
  createBoletoPayment,
  createCardCheckoutPreference,
  createPixPayment,
  isMercadoPagoConfigured,
} from "@/lib/mercadopago";
import { logAudit } from "@/lib/audit";
import { getBuyableProduct, ruleFor } from "@/server/queries/cart";
import type { FormState } from "./form-state";

const PAYMENT_METHODS = ["pix", "boleto", "cartao"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

class InsufficientStockError extends Error {
  constructor(public productName: string) {
    super(`Insufficient stock for ${productName}`);
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
  }

  const commissionPercent = await getCommissionPercent();

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
    await db.transaction(async (tx) => {
      const supplierGroups = Array.from(bySupplier.entries()).map(([supplierId, items]) => {
        const subtotalCents = items.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);
        const shippingCents = calculateShippingCents(subtotalCents);
        const commissionCents = calculateCommissionCents(subtotalCents, commissionPercent);
        return { supplierId, items, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents, commissionCents };
      });
      grandTotalCents = supplierGroups.reduce((sum, g) => sum + g.totalCents, 0);

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
            totalCents: group.totalCents,
            commissionPercent: commissionPercent.toFixed(2),
            commissionCents: group.commissionCents,
          })
          .returning({ id: schema.orders.id });
        orderIds.push(order.id);

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
