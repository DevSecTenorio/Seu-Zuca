import { describe, expect, it } from "vitest";
import { PRODUCTS, SUPPLIERS } from "./seed-data";

// Regression guard for the bug reported in the UX review: every product page showed "Elétrica
// Total" as the supplier regardless of category, because the demo catalog assigned an
// electrical/hydraulic distributor to unrelated products (paint, masonry blocks, etc.). The real
// query (getProductBySlug -> product.supplier.company) was never buggy — the seed data was just
// unrealistic. This test keeps each supplier's product mix inside its declared ramoAtividade so
// that regression can't silently come back.
const EXPECTED_CATEGORIES_BY_SUPPLIER: Record<string, string[]> = {
  "Construsul Materiais": ["argamassa", "acabamento", "madeira", "alvenaria"],
  "Ferragens Silva": ["estrutura", "ferramentas"],
  "Elétrica Total": ["instalacoes", "hidraulica", "eletrica"],
};

describe("seed data integrity", () => {
  it("every product.supplierIndex points at a real entry in SUPPLIERS", () => {
    for (const product of PRODUCTS) {
      expect(product.supplierIndex).toBeGreaterThanOrEqual(0);
      expect(product.supplierIndex).toBeLessThan(SUPPLIERS.length);
    }
  });

  it("no two suppliers share a CNPJ or e-mail (would collide with @unique constraints)", () => {
    expect(new Set(SUPPLIERS.map((s) => s.cnpj)).size).toBe(SUPPLIERS.length);
    expect(new Set(SUPPLIERS.map((s) => s.email)).size).toBe(SUPPLIERS.length);
  });

  it("no product SKU is duplicated", () => {
    expect(new Set(PRODUCTS.map((p) => p.sku)).size).toBe(PRODUCTS.length);
  });

  it("each supplier's assigned products stay within its declared ramoAtividade", () => {
    for (const product of PRODUCTS) {
      const supplier = SUPPLIERS[product.supplierIndex];
      const allowedCategories = EXPECTED_CATEGORIES_BY_SUPPLIER[supplier.nomeFantasia];
      expect(
        allowedCategories,
        `${supplier.nomeFantasia} has no entry in EXPECTED_CATEGORIES_BY_SUPPLIER`,
      ).toBeDefined();
      expect(
        allowedCategories,
        `${product.name} (${product.categorySlug}) is assigned to ${supplier.nomeFantasia}, whose ramoAtividade is "${supplier.ramoAtividade}" — looks like a wrong/placeholder supplier assignment`,
      ).toContain(product.categorySlug);
    }
  });

  it("catalog isn't accidentally funneled through a single supplier", () => {
    const productsPerSupplier = new Map<number, number>();
    for (const product of PRODUCTS) {
      productsPerSupplier.set(product.supplierIndex, (productsPerSupplier.get(product.supplierIndex) ?? 0) + 1);
    }
    expect(productsPerSupplier.size).toBe(SUPPLIERS.length);
    for (const count of productsPerSupplier.values()) {
      expect(count).toBeLessThan(PRODUCTS.length);
    }
  });
});
