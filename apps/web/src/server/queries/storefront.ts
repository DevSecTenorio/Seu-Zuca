import "server-only";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewPrices, withPriceVisibility } from "@/lib/price-visibility";

/**
 * Public storefront surfaces must only ever show products that are both individually approved
 * AND belong to a supplier whose account is still approved (SPEC.md §4) — a product can stay
 * moderationStatus="ativo" while its supplier gets suspended later, so every public product query
 * filters through this id list rather than trusting moderationStatus alone.
 */
async function getApprovedSupplierIds(): Promise<string[]> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.role, "fornecedor"), eq(schema.users.status, "aprovado")));
  return rows.map((r) => r.id);
}

export async function getActiveBanners() {
  return db.query.banners.findMany({
    where: eq(schema.banners.active, true),
    orderBy: (b, { asc: a }) => [a(b.order)],
  });
}

export async function getFeaturedProducts(limit = 8) {
  const supplierIds = await getApprovedSupplierIds();
  if (supplierIds.length === 0) return [];
  const [products, user] = await Promise.all([
    db.query.products.findMany({
      where: and(eq(schema.products.moderationStatus, "ativo"), inArray(schema.products.supplierId, supplierIds)),
      orderBy: (p, { desc: d }) => [d(p.createdAt)],
      limit,
      with: {
        images: { orderBy: (i, { asc: a }) => [a(i.order)] },
        unit: true,
        category: true,
        supplier: { with: { company: true } },
      },
    }),
    getCurrentUser(),
  ]);
  const canView = canViewPrices(user);
  return products.map((p) => withPriceVisibility(p, canView));
}

export type CatalogSort = "recentes" | "preco-asc" | "preco-desc" | "mais-vendidos";

export type CatalogFilters = {
  categorySlug?: string;
  busca?: string;
  sort?: CatalogSort;
  page?: number;
  limit?: number;
};

export async function getCatalogProducts(filters: CatalogFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(48, Math.max(1, filters.limit ?? 12));

  const supplierIds = await getApprovedSupplierIds();
  if (supplierIds.length === 0) return { products: [], total: 0, page, limit, totalPages: 0 };

  const conditions = [
    eq(schema.products.moderationStatus, "ativo"),
    inArray(schema.products.supplierId, supplierIds),
  ];

  if (filters.categorySlug) {
    const category = await db.query.categories.findFirst({ where: eq(schema.categories.slug, filters.categorySlug) });
    if (!category) return { products: [], total: 0, page, limit, totalPages: 0 };
    conditions.push(eq(schema.products.categoryId, category.id));
  }
  if (filters.busca) {
    const term = `%${filters.busca}%`;
    const matchingCategoryIds = db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(ilike(schema.categories.name, term));
    conditions.push(
      or(
        ilike(schema.products.name, term),
        ilike(schema.products.description, term),
        inArray(schema.products.categoryId, matchingCategoryIds),
      )!,
    );
  }

  const where = and(...conditions);

  const orderBy = (() => {
    switch (filters.sort) {
      case "preco-asc":
        return [asc(schema.products.priceCents)];
      case "preco-desc":
        return [desc(schema.products.priceCents)];
      // "mais-vendidos" needs order history (Phase 4) to rank by real sales — until then it
      // falls back to newest-first rather than faking a ranking (SPEC backlog note on rankings).
      case "mais-vendidos":
      case "recentes":
      default:
        return [desc(schema.products.createdAt)];
    }
  })();

  const [products, totalRows, user] = await Promise.all([
    db.query.products.findMany({
      where,
      orderBy,
      limit,
      offset: (page - 1) * limit,
      with: {
        images: { orderBy: (i, { asc: a }) => [a(i.order)] },
        unit: true,
        category: true,
        supplier: { with: { company: true } },
      },
    }),
    db.select({ id: schema.products.id }).from(schema.products).where(where),
    getCurrentUser(),
  ]);

  const canView = canViewPrices(user);
  const total = totalRows.length;
  return {
    products: products.map((p) => withPriceVisibility(p, canView)),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getProductBySlug(slug: string) {
  const supplierIds = await getApprovedSupplierIds();
  if (supplierIds.length === 0) return null;

  const [product, user] = await Promise.all([
    db.query.products.findFirst({
      where: and(
        eq(schema.products.slug, slug),
        eq(schema.products.moderationStatus, "ativo"),
        inArray(schema.products.supplierId, supplierIds),
      ),
      with: {
        images: { orderBy: (i, { asc: a }) => [a(i.order)] },
        unit: true,
        category: { with: { minQuantityRule: true } },
        supplier: { with: { company: true } },
      },
    }),
    getCurrentUser(),
  ]);
  if (!product) return null;
  return withPriceVisibility(product, canViewPrices(user));
}

export async function getApprovedReviewsForProduct(productId: string) {
  const reviews = await db.query.reviews.findMany({
    where: and(eq(schema.reviews.productId, productId), eq(schema.reviews.moderationStatus, "aprovado")),
    orderBy: (r, { desc: d }) => [d(r.createdAt)],
    with: { buyer: { with: { company: true } } },
  });
  const average = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;
  return { reviews, average, count: reviews.length };
}

export async function getSupplierBySlug(slug: string) {
  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.slug, slug),
    with: { user: true },
  });
  if (!company || company.user.role !== "fornecedor" || company.user.status !== "aprovado") return null;

  const [products, user] = await Promise.all([
    db.query.products.findMany({
      where: and(eq(schema.products.supplierId, company.user.id), eq(schema.products.moderationStatus, "ativo")),
      orderBy: (p, { desc: d }) => [d(p.createdAt)],
      with: {
        images: { orderBy: (i, { asc: a }) => [a(i.order)] },
        unit: true,
        category: true,
      },
    }),
    getCurrentUser(),
  ]);
  const canView = canViewPrices(user);

  return { company, products: products.map((p) => withPriceVisibility(p, canView)) };
}

/** Product cards/detail switch copy at this stock level ("Últimas X unidades" vs "Em estoque"). */
export const LOW_STOCK_THRESHOLD = 10;
