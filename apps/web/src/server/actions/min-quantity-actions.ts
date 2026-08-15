"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { logAudit } from "@/lib/audit";
import type { FormState } from "./form-state";

export async function upsertMinQuantityRuleAction(
  categoryId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireUser(["admin"]);

  const minQuantity = Number(formData.get("minQuantity"));
  const multiple = Number(formData.get("multiple"));
  if (!Number.isInteger(minQuantity) || minQuantity < 1) {
    return { status: "error", fieldErrors: { minQuantity: ["Informe um número inteiro maior que 0."] } };
  }
  if (!Number.isInteger(multiple) || multiple < 1) {
    return { status: "error", fieldErrors: { multiple: ["Informe um número inteiro maior que 0."] } };
  }

  const before = await db.query.minQuantityRules.findFirst({ where: eq(schema.minQuantityRules.categoryId, categoryId) });

  await db
    .insert(schema.minQuantityRules)
    .values({ categoryId, minQuantity, multiple })
    .onConflictDoUpdate({ target: schema.minQuantityRules.categoryId, set: { minQuantity, multiple } });

  await logAudit({
    actorId: admin.id,
    action: before ? "min_quantity_rule.update" : "min_quantity_rule.create",
    entityType: "min_quantity_rule",
    entityId: categoryId,
    before,
    after: { categoryId, minQuantity, multiple },
  });

  revalidatePath("/admin/qtd-minimas");
  return { status: "success", message: "Regra salva." };
}

export async function deleteMinQuantityRuleAction(categoryId: string) {
  const admin = await requireUser(["admin"]);
  const before = await db.query.minQuantityRules.findFirst({ where: eq(schema.minQuantityRules.categoryId, categoryId) });
  if (!before) return;

  await db.delete(schema.minQuantityRules).where(eq(schema.minQuantityRules.categoryId, categoryId));
  await logAudit({
    actorId: admin.id,
    action: "min_quantity_rule.delete",
    entityType: "min_quantity_rule",
    entityId: categoryId,
    before,
  });
  revalidatePath("/admin/qtd-minimas");
}
