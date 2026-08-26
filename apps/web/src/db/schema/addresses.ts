import { relations } from "drizzle-orm";
import { boolean, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { addressTypeEnum } from "./enums";
import { companies } from "./companies";

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  type: addressTypeEnum("type").notNull().default("empresa"),
  label: text("label"),
  cep: text("cep").notNull(),
  logradouro: text("logradouro").notNull(),
  numero: text("numero").notNull(),
  complemento: text("complemento"),
  bairro: text("bairro").notNull(),
  cidade: text("cidade").notNull(),
  estado: text("estado").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  // Geocoded from the address fields above at creation time (SPEC.md §10, LOG-03). Null when
  // geocoding wasn't configured or found nothing — every caller treats "no coordinates" the same
  // as "can't compute a real distance for this address" rather than failing.
  latitude: numeric("latitude", { precision: 10, scale: 7, mode: "number" }),
  longitude: numeric("longitude", { precision: 10, scale: 7, mode: "number" }),
  // True once the buyer has dragged the map pin — that adjusted point is then authoritative and
  // is never overwritten by re-geocoding the same address fields again.
  coordinatesAdjustedManually: boolean("coordinates_adjusted_manually").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const addressesRelations = relations(addresses, ({ one }) => ({
  company: one(companies, {
    fields: [addresses.companyId],
    references: [companies.id],
  }),
}));
