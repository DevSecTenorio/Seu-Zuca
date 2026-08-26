"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { onlyDigits } from "@/lib/cnpj";
import { logAudit } from "@/lib/audit";
import { pickupLocationSchema } from "@/lib/validation/pickup";
import type { FormState } from "./form-state";

function revalidateLogisticsTab() {
  revalidatePath("/fornecedor/painel");
}

function parsePickupLocationForm(formData: FormData) {
  return pickupLocationSchema.safeParse({
    label: formData.get("label"),
    cep: formData.get("cep"),
    logradouro: formData.get("logradouro"),
    numero: formData.get("numero"),
    complemento: formData.get("complemento") || undefined,
    bairro: formData.get("bairro"),
    cidade: formData.get("cidade"),
    estado: formData.get("estado"),
    horarioFuncionamento: formData.get("horarioFuncionamento"),
    prazoDisponibilizacaoDias: formData.get("prazoDisponibilizacaoDias"),
    documentoExigido: formData.get("documentoExigido"),
  });
}

export async function createPickupLocationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const parsed = parsePickupLocationForm(formData);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const [location] = await db
    .insert(schema.pickupLocations)
    .values({
      supplierId: supplier.id,
      label: data.label,
      cep: onlyDigits(data.cep),
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento || null,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: data.estado,
      horarioFuncionamento: data.horarioFuncionamento,
      prazoDisponibilizacaoDias: data.prazoDisponibilizacaoDias,
      documentoExigido: data.documentoExigido,
    })
    .returning({ id: schema.pickupLocations.id });

  await logAudit({
    actorId: supplier.id,
    action: "pickup_location.create",
    entityType: "pickup_location",
    entityId: location.id,
    after: data,
  });
  revalidateLogisticsTab();
  return { status: "success", message: "Local de retirada criado." };
}

export async function updatePickupLocationAction(locationId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const before = await db.query.pickupLocations.findFirst({ where: eq(schema.pickupLocations.id, locationId) });
  if (!before || before.supplierId !== supplier.id) return { status: "error", message: "Local não encontrado." };

  const parsed = parsePickupLocationForm(formData);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const [after] = await db
    .update(schema.pickupLocations)
    .set({
      label: data.label,
      cep: onlyDigits(data.cep),
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento || null,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: data.estado,
      horarioFuncionamento: data.horarioFuncionamento,
      prazoDisponibilizacaoDias: data.prazoDisponibilizacaoDias,
      documentoExigido: data.documentoExigido,
      updatedAt: new Date(),
    })
    .where(eq(schema.pickupLocations.id, locationId))
    .returning();

  await logAudit({
    actorId: supplier.id,
    action: "pickup_location.update",
    entityType: "pickup_location",
    entityId: locationId,
    before,
    after,
  });
  revalidateLogisticsTab();
  return { status: "success", message: "Local de retirada atualizado." };
}

export async function deletePickupLocationAction(locationId: string) {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const before = await db.query.pickupLocations.findFirst({ where: eq(schema.pickupLocations.id, locationId) });
  if (!before || before.supplierId !== supplier.id) return;

  await db.delete(schema.pickupLocations).where(eq(schema.pickupLocations.id, locationId));
  await logAudit({
    actorId: supplier.id,
    action: "pickup_location.delete",
    entityType: "pickup_location",
    entityId: locationId,
    before,
  });
  revalidateLogisticsTab();
}

export async function togglePickupLocationActiveAction(locationId: string, nextActive: boolean) {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const before = await db.query.pickupLocations.findFirst({ where: eq(schema.pickupLocations.id, locationId) });
  if (!before || before.supplierId !== supplier.id) return;

  await db.update(schema.pickupLocations).set({ active: nextActive, updatedAt: new Date() }).where(eq(schema.pickupLocations.id, locationId));
  await logAudit({
    actorId: supplier.id,
    action: nextActive ? "pickup_location.activate" : "pickup_location.deactivate",
    entityType: "pickup_location",
    entityId: locationId,
    before,
  });
  revalidateLogisticsTab();
}
