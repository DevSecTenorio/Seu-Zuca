import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { orders } from "./orders";

/**
 * A fornecedor-configured pickup point (SPEC.md §10, LOG-05) — a supplier may run more than one,
 * so the buyer picks which one at checkout when choosing "retirada". Address fields are embedded
 * rather than a FK into `addresses` since this isn't a company/user address (no geocoding, no
 * relation to LOG-01/LOG-03) — just a place and a schedule.
 */
export const pickupLocations = pgTable(
  "pickup_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    cep: text("cep").notNull(),
    logradouro: text("logradouro").notNull(),
    numero: text("numero").notNull(),
    complemento: text("complemento"),
    bairro: text("bairro").notNull(),
    cidade: text("cidade").notNull(),
    estado: text("estado").notNull(),
    horarioFuncionamento: text("horario_funcionamento").notNull(),
    prazoDisponibilizacaoDias: integer("prazo_disponibilizacao_dias").notNull().default(1),
    documentoExigido: text("documento_exigido").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("pickup_locations_supplier_idx").on(table.supplierId)],
);

/**
 * One-time pickup code for a "retirada" order (SPEC.md §10, LOG-05) — generated at checkout,
 * shown to the buyer, and checked off by the fornecedor when the buyer shows up in person
 * (src/server/actions/order-actions.ts's supplierConfirmPickupAction). One per order.
 */
export const pickupCodes = pgTable(
  "pickup_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    used: boolean("used").notNull().default(false),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("pickup_codes_order_idx").on(table.orderId)],
);

export const pickupLocationsRelations = relations(pickupLocations, ({ one }) => ({
  supplier: one(users, {
    fields: [pickupLocations.supplierId],
    references: [users.id],
  }),
}));

export const pickupCodesRelations = relations(pickupCodes, ({ one }) => ({
  order: one(orders, {
    fields: [pickupCodes.orderId],
    references: [orders.id],
  }),
}));

export type PickupLocation = typeof pickupLocations.$inferSelect;
export type PickupCode = typeof pickupCodes.$inferSelect;
