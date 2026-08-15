import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  telefone: text("telefone").notNull(),
  ramoAtividade: text("ramo_atividade").notNull(),
  // Public URL identifier for the supplier storefront (/fornecedor/[slug]), added in Phase 3.
  // Only populated for role=fornecedor companies (buyers never get a public page) — nullable so
  // buyer rows don't need a wasted slug, unique constraint still holds since NULLs don't collide.
  slug: text("slug").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companiesRelations = relations(companies, ({ one }) => ({
  user: one(users, {
    fields: [companies.userId],
    references: [users.id],
  }),
}));

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
