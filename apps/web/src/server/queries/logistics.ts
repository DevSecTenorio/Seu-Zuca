import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { isProductCoveredByAddress, type CoverageAddress, type CoverageRule } from "@/lib/delivery-coverage";

export async function getSupplierCoverageAreas(supplierId: string) {
  return db.query.deliveryCoverageAreas.findMany({
    where: eq(schema.deliveryCoverageAreas.supplierId, supplierId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
    with: {
      product: { columns: { id: true, name: true } },
      category: { columns: { id: true, name: true } },
      ceps: true,
      municipios: true,
    },
  });
}

/** The address used to decide catalog visibility for a comprador: their default delivery
 * address, falling back to any address on file, or null (visitors, or compradores who never set
 * one up) — coverage rules never restrict anything when the address is unknown. */
export async function getBuyerCoverageAddress(user: AuthenticatedUser | null): Promise<CoverageAddress | null> {
  if (!user || user.role !== "comprador" || !user.company) return null;

  const defaultAddress = await db.query.addresses.findFirst({
    where: and(eq(schema.addresses.companyId, user.company.id), eq(schema.addresses.isDefault, true)),
  });
  const address =
    defaultAddress ??
    (await db.query.addresses.findFirst({ where: eq(schema.addresses.companyId, user.company.id) }));
  if (!address) return null;

  return { cep: address.cep, cidade: address.cidade, estado: address.estado };
}

async function getActiveCoverageRules(): Promise<CoverageRule[]> {
  const areas = await db.query.deliveryCoverageAreas.findMany({
    where: eq(schema.deliveryCoverageAreas.active, true),
    with: { ceps: true, municipios: true },
  });
  return areas;
}

/**
 * Product ids that must be hidden from `address` (SPEC.md §10, LOG-01). Cheap no-op when no
 * supplier has configured any coverage rule (the common case): skips straight to an empty set
 * without touching the products table at all.
 */
export async function getBlockedProductIdsForAddress(address: CoverageAddress | null): Promise<Set<string>> {
  if (!address) return new Set();

  const rules = await getActiveCoverageRules();
  if (rules.length === 0) return new Set();

  const supplierIds = [...new Set(rules.map((r) => r.supplierId))];
  const candidates = await db
    .select({ id: schema.products.id, supplierId: schema.products.supplierId, categoryId: schema.products.categoryId })
    .from(schema.products)
    .where(inArray(schema.products.supplierId, supplierIds));

  const blocked = new Set<string>();
  for (const product of candidates) {
    const covered = isProductCoveredByAddress(
      rules,
      { supplierId: product.supplierId, categoryId: product.categoryId, productId: product.id },
      address,
    );
    if (!covered) blocked.add(product.id);
  }
  return blocked;
}

/** Same resolution as getBlockedProductIdsForAddress, for a single already-known product (used
 * at checkout, where re-fetching every supplier's rules to build a whole blocked-id set would be
 * wasteful for just one line item). */
export async function isProductCoveredForAddress(
  product: { supplierId: string; categoryId: string; id: string },
  address: CoverageAddress | null,
): Promise<boolean> {
  if (!address) return true;
  const rules = await db.query.deliveryCoverageAreas.findMany({
    where: and(eq(schema.deliveryCoverageAreas.active, true), eq(schema.deliveryCoverageAreas.supplierId, product.supplierId)),
    with: { ceps: true, municipios: true },
  });
  if (rules.length === 0) return true;
  return isProductCoveredByAddress(
    rules,
    { supplierId: product.supplierId, categoryId: product.categoryId, productId: product.id },
    address,
  );
}
