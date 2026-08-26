"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { logAudit } from "@/lib/audit";
import { reaisToCents, parseBRL } from "@/lib/validation/catalog";
import { FREIGHT_SURCHARGE_TYPES } from "@/lib/freight";
import type { FormState } from "./form-state";

const rangeSchema = z.object({
  distanceFromKm: z.number().int().nonnegative().nullable(),
  distanceToKm: z.number().int().nonnegative().nullable(),
  weightFromKg: z.number().nonnegative().nullable(),
  weightToKg: z.number().nonnegative().nullable(),
  valueCents: z.number().int().nonnegative(),
});

const surchargeSchema = z.object({
  type: z.enum(FREIGHT_SURCHARGE_TYPES),
  valueCents: z.number().int().nonnegative(),
  active: z.boolean(),
});

const freightRuleSchema = z.object({
  chargeType: z.enum(["fixo", "por_km", "por_kg", "por_km_kg"]),
  cubicFactorKgPerM3: z.coerce.number().int().positive(),
  minFreightReais: z
    .string()
    .trim()
    .min(1, "Informe o piso mínimo (pode ser 0,00).")
    .refine((v) => !Number.isNaN(parseBRL(v)) && parseBRL(v) >= 0, "Informe um valor válido."),
  freeShippingMinSubtotalReais: z.string().optional(),
  freeShippingMaxWeightKg: z.coerce.number().nonnegative().optional(),
  rangesJson: z.string(),
  surchargesJson: z.string(),
});

function revalidateLogisticsTab() {
  revalidatePath("/fornecedor/painel");
}

export async function saveFreightRuleAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supplier = await requireApprovedUser(["fornecedor"]);

  const parsed = freightRuleSchema.safeParse({
    chargeType: formData.get("chargeType"),
    cubicFactorKgPerM3: formData.get("cubicFactorKgPerM3"),
    minFreightReais: formData.get("minFreightReais"),
    freeShippingMinSubtotalReais: formData.get("freeShippingMinSubtotalReais") || undefined,
    freeShippingMaxWeightKg: formData.get("freeShippingMaxWeightKg") || undefined,
    rangesJson: formData.get("rangesJson") ?? "[]",
    surchargesJson: formData.get("surchargesJson") ?? "[]",
  });
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  const input = parsed.data;

  let ranges: z.infer<typeof rangeSchema>[];
  let surcharges: z.infer<typeof surchargeSchema>[];
  try {
    ranges = z.array(rangeSchema).parse(JSON.parse(input.rangesJson));
    surcharges = z.array(surchargeSchema).parse(JSON.parse(input.surchargesJson));
  } catch {
    return { status: "error", message: "Faixas ou adicionais inválidos." };
  }

  const freeShippingMinSubtotalCents =
    input.freeShippingMinSubtotalReais && input.freeShippingMinSubtotalReais.trim() !== ""
      ? reaisToCents(input.freeShippingMinSubtotalReais)
      : null;

  const before = await db.query.freightRules.findFirst({ where: eq(schema.freightRules.supplierId, supplier.id) });

  const ruleId = await db.transaction(async (tx) => {
    const [rule] = await tx
      .insert(schema.freightRules)
      .values({
        supplierId: supplier.id,
        chargeType: input.chargeType,
        cubicFactorKgPerM3: input.cubicFactorKgPerM3,
        minFreightCents: reaisToCents(input.minFreightReais),
        freeShippingMinSubtotalCents,
        freeShippingMaxWeightKg: input.freeShippingMaxWeightKg ?? null,
      })
      .onConflictDoUpdate({
        target: schema.freightRules.supplierId,
        set: {
          chargeType: input.chargeType,
          cubicFactorKgPerM3: input.cubicFactorKgPerM3,
          minFreightCents: reaisToCents(input.minFreightReais),
          freeShippingMinSubtotalCents,
          freeShippingMaxWeightKg: input.freeShippingMaxWeightKg ?? null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.freightRules.id });

    await tx.delete(schema.freightRanges).where(eq(schema.freightRanges.ruleId, rule.id));
    if (ranges.length > 0) {
      await tx.insert(schema.freightRanges).values(ranges.map((r) => ({ ruleId: rule.id, ...r })));
    }

    await tx.delete(schema.freightSurcharges).where(eq(schema.freightSurcharges.ruleId, rule.id));
    if (surcharges.length > 0) {
      await tx.insert(schema.freightSurcharges).values(surcharges.map((s) => ({ ruleId: rule.id, ...s })));
    }

    return rule.id;
  });

  await logAudit({
    actorId: supplier.id,
    action: before ? "freight_rule.update" : "freight_rule.create",
    entityType: "freight_rule",
    entityId: ruleId,
    before,
    after: { ...input, rangesCount: ranges.length, surchargesCount: surcharges.length },
  });
  revalidateLogisticsTab();
  return { status: "success", message: "Configuração de frete salva." };
}
