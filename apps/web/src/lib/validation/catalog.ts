import { z } from "zod";
import { CATEGORY_ICON_NAMES } from "@/lib/icons";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da categoria"),
  parentId: z.string().uuid().optional().or(z.literal("")),
  defaultUnitId: z.string().uuid().optional().or(z.literal("")),
  icon: z.enum(CATEGORY_ICON_NAMES as [string, ...string[]], { message: "Selecione um ícone" }),
  active: z.coerce.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const unitSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da unidade"),
  abbreviation: z.string().trim().min(1, "Informe a abreviação"),
});
export type UnitInput = z.infer<typeof unitSchema>;

export const productSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do produto"),
  categoryId: z.string().uuid("Selecione uma categoria"),
  unitId: z.string().uuid("Selecione uma unidade de venda"),
  sku: z.string().trim().min(1, "Informe o SKU"),
  description: z.string().trim().min(1, "Descreva o produto"),
  // Price is collected in the form as a BRL string ("1.234,56") and converted to integer cents
  // server-side — the DB and API only ever see cents (CLAUDE.md).
  priceReais: z
    .string()
    .trim()
    .min(1, "Informe o preço")
    .refine((v) => !Number.isNaN(parseBRL(v)) && parseBRL(v) > 0, "Informe um preço válido"),
  stock: z.coerce.number().int().min(0, "Estoque não pode ser negativo"),
  leadTimeDays: z.coerce.number().int().min(1, "Informe ao menos 1 dia"),
});
export type ProductInput = z.infer<typeof productSchema>;

/** Parses a pt-BR formatted amount ("1.234,56") into a float in reais. */
export function parseBRL(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  return Number.parseFloat(normalized);
}

export function reaisToCents(value: string): number {
  return Math.round(parseBRL(value) * 100);
}
