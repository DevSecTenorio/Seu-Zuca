import { describe, expect, it } from "vitest";
import { isProductCoveredByAddress, type CoverageRule } from "./delivery-coverage";

const SUPPLIER = "supplier-1";
const OTHER_SUPPLIER = "supplier-2";
const PRODUCT = { supplierId: SUPPLIER, categoryId: "cat-1", productId: "prod-1" };

const SP_CAPITAL = { cep: "01310-100", cidade: "São Paulo", estado: "SP" };
const INTERIOR = { cep: "13560-000", cidade: "São Carlos", estado: "SP" };
const RIO = { cep: "20040-020", cidade: "Rio de Janeiro", estado: "RJ" };

function rule(overrides: Partial<CoverageRule>): CoverageRule {
  return {
    id: "rule-1",
    supplierId: SUPPLIER,
    scope: "fornecedor",
    productId: null,
    categoryId: null,
    kind: "cep",
    mode: "cobertura",
    radiusKm: null,
    ceps: [],
    municipios: [],
    ...overrides,
  };
}

describe("isProductCoveredByAddress", () => {
  it("covers everywhere when the supplier has no rules at all", () => {
    expect(isProductCoveredByAddress([], PRODUCT, SP_CAPITAL)).toBe(true);
  });

  it("never restricts when there is no address (visitor with no known address)", () => {
    const rules = [rule({ kind: "cep", ceps: [{ cepStart: "01000-000", cepEnd: "01999-999" }] })];
    expect(isProductCoveredByAddress(rules, PRODUCT, null)).toBe(true);
  });

  it("covers an address inside a CEP range and rejects one outside it", () => {
    const rules = [rule({ kind: "cep", ceps: [{ cepStart: "01000-000", cepEnd: "01999-999" }] })];
    expect(isProductCoveredByAddress(rules, PRODUCT, SP_CAPITAL)).toBe(true);
    expect(isProductCoveredByAddress(rules, PRODUCT, RIO)).toBe(false);
  });

  it("matches by município (cidade+estado), independent of CEP", () => {
    const rules = [rule({ kind: "municipio", municipios: [{ cidade: "São Carlos", estado: "SP" }] })];
    expect(isProductCoveredByAddress(rules, PRODUCT, INTERIOR)).toBe(true);
    expect(isProductCoveredByAddress(rules, PRODUCT, SP_CAPITAL)).toBe(false);
  });

  it("município match is case/whitespace-insensitive", () => {
    const rules = [rule({ kind: "municipio", municipios: [{ cidade: "  são carlos  ", estado: "sp" }] })];
    expect(isProductCoveredByAddress(rules, PRODUCT, INTERIOR)).toBe(true);
  });

  it("only restricts rules belonging to the product's own supplier", () => {
    const rules = [rule({ supplierId: OTHER_SUPPLIER, kind: "cep", ceps: [{ cepStart: "99999-000", cepEnd: "99999-999" }] })];
    expect(isProductCoveredByAddress(rules, PRODUCT, SP_CAPITAL)).toBe(true);
  });

  it("an exclusion-only rule covers everywhere except the excluded area", () => {
    const rules = [rule({ mode: "exclusao", kind: "municipio", municipios: [{ cidade: "Rio de Janeiro", estado: "RJ" }] })];
    expect(isProductCoveredByAddress(rules, PRODUCT, SP_CAPITAL)).toBe(true);
    expect(isProductCoveredByAddress(rules, PRODUCT, RIO)).toBe(false);
  });

  it("product-level exception fully replaces the supplier-wide default for that product", () => {
    const supplierWide = rule({ scope: "fornecedor", kind: "cep", ceps: [{ cepStart: "00000-000", cepEnd: "09999-999" }] });
    const productException = rule({
      id: "rule-2",
      scope: "produto",
      productId: PRODUCT.productId,
      kind: "municipio",
      municipios: [{ cidade: "Rio de Janeiro", estado: "RJ" }],
    });
    const rules = [supplierWide, productException];
    // Supplier-wide would cover SP_CAPITAL and reject RIO; the product exception flips that
    // entirely for this one product instead of adding to it.
    expect(isProductCoveredByAddress(rules, PRODUCT, SP_CAPITAL)).toBe(false);
    expect(isProductCoveredByAddress(rules, PRODUCT, RIO)).toBe(true);
  });

  it("category-level exception applies when there is no product-level exception", () => {
    const supplierWide = rule({ scope: "fornecedor", kind: "cep", ceps: [{ cepStart: "00000-000", cepEnd: "09999-999" }] });
    const categoryException = rule({
      id: "rule-2",
      scope: "categoria",
      categoryId: PRODUCT.categoryId,
      kind: "municipio",
      municipios: [{ cidade: "Rio de Janeiro", estado: "RJ" }],
    });
    const rules = [supplierWide, categoryException];
    expect(isProductCoveredByAddress(rules, PRODUCT, RIO)).toBe(true);
    expect(isProductCoveredByAddress(rules, PRODUCT, SP_CAPITAL)).toBe(false);
  });

  it("a product-level exception wins over a category-level exception", () => {
    const categoryRule = rule({
      scope: "categoria",
      categoryId: PRODUCT.categoryId,
      kind: "municipio",
      municipios: [{ cidade: "Rio de Janeiro", estado: "RJ" }],
    });
    const productRule = rule({
      id: "rule-2",
      scope: "produto",
      productId: PRODUCT.productId,
      kind: "municipio",
      municipios: [{ cidade: "São Paulo", estado: "SP" }],
    });
    const rules = [categoryRule, productRule];
    expect(isProductCoveredByAddress(rules, PRODUCT, SP_CAPITAL)).toBe(true);
    expect(isProductCoveredByAddress(rules, PRODUCT, RIO)).toBe(false);
  });

  it("a supplier-wide exclusion applies even when a product-level rule includes the address", () => {
    const productInclude = rule({
      scope: "produto",
      productId: PRODUCT.productId,
      kind: "municipio",
      municipios: [{ cidade: "Rio de Janeiro", estado: "RJ" }],
    });
    const supplierExclude = rule({
      id: "rule-2",
      scope: "fornecedor",
      mode: "exclusao",
      kind: "municipio",
      municipios: [{ cidade: "Rio de Janeiro", estado: "RJ" }],
    });
    const rules = [productInclude, supplierExclude];
    expect(isProductCoveredByAddress(rules, PRODUCT, RIO)).toBe(false);
  });

  it("a raio rule never restricts yet — real distance needs geocoding (LOG-03)", () => {
    const rules = [rule({ kind: "raio", radiusKm: 50 })];
    expect(isProductCoveredByAddress(rules, PRODUCT, SP_CAPITAL)).toBe(true);
  });
});
