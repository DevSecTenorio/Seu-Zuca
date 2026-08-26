"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { logAudit } from "@/lib/audit";
import { parseManualCepText, parseManualMunicipioText, parseCepSpreadsheet, diffCepRanges, type CepImportDiff } from "@/lib/cep-import";
import type { CoverageCepRange } from "@/lib/delivery-coverage";
import type { FormState } from "./form-state";

function revalidateLogisticsTab() {
  revalidatePath("/fornecedor/painel");
}

const coverageAreaSchema = z
  .object({
    scope: z.enum(["fornecedor", "produto", "categoria"]),
    productId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    kind: z.enum(["cep", "municipio", "raio"]),
    mode: z.enum(["cobertura", "exclusao"]),
    radiusKm: z.coerce.number().int().positive().optional(),
    cepsText: z.string().optional(),
    municipiosText: z.string().optional(),
  })
  .refine((v) => v.scope !== "produto" || !!v.productId, {
    message: "Selecione o produto.",
    path: ["productId"],
  })
  .refine((v) => v.scope !== "categoria" || !!v.categoryId, {
    message: "Selecione a categoria.",
    path: ["categoryId"],
  })
  .refine((v) => v.kind !== "raio" || !!v.radiusKm, {
    message: "Informe o raio em km.",
    path: ["radiusKm"],
  });

async function loadFormInput(formData: FormData) {
  return coverageAreaSchema.safeParse({
    scope: formData.get("scope"),
    productId: formData.get("productId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    kind: formData.get("kind"),
    mode: formData.get("mode"),
    radiusKm: formData.get("radiusKm") || undefined,
    cepsText: formData.get("cepsText") || undefined,
    municipiosText: formData.get("municipiosText") || undefined,
  });
}

export async function createCoverageAreaAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const parsed = await loadFormInput(formData);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  const input = parsed.data;

  if (input.scope === "produto") {
    const product = await db.query.products.findFirst({ where: eq(schema.products.id, input.productId!) });
    if (!product || product.supplierId !== supplier.id) {
      return { status: "error", fieldErrors: { productId: ["Produto inválido."] } };
    }
  }

  const ceps = input.kind === "cep" ? parseManualCepText(input.cepsText ?? "") : [];
  const municipios = input.kind === "municipio" ? parseManualMunicipioText(input.municipiosText ?? "") : [];
  if (input.kind === "cep" && ceps.length === 0) {
    return { status: "error", fieldErrors: { cepsText: ["Informe ao menos um CEP válido."] } };
  }
  if (input.kind === "municipio" && municipios.length === 0) {
    return { status: "error", fieldErrors: { municipiosText: ["Informe ao menos um município válido (Cidade,UF)."] } };
  }

  const areaId = await db.transaction(async (tx) => {
    const [area] = await tx
      .insert(schema.deliveryCoverageAreas)
      .values({
        supplierId: supplier.id,
        scope: input.scope,
        productId: input.scope === "produto" ? input.productId : null,
        categoryId: input.scope === "categoria" ? input.categoryId : null,
        kind: input.kind,
        mode: input.mode,
        radiusKm: input.kind === "raio" ? input.radiusKm : null,
      })
      .returning({ id: schema.deliveryCoverageAreas.id });
    if (ceps.length > 0) {
      await tx.insert(schema.deliveryCoverageCeps).values(ceps.map((r) => ({ coverageAreaId: area.id, ...r })));
    }
    if (municipios.length > 0) {
      await tx.insert(schema.deliveryCoverageMunicipios).values(municipios.map((m) => ({ coverageAreaId: area.id, ...m })));
    }
    return area.id;
  });

  await logAudit({
    actorId: supplier.id,
    action: "delivery_coverage.create",
    entityType: "delivery_coverage_area",
    entityId: areaId,
    after: { ...input, cepsCount: ceps.length, municipiosCount: municipios.length },
  });
  revalidateLogisticsTab();
  return { status: "success", message: "Regra de cobertura criada." };
}

const coverageAreaUpdateSchema = z.object({
  mode: z.enum(["cobertura", "exclusao"]),
  radiusKm: z.coerce.number().int().positive().optional(),
  cepsText: z.string().optional(),
  municipiosText: z.string().optional(),
});

/** Updates the mutable parts of a rule (mode, and its CEPs/municípios/raio value) — scope, kind
 * and the target product/category are the rule's identity and aren't editable; delete and
 * recreate the rule if those need to change. */
