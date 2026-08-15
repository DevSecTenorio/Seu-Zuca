"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { addressSchema } from "@/lib/validation/address";
import { onlyDigits } from "@/lib/cnpj";
import type { FormState } from "./form-state";

export async function createDeliveryAddressAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await requireApprovedUser(["comprador"]);
  if (!user.company) {
    return { status: "error", message: "Conta sem empresa vinculada." };
  }

  const parsed = addressSchema.safeParse({
    label: formData.get("label") || undefined,
    cep: formData.get("cep"),
    logradouro: formData.get("logradouro"),
    numero: formData.get("numero"),
    complemento: formData.get("complemento") || undefined,
    bairro: formData.get("bairro"),
    cidade: formData.get("cidade"),
    estado: formData.get("estado"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  await db.insert(schema.addresses).values({
    companyId: user.company.id,
    type: "entrega",
    label: data.label || null,
    cep: onlyDigits(data.cep),
    logradouro: data.logradouro,
    numero: data.numero,
    complemento: data.complemento || null,
    bairro: data.bairro,
    cidade: data.cidade,
    estado: data.estado,
    isDefault: false,
  });

  revalidatePath("/checkout");
  return { status: "success", message: "Endereço adicionado. Selecione-o na lista acima." };
}

export async function listCompanyAddresses(companyId: string) {
  return db.query.addresses.findMany({
    where: eq(schema.addresses.companyId, companyId),
    orderBy: (a, { desc }) => [desc(a.isDefault), desc(a.createdAt)],
  });
}
