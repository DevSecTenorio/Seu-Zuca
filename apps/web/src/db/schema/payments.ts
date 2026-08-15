import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { paymentMethodEnum, paymentStatusEnum } from "./enums";
import { checkoutGroups } from "./orders";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkoutGroupId: uuid("checkout_group_id")
      .notNull()
      .references(() => checkoutGroups.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    status: paymentStatusEnum("status").notNull().default("aguardando_pagamento"),
    mpPaymentId: text("mp_payment_id"),
    mpPreferenceId: text("mp_preference_id"),
    webhookPayload: jsonb("webhook_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payments_checkout_group_idx").on(table.checkoutGroupId),
    index("payments_status_idx").on(table.status),
  ],
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  checkoutGroup: one(checkoutGroups, {
    fields: [payments.checkoutGroupId],
    references: [checkoutGroups.id],
  }),
}));
