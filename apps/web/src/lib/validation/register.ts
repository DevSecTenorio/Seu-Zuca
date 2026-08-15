import { z } from "zod";
import { isValidCnpj } from "@/lib/cnpj";
import { passwordSchema } from "./auth";

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const companyStepSchema = z
  .object({
    razaoSocial: z.string().trim().min(2, "Informe a razão social"),
    nomeFantasia: z.string().trim().min(2, "Informe o nome fantasia"),
    cnpj: z
      .string()
      .trim()
      .min(1, "Informe o CNPJ")
      .refine(isValidCnpj, "CNPJ inválido"),
    email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido"),
    telefone: z.string().trim().min(8, "Informe um telefone válido"),
    ramoAtividade: z.string().trim().min(2, "Informe o ramo de atividade"),
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
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type CompanyStepInput = z.infer<typeof companyStepSchema>;
