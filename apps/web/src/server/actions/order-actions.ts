"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { canTransition, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import type { FormState } from "./form-state";

export async function applyOrderStatusTransition(orderId: string, to: OrderStatus, note: string, actorId: string | null) {
  const [order] = await db
    .update(schema.orders)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId))
    .returning({ id: schema.orders.id, buyerId: schema.orders.buyerId });
  await db.insert(schema.orderStatusEvents).values({ orderId, status: to, note, createdBy: actorId });
  await logAudit({ actorId, action: "order.status_change", entityType: "order", entityId: orderId, after: { status: to, note } });
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  revalidatePath("/fornecedor/painel");

  const buyer = await db.query.users.findFirst({ where: eq(schema.users.id, order.buyerId) });
  if (buyer) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await sendEmail({
      to: buyer.email,
      subject: `Pedido atualizado: ${ORDER_STATUS_LABELS[to]} — Seu Zuca`,
      html: `<p>O status do seu pedido mudou para <strong>${ORDER_STATUS_LABELS[to]}</strong>.</p>
             <p>${note}</p>
             <p><a href="${appUrl}/pedidos/${orderId}">Ver detalhes do pedido</a></p>`,
    });
  }
}

export async function buyerCancelOrderAction(orderId: string): Promise<FormState> {
  const buyer = await requireApprovedUser(["comprador"]);
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || order.buyerId !== buyer.id) return { status: "error", message: "Pedido não encontrado." };
  if (!canTransition(order.status, "cancelado", "comprador")) {
    return { status: "error", message: "Este pedido não pode mais ser cancelado." };
  }
  await applyOrderStatusTransition(orderId, "cancelado", "Cancelado pelo comprador.", buyer.id);
  return { status: "success", message: "Pedido cancelado." };
}

export async function buyerOpenDisputeAction(orderId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const buyer = await requireApprovedUser(["comprador"]);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { status: "error", fieldErrors: { reason: ["Descreva o problema."] } };

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || order.buyerId !== buyer.id) return { status: "error", message: "Pedido não encontrado." };
  if (!canTransition(order.status, "em_disputa", "comprador")) {
    return { status: "error", message: "Não é possível abrir uma disputa para este pedido." };
  }
  await applyOrderStatusTransition(orderId, "em_disputa", `Disputa aberta pelo comprador: ${reason}`, buyer.id);
  return { status: "success", message: "Disputa registrada. Nossa equipe vai analisar o pedido." };
}

export async function buyerConfirmDeliveryAction(orderId: string): Promise<FormState> {
  const buyer = await requireApprovedUser(["comprador"]);
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || order.buyerId !== buyer.id) return { status: "error", message: "Pedido não encontrado." };
  if (!canTransition(order.status, "entregue", "comprador")) {
    return { status: "error", message: "Este pedido ainda não pode ser confirmado como entregue." };
  }
  await applyOrderStatusTransition(orderId, "entregue", "Entrega confirmada pelo comprador.", buyer.id);
  return { status: "success", message: "Entrega confirmada." };
}

export async function supplierAdvanceOrderAction(orderId: string, target: "em_separacao" | "entregue"): Promise<FormState> {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || order.supplierId !== supplier.id) return { status: "error", message: "Pedido não encontrado." };
  if (!canTransition(order.status, target, "fornecedor")) {
    return { status: "error", message: "Transição de status inválida para este pedido." };
  }
  const notes: Record<string, string> = {
    em_separacao: "Pedido em separação.",
    entregue: "Entrega confirmada pelo fornecedor.",
  };
  await applyOrderStatusTransition(orderId, target, notes[target], supplier.id);
  return { status: "success" };
}

export async function supplierShipOrderAction(orderId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const trackingCode = String(formData.get("trackingCode") ?? "").trim();
  if (!trackingCode) return { status: "error", fieldErrors: { trackingCode: ["Informe o código de rastreio."] } };

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || order.supplierId !== supplier.id) return { status: "error", message: "Pedido não encontrado." };
  if (!canTransition(order.status, "enviado", "fornecedor")) {
    return { status: "error", message: "Este pedido não pode ser marcado como enviado agora." };
  }

  await db.update(schema.orders).set({ trackingCode, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
  await applyOrderStatusTransition(orderId, "enviado", `Enviado. Código de rastreio: ${trackingCode}`, supplier.id);
  return { status: "success", message: "Pedido marcado como enviado." };
}
