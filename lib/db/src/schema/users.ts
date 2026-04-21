import { pgTable, text, serial, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nome: text("nome").notNull(),
  role: text("role").notNull().default("buyer"),
  status: text("status").notNull().default("pending"),
  cnpj: text("cnpj"),
  razaoSocial: text("razao_social"),
  nomeFantasia: text("nome_fantasia"),
  telefone: text("telefone"),
  ramo: text("ramo"),
  emailVerificado: boolean("email_verificado").notNull().default(false),
  comissao: real("comissao"),
  stripeAccountId: text("stripe_account_id"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry", { withTimezone: true }),
  ultimoAcesso: timestamp("ultimo_acesso", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
