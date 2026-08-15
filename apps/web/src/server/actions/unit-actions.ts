"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { unitSchema } from "@/lib/validation/catalog";
import { logAudit } from "@/lib/audit";
import type { FormState } from "./form-state";

function parseUnitForm(formData: FormData) {
  return unitSchema.safeParse({
    name: formData.get("name"),
    abbreviation: formData.get("abbreviation"),
  });
}

export async function createUnitAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireUser(["admin"]);
  const parsed = parseUnitForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.query.units.findFirst({ where: eq(schema.units.name, parsed.data.name) });
  if (existing) {
    return { status: "error", fieldErrors: { name: ["Já existe uma unidade com esse nome."] } };
  }

  const [unit] = await db.insert(schema.units).values(parsed.data).returning();
  await logAudit({ actorId: admin.id, action: "unit.create", entityType: "unit", entityId: unit.id, after: unit });
  revalidatePath("/admin/unidades");
  return { status: "success", message: "Unidade criada." };
}

export async function updateUnitAction(
  unitId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireUser(["admin"]);
  const parsed = parseUnitForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const before = await db.query.units.findFirst({ where: eq(schema.units.id, unitId) });
  if (!before) return { status: "error", message: "Unidade não encontrada." };

  const [after] = await db.update(schema.units).set(parsed.data).where(eq(schema.units.id, unitId)).returning();
  await logAudit({ actorId: admin.id, action: "unit.update", entityType: "unit", entityId: unitId, before, after });
  revalidatePath("/admin/unidades");
  return { status: "success", message: "Unidade atualizada." };
}

export async function deleteUnitAction(unitId: string) {
  const admin = await requireUser(["admin"]);

  const [usedByProducts, usedByCategories] = await Promise.all([
    db.query.products.findFirst({ where: eq(schema.products.unitId, unitId) }),
    db.query.categories.findFirst({ where: eq(schema.categories.defaultUnitId, unitId) }),
  ]);
  if (usedByProducts || usedByCategories) return;

  const before = await db.query.units.findFirst({ where: eq(schema.units.id, unitId) });
  await db.delete(schema.units).where(eq(schema.units.id, unitId));
  await logAudit({ actorId: admin.id, action: "unit.delete", entityType: "unit", entityId: unitId, before });
  revalidatePath("/admin/unidades");
}
