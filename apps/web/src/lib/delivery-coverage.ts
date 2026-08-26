/**
 * Pure delivery-coverage resolution (SPEC.md §10, LOG-01). No DB/network access here so the
 * business rule is unit-testable in isolation — callers (storefront queries, checkout) fetch the
 * rules and the buyer's address and hand them to isProductCoveredByAddress.
 */

export type CoverageAddress = {
  cep: string;
  cidade: string;
  estado: string;
};

export type CoverageCepRange = { cepStart: string; cepEnd: string };
export type CoverageMunicipio = { cidade: string; estado: string };

export type CoverageRule = {
  id: string;
  supplierId: string;
  scope: "fornecedor" | "produto" | "categoria";
  productId: string | null;
  categoryId: string | null;
  kind: "cep" | "municipio" | "raio";
  mode: "cobertura" | "exclusao";
  radiusKm: number | null;
  ceps: CoverageCepRange[];
  municipios: CoverageMunicipio[];
};

export type CoverageProduct = {
  supplierId: string;
  categoryId: string;
  productId: string;
};

/** CEPs compare as plain 8-digit integers — "01310-100" and "01310100" must match the same way. */
function normalizeCep(cep: string): number {
  const digits = cep.replace(/\D/g, "").padEnd(8, "0").slice(0, 8);
  return parseInt(digits, 10);
}

function ruleMatchesAddress(rule: CoverageRule, address: CoverageAddress): boolean {
  if (rule.kind === "cep") {
    const cepNum = normalizeCep(address.cep);
    return rule.ceps.some((r) => cepNum >= normalizeCep(r.cepStart) && cepNum <= normalizeCep(r.cepEnd));
  }
  if (rule.kind === "municipio") {
    const cidade = address.cidade.trim().toLowerCase();
    const estado = address.estado.trim().toUpperCase();
    return rule.municipios.some((m) => m.cidade.trim().toLowerCase() === cidade && m.estado.trim().toUpperCase() === estado);
  }
  // kind === "raio": isProductCoveredByAddress filters these out before calling this function
  // (see there for why) — unreachable today, kept so this stays correct once LOG-03 adds real
  // distance matching and stops filtering "raio" rules out.
  return false;
}

/**
 * Whether `product` can be delivered to `address`, given every active coverage rule in the
 * system (the caller filters to the relevant supplier's rules is not required — this function
 * only looks at rules for product.supplierId).
 *
 * Resolution order (SPEC.md §10, LOG-01):
 * 1. No coverage rules at all for this supplier → covers everywhere (safe default, so suppliers
 *    who never configure this feature are unaffected).
 * 2. The most specific scope that has any rule wins *entirely* — product-level rules override
 *    category-level, which overrides the supplier-wide default. They are not merged/added.
 * 3. Within the winning scope, "cobertura" rules define what's included (no "cobertura" rule at
 *    all at that scope means "covers everywhere" at that scope); "exclusao" rules subtract from
 *    that.
 * 4. Supplier-wide "exclusao" rules always apply on top, even when a product/category scope
 *    matched — an explicit exclusion wins "mesmo dentro de uma cobertura mais ampla" (§10).
 *
 * A "raio" rule that can't be evaluated yet (see ruleMatchesAddress) never excludes anyone by
 * itself — it just doesn't contribute until LOG-03 lands, rather than silently hiding a
 * supplier's whole catalog because geocoding isn't wired up yet.
 */
export function isProductCoveredByAddress(
  rules: CoverageRule[],
  product: CoverageProduct,
  address: CoverageAddress | null,
): boolean {
  if (!address) return true;

  // "raio" rules can't be evaluated without geocoded coordinates yet (LOG-03) — drop them
  // entirely rather than have an unmatchable "cobertura" rule wrongly restrict everyone, or an
  // unmatchable "exclusao" rule silently fail to exclude anyone once it's actually wired up.
  const supplierRules = rules.filter((r) => r.supplierId === product.supplierId && r.kind !== "raio");
  if (supplierRules.length === 0) return true;

  const productRules = supplierRules.filter((r) => r.scope === "produto" && r.productId === product.productId);
  const categoryRules = supplierRules.filter((r) => r.scope === "categoria" && r.categoryId === product.categoryId);
  const supplierWideRules = supplierRules.filter((r) => r.scope === "fornecedor");

  const scoped = productRules.length > 0 ? productRules : categoryRules.length > 0 ? categoryRules : supplierWideRules;

  const includeRules = scoped.filter((r) => r.mode === "cobertura");
  const excludeRules = scoped.filter((r) => r.mode === "exclusao");
  const alwaysExcludeRules = supplierWideRules.filter((r) => r.mode === "exclusao");

  const isIncluded = includeRules.length === 0 || includeRules.some((r) => ruleMatchesAddress(r, address));
  const isExcluded =
    excludeRules.some((r) => ruleMatchesAddress(r, address)) || alwaysExcludeRules.some((r) => ruleMatchesAddress(r, address));

  return isIncluded && !isExcluded;
}
