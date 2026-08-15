"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { logAudit } from "@/lib/audit";
import type { FormState } from "./form-state";

function revalidateProductSurfaces(slug?: string) {
  revalidatePath("/admin/produtos");
  revalidatePath("/catalogo");
  revalidatePath("/");
  if (slug) revalidatePath(`/produto/${slug}`);
}

export async function approveProductAction(productId: string) {
  const admin = await requireUser(["admin"]);
  const before = await db.query.products.findFirst({ where: eq(schema.products.id, productId) });
  if (!before) return;

  const [after] = await db
    .update(schema.products)
    .set({ moderationStatus: "ativo", rejectionReason: null })
    .where(eq(schema.products.id, productId))
    .returning();

  await logAudit({
    actorId: admin.id,
    action: "product.approve",
    entityType: "product",
    entityId: productId,
    before,
    after,
  });
  revalidateProductSurfaces(before.slug);
}

export async function rejectProductAction(
  productId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireUser(["admin"]);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return { status: "error", fieldErrors: { reason: ["Informe o motivo da rejeição."] } };
  }

  const before = await db.query.products.findFirst({ where: eq(schema.products.id, productId) });
  if (!before) return { status: "error", message: "Produto não encontrado." };

  const [after] = await db
    .update(schema.products)
    .set({ moderationStatus: "rejeitado", rejectionReason: reason })
    .where(eq(schema.products.id, productId))
    .returning();

  await logAudit({
    actorId: admin.id,
    action: "product.reject",
    entityType: "product",
    entityId: productId,
    before,
    after,
  });
  revalidateProductSurfaces(before.slug);
  return { status: "success", message: "Produto rejeitado." };
}

export async function deactivateProductAction(productId: string) {
  const admin = await requireUser(["admin"]);
  const before = await db.query.products.findFirst({ where: eq(schema.products.id, productId) });
  if (!before) return;

  const [after] = await db
    .update(schema.products)
    .set({ moderationStatus: "inativo" })
    .where(eq(schema.products.id, productId))
    .returning();

  await logAudit({
    actorId: admin.id,
    action: "product.deactivate",
    entityType: "product",
    entityId: productId,
    before,
    after,
  });
  revalidateProductSurfaces(before.slug);
}
