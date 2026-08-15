import { relations } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { orderStatusEnum } from "./enums";
import { users } from "./users";
import { addresses } from "./addresses";
import { products } from "./catalog";

export const checkoutGroups = pgTable("checkout_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deliveryAddressId: uuid("delivery_address_id")
    .notNull()
    .references(() => addresses.id, { onDelete: "restrict" }),
  totalCents: integer("total_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkoutGroupId: uuid("checkout_group_id")
      .notNull()
      .references(() => checkoutGroups.id, { onDelete: "restrict" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("aguardando_pagamento"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }).notNull(),
    commissionCents: integer("commission_cents").notNull(),
    trackingCode: text("tracking_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("orders_buyer_idx").on(table.buyerId),
    index("orders_supplier_idx").on(table.supplierId),
    index("orders_checkout_group_idx").on(table.checkoutGroupId),
    index("orders_status_idx").on(table.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    totalCents: integer("total_cents").notNull(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatusEnum("status").notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_status_events_order_idx").on(table.orderId)],
);

export const checkoutGroupsRelations = relations(checkoutGroups, ({ one, many }) => ({
  buyer: one(users, {
    fields: [checkoutGroups.buyerId],
    references: [users.id],
  }),
  deliveryAddress: one(addresses, {
    fields: [checkoutGroups.deliveryAddressId],
    references: [addresses.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  checkoutGroup: one(checkoutGroups, {
    fields: [orders.checkoutGroupId],
    references: [checkoutGroups.id],
  }),
  buyer: one(users, {
    fields: [orders.buyerId],
    references: [users.id],
    relationName: "order_buyer",
  }),
  supplier: one(users, {
    fields: [orders.supplierId],
    references: [users.id],
    relationName: "order_supplier",
  }),
  items: many(orderItems),
  statusEvents: many(orderStatusEvents),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const orderStatusEventsRelations = relations(orderStatusEvents, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatusEvents.orderId],
    references: [orders.id],
  }),
  actor: one(users, {
    fields: [orderStatusEvents.createdBy],
    references: [users.id],
  }),
}));
