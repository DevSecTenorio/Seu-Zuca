"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser, requireUser } from "@/lib/auth/require-user";
import { logAudit } from "@/lib/audit";
import type { FormState } from "./form-state";

export async function submitReviewAction(
  orderId: string,
  productId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const buyer = await requireApprovedUser(["comprador"]);

  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: "error", fieldErrors: { rating: ["Selecione uma nota de 1 a 5."] } };
  }

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId), with: { items: true } });
  if (!order || order.buyerId !== buyer.id) {
    return { status: "error", message: "Pedido não encontrado." };
  }
  if (order.status !== "entregue") {
    return { status: "error", message: "Só é possível avaliar produtos de pedidos entregues." };
  }
  if (!order.items.some((item) => item.productId === productId)) {
    return { status: "error", message: "Este produto não faz parte do pedido." };
  }

  const existing = await db.query.reviews.findFirst({
    where: and(eq(schema.reviews.orderId, orderId), eq(schema.reviews.productId, productId)),
  });
  if (existing) {
    return { status: "error", message: "Você já avaliou este produto neste pedido." };
  }

  const [review] = await db
    .insert(schema.reviews)
    .values({ productId, buyerId: buyer.id, orderId, rating, comment: comment || null, moderationStatus: "pendente" })
    .returning({ id: schema.reviews.id });

  await logAudit({ actorId: buyer.id, action: "review.create", entityType: "review", entityId: review.id, after: { rating, productId, orderId } });
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/admin/avaliacoes");
  return { status: "success", message: "Avaliação enviada para moderação." };
}

export async function approveReviewAction(reviewId: string) {
  const admin = await requireUser(["admin"]);
  const before = await db.query.reviews.findFirst({ where: eq(schema.reviews.id, reviewId), with: { product: true } });
  if (!before) return;

  await db.update(schema.reviews).set({ moderationStatus: "aprovado" }).where(eq(schema.reviews.id, reviewId));
  await logAudit({ actorId: admin.id, action: "review.approve", entityType: "review", entityId: reviewId, before });
  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/produto/${before.product.slug}`);
}

export async function rejectReviewAction(reviewId: string) {
  const admin = await requireUser(["admin"]);
  const before = await db.query.reviews.findFirst({ where: eq(schema.reviews.id, reviewId), with: { product: true } });
  if (!before) return;

  await db.update(schema.reviews).set({ moderationStatus: "rejeitado" }).where(eq(schema.reviews.id, reviewId));
  await logAudit({ actorId: admin.id, action: "review.reject", entityType: "review", entityId: reviewId, before });
  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/produto/${before.product.slug}`);
}
