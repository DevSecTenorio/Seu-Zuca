import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const unidadesMedidaTable = pgTable("unidades_medida", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  sigla: text("sigla").notNull().unique(),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUnidadeMedidaSchema = createInsertSchema(unidadesMedidaTable).omit({ id: true, createdAt: true });
export type InsertUnidadeMedida = z.infer<typeof insertUnidadeMedidaSchema>;
export type UnidadeMedida = typeof unidadesMedidaTable.$inferSelect;
