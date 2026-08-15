import { z } from "zod";
import { BRAZILIAN_STATES } from "./register";

export const addressSchema = z.object({
  label: z.string().trim().max(60).optional(),
  cep: z
    .string()
    .trim()
    .min(8, "Informe um CEP válido")
    .transform((v) => v.replace(/\D/g, "")),
  logradouro: z.string().trim().min(2, "Informe o logradouro"),
  numero: z.string().trim().min(1, "Informe o número"),
  complemento: z.string().trim().optional(),
  bairro: z.string().trim().min(2, "Informe o bairro"),
  cidade: z.string().trim().min(2, "Informe a cidade"),
  estado: z.enum(BRAZILIAN_STATES, { message: "Selecione o estado" }),
});

export type AddressInput = z.infer<typeof addressSchema>;
