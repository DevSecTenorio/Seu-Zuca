import { pgTable, serial, integer, text, timestamp, real } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

export const paymentMethodsTable = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  metodo: text("metodo").notNull(),
  status: text("status").notNull().default("pending"),
  externalId: text("external_id"),
  qrCode: text("qr_code"),
  qrCodeBase64: text("qr_code_base64"),
  ticketUrl: text("ticket_url"),
  codigoBarras: text("codigo_barras"),
  checkoutUrl: text("checkout_url"),
  valor: real("valor"),
  metadata: text("metadata"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
