import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { productModerationStatusEnum } from "./enums";
import { users } from "./users";

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  abbreviation: text("abbreviation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    // Self-reference needs an untyped return to break Drizzle/TS circular type inference.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentId: uuid("parent_id").references((): any => categories.id, {
      onDelete: "set null",
    }),
    defaultUnitId: uuid("default_unit_id").references(() => units.id, {
      onDelete: "set null",
    }),
    icon: text("icon").notNull().default("Package"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("categories_parent_idx").on(table.parentId)],
);

export const minQuantityRules = pgTable("min_quantity_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .unique()
    .references(() => categories.id, { onDelete: "cascade" }),
  minQuantity: integer("min_quantity").notNull().default(1),
  multiple: integer("multiple").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    sku: text("sku").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    stock: integer("stock").notNull().default(0),
    leadTimeDays: integer("lead_time_days").notNull().default(1),
    // Per unit sold (the same unit as `stock`/the cart quantity) — used to compute a shipment's
    // real weight and cubic (volumetric) weight for the freight engine (SPEC.md §10, LOG-02).
    weightGrams: integer("weight_grams").notNull().default(1000),
    lengthCm: integer("length_cm").notNull().default(10),
    widthCm: integer("width_cm").notNull().default(10),
    heightCm: integer("height_cm").notNull().default(10),
    moderationStatus: productModerationStatusEnum("moderation_status")
      .notNull()
      .default("aguardando_aprovacao"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_supplier_idx").on(table.supplierId),
    index("products_category_idx").on(table.categoryId),
    index("products_moderation_status_idx").on(table.moderationStatus),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    order: integer("order").notNull().default(0),
  },
  (table) => [index("product_images_product_idx").on(table.productId)],
);

export const unitsRelations = relations(units, ({ many }) => ({
  categories: many(categories),
  products: many(products),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_parent",
  }),
  children: many(categories, { relationName: "category_parent" }),
  defaultUnit: one(units, {
    fields: [categories.defaultUnitId],
    references: [units.id],
  }),
  minQuantityRule: one(minQuantityRules, {
    fields: [categories.id],
    references: [minQuantityRules.categoryId],
  }),
  products: many(products),
}));

export const minQuantityRulesRelations = relations(minQuantityRules, ({ one }) => ({
  category: one(categories, {
    fields: [minQuantityRules.categoryId],
    references: [categories.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  supplier: one(users, {
    fields: [products.supplierId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  unit: one(units, {
    fields: [products.unitId],
    references: [units.id],
  }),
  images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));
