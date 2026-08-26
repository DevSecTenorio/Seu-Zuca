import { relations } from "drizzle-orm";
import { boolean, index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import {
  deliveryCoverageKindEnum,
  deliveryCoverageModeEnum,
  deliveryCoverageScopeEnum,
  freightChargeTypeEnum,
  freightSurchargeTypeEnum,
  routeDistanceSourceEnum,
} from "./enums";
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

/**
 * One freight configuration per supplier (SPEC.md §10, LOG-02). `chargeType` decides how
 * `freightRanges.valueCents` is interpreted (flat amount, R$/km, R$/kg, or R$/km×kg) — see
 * src/lib/freight.ts for the actual calculation. `cubicFactorKgPerM3` is the supplier's cubage
 * factor: chargeable weight is the greater of real weight and volume(m³) × this factor.
 * `minFreightCents` is a floor applied after ranges/rate are computed. Free-shipping is
 * independently conditional on a minimum subtotal and/or a maximum chargeable weight — either
 * condition, when configured, grants free shipping on its own (SPEC.md §10).
 */
export const freightRules = pgTable("freight_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  chargeType: freightChargeTypeEnum("charge_type").notNull().default("fixo"),
  cubicFactorKgPerM3: integer("cubic_factor_kg_per_m3").notNull().default(300),
  minFreightCents: integer("min_freight_cents").notNull().default(0),
  freeShippingMinSubtotalCents: integer("free_shipping_min_subtotal_cents"),
  freeShippingMaxWeightKg: numeric("free_shipping_max_weight_kg", { precision: 10, scale: 2, mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A distance/weight band for a freight rule. Either axis may be left unbounded (null on both
 * sides of that axis) — a rule with a single range spanning both axes fully behaves like one flat
 * rate. Distance bounds only ever match when the order's distance is known; since real distance
 * requires geocoding (SPEC.md §10, LOG-03, not built yet), every quote today resolves with
 * distanceKm=null, so only ranges with both distance bounds null are reachable until LOG-03 lands
 * — see the explicit, tested fallback in src/lib/freight.ts.
 */
export const freightRanges = pgTable(
  "freight_ranges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => freightRules.id, { onDelete: "cascade" }),
    distanceFromKm: integer("distance_from_km"),
    distanceToKm: integer("distance_to_km"),
    weightFromKg: numeric("weight_from_kg", { precision: 10, scale: 2, mode: "number" }),
    weightToKg: numeric("weight_to_kg", { precision: 10, scale: 2, mode: "number" }),
    valueCents: integer("value_cents").notNull(),
  },
  (table) => [index("freight_ranges_rule_idx").on(table.ruleId)],
);

/** A per-order additional charge a supplier may offer (SPEC.md §10, LOG-02) — the buyer opts into
 * whichever apply to their delivery at checkout (e.g. "sem elevador"), so these are never applied
 * automatically. One row per type per rule. */
export const freightSurcharges = pgTable(
  "freight_surcharges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => freightRules.id, { onDelete: "cascade" }),
    type: freightSurchargeTypeEnum("type").notNull(),
    valueCents: integer("value_cents").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [index("freight_surcharges_rule_idx").on(table.ruleId), unique().on(table.ruleId, table.type)],
);

export const freightRulesRelations = relations(freightRules, ({ one, many }) => ({
  supplier: one(users, {
    fields: [freightRules.supplierId],
    references: [users.id],
  }),
  ranges: many(freightRanges),
  surcharges: many(freightSurcharges),
}));

export const freightRangesRelations = relations(freightRanges, ({ one }) => ({
  rule: one(freightRules, {
    fields: [freightRanges.ruleId],
    references: [freightRules.id],
  }),
}));

export const freightSurchargesRelations = relations(freightSurcharges, ({ one }) => ({
  rule: one(freightRules, {
    fields: [freightSurcharges.ruleId],
    references: [freightRules.id],
  }),
}));

export type FreightRule = typeof freightRules.$inferSelect;
export type FreightRange = typeof freightRanges.$inferSelect;
export type FreightSurcharge = typeof freightSurcharges.$inferSelect;

/**
 * Caches a computed distance between two geocoded points (SPEC.md §10, LOG-03), keyed by the
 * coordinate pair itself (rounded to 5 decimal places, ~1m) rather than by address id — content-
 * addressed so a manually-adjusted pin naturally invalidates the old cache entry just by being a
 * different key, with nothing to explicitly clear. `source` records whether this came from the
 * routing provider or the geodesic (straight-line × correction factor) fallback, so a later
 * background job could re-resolve "geodesica" entries once the provider is back up, if that's
 * ever worth doing.
 */
export const routeDistanceCache = pgTable(
  "route_distance_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originLat: numeric("origin_lat", { precision: 10, scale: 7, mode: "number" }).notNull(),
    originLng: numeric("origin_lng", { precision: 10, scale: 7, mode: "number" }).notNull(),
    destinationLat: numeric("destination_lat", { precision: 10, scale: 7, mode: "number" }).notNull(),
    destinationLng: numeric("destination_lng", { precision: 10, scale: 7, mode: "number" }).notNull(),
    distanceKm: numeric("distance_km", { precision: 10, scale: 2, mode: "number" }).notNull(),
    source: routeDistanceSourceEnum("source").notNull(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.originLat, table.originLng, table.destinationLat, table.destinationLng),
  ],
);

export type RouteDistanceCache = typeof routeDistanceCache.$inferSelect;
