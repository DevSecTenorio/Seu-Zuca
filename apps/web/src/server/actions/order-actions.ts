"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { canTransition, type OrderStatus } from "@/lib/order-status";
import { logAudit } from "@/lib/audit";
import type { FormState } from "./form-state";

async function applyTransition(orderId: string, to: OrderStatus, note: string, actorId: string) {
  await db.update(schema.orders).set({ status: to, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
  await db.insert(schema.orderStatusEvents).values({ orderId, status: to, note, createdBy: actorId });
  await logAudit({ actorId, action: "order.status_change", entityType: "order", entityId: orderId, after: { status: to, note } });
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  revalidatePath("/fornecedor/painel");
}

export async function buyerCancelOrderAction(orderId: string): Promise<FormState> {
  const buyer = await requireApprovedUser(["comprador"]);
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || order.buyerId !== buyer.id) return { status: "error", message: "Pedido não encontrado." };
  if (!canTransition(order.status, "cancelado", "comprador")) {
    return { status: "error", message: "Este pedido não pode mais ser cancelado." };
  }
  await applyTransition(orderId, "cancelado", "Cancelado pelo comprador.", buyer.id);
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
  await applyTransition(orderId, "em_disputa", `Disputa aberta pelo comprador: ${reason}`, buyer.id);
  return { status: "success", message: "Disputa registrada. Nossa equipe vai analisar o pedido." };
}

export async function buyerConfirmDeliveryAction(orderId: string): Promise<FormState> {
  const buyer = await requireApprovedUser(["comprador"]);
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || order.buyerId !== buyer.id) return { status: "error", message: "Pedido não encontrado." };
  if (!canTransition(order.status, "entregue", "comprador")) {
    return { status: "error", message: "Este pedido ainda não pode ser confirmado como entregue." };
  }
  await applyTransition(orderId, "entregue", "Entrega confirmada pelo comprador.", buyer.id);
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
  await applyTransition(orderId, target, notes[target], supplier.id);
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
  await applyTransition(orderId, "enviado", `Enviado. Código de rastreio: ${trackingCode}`, supplier.id);
  return { status: "success", message: "Pedido marcado como enviado." };
}
