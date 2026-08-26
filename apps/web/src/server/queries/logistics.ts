import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { isProductCoveredByAddress, type CoverageAddress, type CoverageRule } from "@/lib/delivery-coverage";
import { resolveRouteDistanceKm } from "@/server/queries/distance";

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

/** CoverageAddress plus coordinates (SPEC.md §10, LOG-03) — the coordinates are only ever used to
 * resolve "raio" rules' route distance, never for cep/município matching, so every existing
 * caller that only reads cep/cidade/estado keeps working unchanged. */
export type BuyerCoverageAddress = CoverageAddress & { latitude: number | null; longitude: number | null };

/** The address used to decide catalog visibility for a comprador: their default delivery
 * address, falling back to any address on file, or null (visitors, or compradores who never set
 * one up) — coverage rules never restrict anything when the address is unknown. */
export async function getBuyerCoverageAddress(user: AuthenticatedUser | null): Promise<BuyerCoverageAddress | null> {
  if (!user || user.role !== "comprador" || !user.company) return null;

  const defaultAddress = await db.query.addresses.findFirst({
    where: and(eq(schema.addresses.companyId, user.company.id), eq(schema.addresses.isDefault, true)),
  });
  const address =
    defaultAddress ??
    (await db.query.addresses.findFirst({ where: eq(schema.addresses.companyId, user.company.id) }));
  if (!address) return null;

  return { cep: address.cep, cidade: address.cidade, estado: address.estado, latitude: address.latitude, longitude: address.longitude };
}

async function getActiveCoverageRules(): Promise<CoverageRule[]> {
  const areas = await db.query.deliveryCoverageAreas.findMany({
    where: eq(schema.deliveryCoverageAreas.active, true),
    with: { ceps: true, municipios: true },
  });
  return areas;
}

/** Resolves the route distance (SPEC.md §10, LOG-03) from each supplier's origin ("empresa"
 * address) to the buyer's address, for whichever suppliers actually have an active "raio" rule —
 * no point geocoding/routing for suppliers whose rules don't need distance at all. A supplier
 * without a geocoded origin, or a buyer address without coordinates, is simply absent from the
 * returned map — isProductCoveredByAddress already treats "no distance known" as "raio rule
 * doesn't apply" rather than guessing. Keyed by the *user* id (coverage rules' supplierId is
 * always a fornecedor user id) — one join through companies to reach the address, since
 * addresses key off companyId. */
async function getRaioDistancesBySupplier(rules: CoverageRule[], buyerAddress: BuyerCoverageAddress): Promise<Map<string, number>> {
  const distances = new Map<string, number>();
  if (buyerAddress.latitude === null || buyerAddress.longitude === null) return distances;

  const raioSupplierIds = [...new Set(rules.filter((r) => r.kind === "raio").map((r) => r.supplierId))];
  if (raioSupplierIds.length === 0) return distances;

  const companiesWithOrigin = await db.query.companies.findMany({
    where: inArray(schema.companies.userId, raioSupplierIds),
    columns: { userId: true },
    with: { addresses: { where: eq(schema.addresses.type, "empresa"), columns: { latitude: true, longitude: true } } },
  });

  await Promise.all(
    companiesWithOrigin.map(async (company) => {
      const origin = company.addresses[0];
      if (!origin || origin.latitude === null || origin.longitude === null) return;
      const distanceKm = await resolveRouteDistanceKm(
        { lat: origin.latitude, lng: origin.longitude },
        { lat: buyerAddress.latitude!, lng: buyerAddress.longitude! },
      );
      distances.set(company.userId, distanceKm);
    }),
  );
  return distances;
}

/**
 * Product ids that must be hidden from `address` (SPEC.md §10, LOG-01). Cheap no-op when no
 * supplier has configured any coverage rule (the common case): skips straight to an empty set
 * without touching the products table at all.
 */
export async function getBlockedProductIdsForAddress(address: BuyerCoverageAddress | null): Promise<Set<string>> {
  if (!address) return new Set();

  const rules = await getActiveCoverageRules();
  if (rules.length === 0) return new Set();

  const [supplierIds, distanceKmBySupplier] = await Promise.all([
    [...new Set(rules.map((r) => r.supplierId))],
    getRaioDistancesBySupplier(rules, address),
  ]);
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
      distanceKmBySupplier,
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
  address: BuyerCoverageAddress | null,
): Promise<boolean> {
  if (!address) return true;
  const rules = await db.query.deliveryCoverageAreas.findMany({
    where: and(eq(schema.deliveryCoverageAreas.active, true), eq(schema.deliveryCoverageAreas.supplierId, product.supplierId)),
    with: { ceps: true, municipios: true },
  });
  if (rules.length === 0) return true;

  const distanceKmBySupplier = await getRaioDistancesBySupplier(rules, address);
  return isProductCoveredByAddress(
    rules,
    { supplierId: product.supplierId, categoryId: product.categoryId, productId: product.id },
    address,
    distanceKmBySupplier,
  );
}
