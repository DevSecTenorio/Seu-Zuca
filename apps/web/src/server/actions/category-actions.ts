"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, and, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { categorySchema } from "@/lib/validation/catalog";
import { generateUniqueSlug } from "@/lib/slug";
import { logAudit } from "@/lib/audit";
import type { FormState } from "./form-state";

function revalidateCatalogSurfaces() {
  revalidatePath("/admin/categorias");
  revalidatePath("/");
  revalidatePath("/catalogo");
}

function parseCategoryForm(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId") ?? "",
    defaultUnitId: formData.get("defaultUnitId") ?? "",
    icon: formData.get("icon"),
    active: formData.get("active") === "on",
  });
}

export async function createCategoryAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireUser(["admin"]);
  const parsed = parseCategoryForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const slug = await generateUniqueSlug(data.name, async (candidate) => {
    const existing = await db.query.categories.findFirst({ where: eq(schema.categories.slug, candidate) });
    return !!existing;
  });

  const [category] = await db
    .insert(schema.categories)
    .values({
      name: data.name,
      slug,
      parentId: data.parentId || null,
      defaultUnitId: data.defaultUnitId || null,
      icon: data.icon,
      active: data.active,
    })
    .returning();

  await logAudit({
    actorId: admin.id,
    action: "category.create",
    entityType: "category",
    entityId: category.id,
    after: category,
  });

  revalidateCatalogSurfaces();
  return { status: "success", message: "Categoria criada." };
}

export async function updateCategoryAction(
  categoryId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireUser(["admin"]);
  const parsed = parseCategoryForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  if (data.parentId === categoryId) {
    return { status: "error", fieldErrors: { parentId: ["Uma categoria não pode ser pai dela mesma."] } };
  }

  const before = await db.query.categories.findFirst({ where: eq(schema.categories.id, categoryId) });
  if (!before) {
    return { status: "error", message: "Categoria não encontrada." };
  }

  const [after] = await db
    .update(schema.categories)
    .set({
      name: data.name,
      parentId: data.parentId || null,
      defaultUnitId: data.defaultUnitId || null,
      icon: data.icon,
      active: data.active,
    })
    .where(eq(schema.categories.id, categoryId))
    .returning();

  await logAudit({
    actorId: admin.id,
    action: "category.update",
    entityType: "category",
    entityId: categoryId,
    before,
    after,
  });

  revalidateCatalogSurfaces();
  return { status: "success", message: "Categoria atualizada." };
}

export async function toggleCategoryActiveAction(categoryId: string, nextActive: boolean) {
  const admin = await requireUser(["admin"]);
  const before = await db.query.categories.findFirst({ where: eq(schema.categories.id, categoryId) });
  if (!before) return;

  await db.update(schema.categories).set({ active: nextActive }).where(eq(schema.categories.id, categoryId));

  await logAudit({
    actorId: admin.id,
    action: nextActive ? "category.activate" : "category.deactivate",
    entityType: "category",
    entityId: categoryId,
    before,
    after: { ...before, active: nextActive },
  });

  revalidateCatalogSurfaces();
}

export async function deleteCategoryAction(categoryId: string) {
  const admin = await requireUser(["admin"]);

  const [hasProducts, hasChildren] = await Promise.all([
    db.query.products.findFirst({ where: eq(schema.products.categoryId, categoryId) }),
    db.query.categories.findFirst({ where: eq(schema.categories.parentId, categoryId) }),
  ]);
  if (hasProducts || hasChildren) {
    // Nothing we can surface to the user from a fire-and-forget form action here (no FormState) —
    // the row's "Excluir" button is only enabled when the page already knows there's nothing
    // blocking deletion (see admin/categorias/page.tsx), so reaching this branch is a race, not
    // the common path.
    return;
  }

  const before = await db.query.categories.findFirst({ where: eq(schema.categories.id, categoryId) });
  await db.delete(schema.categories).where(eq(schema.categories.id, categoryId));

  await logAudit({
    actorId: admin.id,
    action: "category.delete",
    entityType: "category",
    entityId: categoryId,
    before,
  });

  revalidateCatalogSurfaces();
}

// Used by the category form to populate the "categoria pai" select, excluding self on edit.
export async function listCategoryParentOptions(excludeId?: string) {
  return db.query.categories.findMany({
    where: excludeId ? ne(schema.categories.id, excludeId) : undefined,
    orderBy: (c, { asc }) => [asc(c.name)],
  });
}

export async function listActiveCategoriesForFilter() {
  return db.query.categories.findMany({
    where: and(eq(schema.categories.active, true)),
    orderBy: (c, { asc }) => [asc(c.name)],
  });
}

/** Top-level active categories, used by the header mega menu, footer and home category grid. */
export async function listTopLevelActiveCategories() {
  return db.query.categories.findMany({
    where: and(eq(schema.categories.active, true), isNull(schema.categories.parentId)),
    orderBy: (c, { asc }) => [asc(c.name)],
  });
}
