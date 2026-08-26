import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { deliveryCoverageKindEnum, deliveryCoverageModeEnum, deliveryCoverageScopeEnum } from "./enums";
import { users } from "./users";
import { products, categories } from "./catalog";

/**
 * One coverage rule for a supplier. `scope` decides what it applies to: the supplier's default
 * (productId/categoryId null), an exception for one product, or an exception for a whole
 * category. When resolving whether an address is covered, the most specific applicable scope
 * with mode="cobertura" wins over the supplier default entirely (SPEC.md §10, LOG-01) — see
 * src/lib/delivery-coverage.ts for the actual resolution logic.
 */
export const deliveryCoverageAreas = pgTable(
  "delivery_coverage_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: deliveryCoverageScopeEnum("scope").notNull().default("fornecedor"),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    kind: deliveryCoverageKindEnum("kind").notNull(),
    mode: deliveryCoverageModeEnum("mode").notNull().default("cobertura"),
    // Only meaningful when kind="raio". Real distance matching needs geocoded coordinates
    // (SPEC.md §10, LOG-03) — until an address has lat/lng, radius rules are not enforced.
    radiusKm: integer("radius_km"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("delivery_coverage_areas_supplier_idx").on(table.supplierId),
    index("delivery_coverage_areas_product_idx").on(table.productId),
    index("delivery_coverage_areas_category_idx").on(table.categoryId),
  ],
);

/** CEP ranges for a kind="cep" coverage area. A single CEP is stored as cepStart = cepEnd. One
 * coverage area can hold thousands of these rows (an imported CEP mesh, LOG-01). */
export const deliveryCoverageCeps = pgTable(
  "delivery_coverage_ceps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coverageAreaId: uuid("coverage_area_id")
      .notNull()
      .references(() => deliveryCoverageAreas.id, { onDelete: "cascade" }),
    cepStart: text("cep_start").notNull(),
    cepEnd: text("cep_end").notNull(),
  },
  (table) => [index("delivery_coverage_ceps_area_idx").on(table.coverageAreaId)],
);

/** Municípios for a kind="municipio" coverage area. Matched by cidade+estado against the buyer's
 * address — see the note in src/lib/delivery-coverage.ts about why this isn't matched by IBGE
 * code alone. ibgeCode is stored when known, for display/import purposes only. */
export const deliveryCoverageMunicipios = pgTable(
  "delivery_coverage_municipios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coverageAreaId: uuid("coverage_area_id")
      .notNull()
      .references(() => deliveryCoverageAreas.id, { onDelete: "cascade" }),
    cidade: text("cidade").notNull(),
    estado: text("estado").notNull(),
    ibgeCode: text("ibge_code"),
  },
  (table) => [index("delivery_coverage_municipios_area_idx").on(table.coverageAreaId)],
);

export const deliveryCoverageAreasRelations = relations(deliveryCoverageAreas, ({ one, many }) => ({
  supplier: one(users, {
    fields: [deliveryCoverageAreas.supplierId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [deliveryCoverageAreas.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [deliveryCoverageAreas.categoryId],
    references: [categories.id],
  }),
  ceps: many(deliveryCoverageCeps),
  municipios: many(deliveryCoverageMunicipios),
}));

export const deliveryCoverageCepsRelations = relations(deliveryCoverageCeps, ({ one }) => ({
  coverageArea: one(deliveryCoverageAreas, {
    fields: [deliveryCoverageCeps.coverageAreaId],
    references: [deliveryCoverageAreas.id],
  }),
}));

export const deliveryCoverageMunicipiosRelations = relations(deliveryCoverageMunicipios, ({ one }) => ({
  coverageArea: one(deliveryCoverageAreas, {
    fields: [deliveryCoverageMunicipios.coverageAreaId],
    references: [deliveryCoverageAreas.id],
  }),
}));

export type DeliveryCoverageArea = typeof deliveryCoverageAreas.$inferSelect;
export type DeliveryCoverageCep = typeof deliveryCoverageCeps.$inferSelect;
export type DeliveryCoverageMunicipio = typeof deliveryCoverageMunicipios.$inferSelect;
