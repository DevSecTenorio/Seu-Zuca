import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { calculateFreightCents, type FreightSurchargeType, type FreightBreakdown } from "@/lib/freight";
import { calculateShippingCents } from "@/lib/shipping";

export async function getSupplierFreightConfig(supplierId: string) {
  return db.query.freightRules.findFirst({
    where: eq(schema.freightRules.supplierId, supplierId),
    with: { ranges: true, surcharges: true },
  });
}

export type ShipmentItem = { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number; quantity: number };

/** Total real weight and volume for a shipment (SPEC.md §10, LOG-02) — summed once for the whole
 * supplier group, not per line item, since cubage is a property of what actually fits in a truck
 * together. */
export function shipmentWeightAndVolume(items: ShipmentItem[]): { realWeightKg: number; volumeM3: number } {
  let realWeightKg = 0;
  let volumeM3 = 0;
  for (const item of items) {
    realWeightKg += (item.weightGrams / 1000) * item.quantity;
    volumeM3 += ((item.lengthCm * item.widthCm * item.heightCm) / 1_000_000) * item.quantity;
  }
  return { realWeightKg, volumeM3 };
}

/**
 * Quotes freight for one supplier's shipment. A supplier who hasn't configured a freight_rule
 * yet falls back to the pre-LOG-02 flat model (src/lib/shipping.ts) so their catalog doesn't
 * suddenly ship for free. `distanceKm` is always null today — see src/lib/freight.ts header.
 */
export async function quoteSupplierFreight(
  supplierId: string,
  items: ShipmentItem[],
  subtotalCents: number,
  selectedSurchargeTypes: FreightSurchargeType[],
): Promise<FreightBreakdown> {
  const rule = await getSupplierFreightConfig(supplierId);
  if (!rule) {
    const cents = calculateShippingCents(subtotalCents);
    return {
      totalCents: cents,
      freeShippingApplied: cents === 0,
      chargeableWeightKg: 0,
      lines: [{ label: cents === 0 ? "Frete grátis" : "Frete", valueCents: cents }],
    };
  }

  const { realWeightKg, volumeM3 } = shipmentWeightAndVolume(items);
  const selectedSurcharges = rule.surcharges.filter((s) => s.active && selectedSurchargeTypes.includes(s.type));

  return calculateFreightCents({
    rule: {
      chargeType: rule.chargeType,
      cubicFactorKgPerM3: rule.cubicFactorKgPerM3,
      minFreightCents: rule.minFreightCents,
      freeShippingMinSubtotalCents: rule.freeShippingMinSubtotalCents,
      freeShippingMaxWeightKg: rule.freeShippingMaxWeightKg,
    },
    ranges: rule.ranges.map((r) => ({
      distanceFromKm: r.distanceFromKm,
      distanceToKm: r.distanceToKm,
      weightFromKg: r.weightFromKg,
      weightToKg: r.weightToKg,
      valueCents: r.valueCents,
    })),
    selectedSurcharges: selectedSurcharges.map((s) => ({ type: s.type, valueCents: s.valueCents })),
    realWeightKg,
    volumeM3,
    distanceKm: null,
    subtotalCents,
  });
}
