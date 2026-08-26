import { z } from "zod";
import { addressSchema } from "./address";

export const pickupLocationSchema = addressSchema.extend({
  label: z.string().trim().min(2, "Informe um nome para o local (ex.: Depósito Central)"),
  horarioFuncionamento: z.string().trim().min(2, "Informe o horário de funcionamento"),
  prazoDisponibilizacaoDias: z.coerce.number().int().min(0, "Informe o prazo em dias"),
  documentoExigido: z.string().trim().min(2, "Informe o documento exigido na retirada"),
});

export type PickupLocationInput = z.infer<typeof pickupLocationSchema>;
