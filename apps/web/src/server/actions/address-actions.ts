"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { addressSchema } from "@/lib/validation/address";
import { onlyDigits } from "@/lib/cnpj";
import { geocodeAddress } from "@/lib/openrouteservice";
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

  // Geocoding is external I/O, resolved before the insert (SPEC.md §10, LOG-03). A null result
  // (unconfigured provider, or nothing found) never blocks saving the address — it just means
  // raio coverage/route-distance freight can't be computed for it yet.
  const coordinates = await geocodeAddress({
    cep: onlyDigits(data.cep),
    logradouro: data.logradouro,
    numero: data.numero,
    cidade: data.cidade,
    estado: data.estado,
  });

  const [address] = await db
    .insert(schema.addresses)
    .values({
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
      latitude: coordinates?.lat ?? null,
      longitude: coordinates?.lng ?? null,
    })
    .returning({ id: schema.addresses.id, latitude: schema.addresses.latitude, longitude: schema.addresses.longitude });

  revalidatePath("/checkout");
  return {
    status: "success",
    message: "Endereço adicionado. Selecione-o na lista acima.",
    newAddressId: address.id,
    newAddressCoordinates: address.latitude !== null && address.longitude !== null ? { lat: address.latitude, lng: address.longitude } : null,
  };
}

/** The buyer drags the map pin to correct a geocoded (or missing) point — SPEC.md §10, LOG-03:
 * "essa coordenada ajustada passa a valer para os pedidos futuros ... não é perguntada de novo a
 * cada pedido". Once adjusted, the address is never re-geocoded from its text fields again. */
export async function adjustAddressCoordinatesAction(addressId: string, lat: number, lng: number): Promise<void> {
  const user = await requireApprovedUser(["comprador", "fornecedor"]);
  if (!user.company) return;

  const address = await db.query.addresses.findFirst({ where: eq(schema.addresses.id, addressId) });
  if (!address || address.companyId !== user.company.id) return;

  await db
    .update(schema.addresses)
    .set({ latitude: lat, longitude: lng, coordinatesAdjustedManually: true })
    .where(and(eq(schema.addresses.id, addressId), eq(schema.addresses.companyId, user.company.id)));

  revalidatePath("/checkout");
}

export async function listCompanyAddresses(companyId: string) {
  return db.query.addresses.findMany({
    where: eq(schema.addresses.companyId, companyId),
    orderBy: (a, { desc }) => [desc(a.isDefault), desc(a.createdAt)],
  });
}