export async function updateCoverageAreaAction(areaId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const area = await db.query.deliveryCoverageAreas.findFirst({ where: eq(schema.deliveryCoverageAreas.id, areaId) });
  if (!area || area.supplierId !== supplier.id) return { status: "error", message: "Regra não encontrada." };

  const parsed = coverageAreaUpdateSchema.safeParse({
    mode: formData.get("mode"),
    radiusKm: formData.get("radiusKm") || undefined,
    cepsText: formData.get("cepsText") || undefined,
    municipiosText: formData.get("municipiosText") || undefined,
  });
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  const input = parsed.data;

  if (area.kind === "raio" && !input.radiusKm) {
    return { status: "error", fieldErrors: { radiusKm: ["Informe o raio em km."] } };
  }

  const ceps = area.kind === "cep" ? parseManualCepText(input.cepsText ?? "") : [];
  const municipios = area.kind === "municipio" ? parseManualMunicipioText(input.municipiosText ?? "") : [];
  if (area.kind === "cep" && ceps.length === 0) {
    return { status: "error", fieldErrors: { cepsText: ["Informe ao menos um CEP válido."] } };
  }
  if (area.kind === "municipio" && municipios.length === 0) {
    return { status: "error", fieldErrors: { municipiosText: ["Informe ao menos um município válido (Cidade,UF)."] } };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.deliveryCoverageAreas)
      .set({ mode: input.mode, radiusKm: area.kind === "raio" ? input.radiusKm : null, updatedAt: new Date() })
      .where(eq(schema.deliveryCoverageAreas.id, areaId));
    if (area.kind === "cep") {
      await tx.delete(schema.deliveryCoverageCeps).where(eq(schema.deliveryCoverageCeps.coverageAreaId, areaId));
      if (ceps.length > 0) await tx.insert(schema.deliveryCoverageCeps).values(ceps.map((r) => ({ coverageAreaId: areaId, ...r })));
    }
    if (area.kind === "municipio") {
      await tx.delete(schema.deliveryCoverageMunicipios).where(eq(schema.deliveryCoverageMunicipios.coverageAreaId, areaId));
      if (municipios.length > 0)
        await tx.insert(schema.deliveryCoverageMunicipios).values(municipios.map((m) => ({ coverageAreaId: areaId, ...m })));
    }
  });

  await logAudit({
    actorId: supplier.id,
    action: "delivery_coverage.update",
    entityType: "delivery_coverage_area",
    entityId: areaId,
    before: area,
    after: { ...input, cepsCount: ceps.length, municipiosCount: municipios.length },
  });
  revalidateLogisticsTab();
  return { status: "success", message: "Regra de cobertura atualizada." };
}

export async function deleteCoverageAreaAction(areaId: string) {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const before = await db.query.deliveryCoverageAreas.findFirst({ where: eq(schema.deliveryCoverageAreas.id, areaId) });
  if (!before || before.supplierId !== supplier.id) return;

  await db.delete(schema.deliveryCoverageAreas).where(eq(schema.deliveryCoverageAreas.id, areaId));
  await logAudit({
    actorId: supplier.id,
    action: "delivery_coverage.delete",
    entityType: "delivery_coverage_area",
    entityId: areaId,
    before,
  });
  revalidateLogisticsTab();
}

export async function toggleCoverageAreaActiveAction(areaId: string, nextActive: boolean) {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const before = await db.query.deliveryCoverageAreas.findFirst({ where: eq(schema.deliveryCoverageAreas.id, areaId) });
  if (!before || before.supplierId !== supplier.id) return;

  await db.update(schema.deliveryCoverageAreas).set({ active: nextActive, updatedAt: new Date() }).where(eq(schema.deliveryCoverageAreas.id, areaId));
  await logAudit({
    actorId: supplier.id,
    action: nextActive ? "delivery_coverage.activate" : "delivery_coverage.deactivate",
    entityType: "delivery_coverage_area",
    entityId: areaId,
    before,
  });
  revalidateLogisticsTab();
}

export type CepSimulationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; diff: CepImportDiff; payload: string };

export async function simulateCepImportAction(
  areaId: string,
  _prevState: CepSimulationState,
  formData: FormData,
): Promise<CepSimulationState> {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const area = await db.query.deliveryCoverageAreas.findFirst({
    where: eq(schema.deliveryCoverageAreas.id, areaId),
    with: { ceps: true },
  });
  if (!area || area.supplierId !== supplier.id || area.kind !== "cep") {
    return { status: "error", message: "Regra de cobertura inválida." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecione um arquivo .xlsx ou .csv." };
  }

  const parsedResult = await parseCepSpreadsheet(file);
  if (!parsedResult.ok) return { status: "error", message: parsedResult.error };

  const diff = diffCepRanges(area.ceps, parsedResult.ranges);
  return { status: "success", diff, payload: JSON.stringify(parsedResult.ranges) };
}

export async function applyCepImportAction(areaId: string, payload: string): Promise<FormState> {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const area = await db.query.deliveryCoverageAreas.findFirst({
    where: eq(schema.deliveryCoverageAreas.id, areaId),
    with: { ceps: true },
  });
  if (!area || area.supplierId !== supplier.id || area.kind !== "cep") {
    return { status: "error", message: "Regra de cobertura inválida." };
  }

  let ranges: CoverageCepRange[];
  try {
    ranges = JSON.parse(payload);
  } catch {
    return { status: "error", message: "Simulação expirada — importe a planilha novamente." };
  }

  const before = area.ceps;
  await db.transaction(async (tx) => {
    await tx.delete(schema.deliveryCoverageCeps).where(eq(schema.deliveryCoverageCeps.coverageAreaId, areaId));
    if (ranges.length > 0) {
      await tx.insert(schema.deliveryCoverageCeps).values(ranges.map((r) => ({ coverageAreaId: areaId, ...r })));
    }
  });

  await logAudit({
    actorId: supplier.id,
    action: "delivery_coverage.cep_import",
    entityType: "delivery_coverage_area",
    entityId: areaId,
    before: { cepsCount: before.length },
    after: { cepsCount: ranges.length },
  });
  revalidateLogisticsTab();
  return { status: "success", message: `Malha de CEPs atualizada: ${ranges.length} faixas.` };
}
