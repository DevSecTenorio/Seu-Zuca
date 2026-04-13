import { pgTable, text, serial, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { usersTable } from "./users";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  slug: text("slug").notNull().unique(),
  descricao: text("descricao"),
  sku: text("sku"),
  preco: real("preco").notNull(),
  unidadeMedida: text("unidade_medida").notNull().default("un"),
  estoque: integer("estoque").notNull().default(0),
  alertaEstoque: integer("alerta_estoque").notNull().default(10),
  disponivel: boolean("disponivel").notNull().default(true),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  supplierId: integer("supplier_id").notNull().references(() => usersTable.id),
  imagemPrincipal: text("imagem_principal"),
  prazoFrete: integer("prazo_frete").notNull().default(7),
  regioesAtendidas: text("regioes_atendidas").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const productImagesTable = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  ordem: integer("ordem").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

export const insertProductImageSchema = createInsertSchema(productImagesTable).omit({ id: true, createdAt: true });
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;
export type ProductImage = typeof productImagesTable.$inferSelect;
