/**
 * Pure freight calculation (SPEC.md §10, LOG-02). No DB/network access here so the business rule
 * is unit-testable in isolation — callers (cart, checkout) fetch the supplier's freight
 * configuration and the shipment's real weight/volume and hand them to calculateFreightCents.
 *
 * Distance-aware charge types (`por_km`, `por_km_kg`) need the route distance between the
 * supplier's origin and the buyer's address, which requires geocoding — SPEC.md §10, LOG-03, not
 * built yet. Every caller in this wave passes `distanceKm: null`. A range with a distance bound
 * can only ever match a known distance, so until LOG-03 lands: only ranges left fully unbounded on
 * the distance axis are reachable, and pure per-km rates (which need a distance to multiply by)
 * contribute zero base value — `minFreightCents` is what keeps those quotes from being R$ 0,00 in
 * the meantime, exactly like the "raio" coverage kind's documented fallback in LOG-01.
 */

export type FreightChargeType = "fixo" | "por_km" | "por_kg" | "por_km_kg";

export const FREIGHT_SURCHARGE_TYPES = [
  "descarga",
  "munck",
  "ajudante",
  "andar",
  "fim_de_semana",
  "dificil_acesso",
  "pedagio",
] as const;

export type FreightSurchargeType = (typeof FREIGHT_SURCHARGE_TYPES)[number];

export type FreightRuleInput = {
  chargeType: FreightChargeType;
  cubicFactorKgPerM3: number;
  minFreightCents: number;
  freeShippingMinSubtotalCents: number | null;
  freeShippingMaxWeightKg: number | null;
};

export type FreightRangeInput = {
  distanceFromKm: number | null;
  distanceToKm: number | null;
  weightFromKg: number | null;
  weightToKg: number | null;
  valueCents: number;
};

export type FreightSurchargeInput = {
  type: FreightSurchargeType;
  valueCents: number;
};

export type FreightQuoteInput = {
  rule: FreightRuleInput;
  ranges: FreightRangeInput[];
  /** Surcharges available on the rule, filtered to the ones the buyer selected for this order. */
  selectedSurcharges: FreightSurchargeInput[];
  realWeightKg: number;
  volumeM3: number;
  distanceKm: number | null;
  subtotalCents: number;
};

export type FreightBreakdownLine = { label: string; valueCents: number };

export type FreightBreakdown = {
  totalCents: number;
  freeShippingApplied: boolean;
  chargeableWeightKg: number;
  /** Auditable composition, in display order: base charge, then each applied surcharge, then a
   * free-shipping discount line when applicable (SPEC.md §10 — "nunca só o total"). */
  lines: FreightBreakdownLine[];
};

const SURCHARGE_LABELS: Record<FreightSurchargeType, string> = {
  descarga: "Descarga",
  munck: "Munck",
  ajudante: "Ajudante",
  andar: "Andar (sem elevador)",
  fim_de_semana: "Entrega em fim de semana",
  dificil_acesso: "Difícil acesso",
  pedagio: "Pedágio",
};

export function surchargeLabel(type: FreightSurchargeType): string {
  return SURCHARGE_LABELS[type];
}

/** The greater of real weight and volumetric ("cubed") weight — a low-density, bulky shipment is
 * billed by the space it takes up rather than its actual weight. */
export function calculateChargeableWeightKg(realWeightKg: number, volumeM3: number, cubicFactorKgPerM3: number): number {
  return Math.max(realWeightKg, volumeM3 * cubicFactorKgPerM3);
}

function withinBounds(value: number, from: number | null, to: number | null): boolean {
  if (from !== null && value < from) return false;
  if (to !== null && value > to) return false;
  return true;
}

function rangeMatches(range: FreightRangeInput, chargeableWeightKg: number, distanceKm: number | null): boolean {
  const weightOk = withinBounds(chargeableWeightKg, range.weightFromKg, range.weightToKg);
  // distanceKm === null is the pre-LOG-03 reality for every quote today: a range with any
  // distance bound configured is simply unreachable until a real distance exists to compare
  // against, rather than guessing which band an unknown distance "should" fall into.
  const distanceOk =
    distanceKm === null ? range.distanceFromKm === null && range.distanceToKm === null : withinBounds(distanceKm, range.distanceFromKm, range.distanceToKm);
  return weightOk && distanceOk;
}

export function calculateFreightCents(input: FreightQuoteInput): FreightBreakdown {
  const { rule, ranges, selectedSurcharges, realWeightKg, volumeM3, distanceKm, subtotalCents } = input;
  const chargeableWeightKg = calculateChargeableWeightKg(realWeightKg, volumeM3, rule.cubicFactorKgPerM3);

  const freeByValue = rule.freeShippingMinSubtotalCents !== null && subtotalCents >= rule.freeShippingMinSubtotalCents;
  const freeByWeight = rule.freeShippingMaxWeightKg !== null && chargeableWeightKg <= rule.freeShippingMaxWeightKg;
  if (freeByValue || freeByWeight) {
    return {
      totalCents: 0,
      freeShippingApplied: true,
      chargeableWeightKg,
      lines: [{ label: "Frete grátis", valueCents: 0 }],
    };
  }

  const matched = ranges.find((r) => rangeMatches(r, chargeableWeightKg, distanceKm)) ?? null;

  let baseCents = 0;
  if (matched) {
    if (rule.chargeType === "fixo") {
      baseCents = matched.valueCents;
    } else if (rule.chargeType === "por_kg") {
      baseCents = Math.round(matched.valueCents * chargeableWeightKg);
    } else if (rule.chargeType === "por_km" && distanceKm !== null) {
      baseCents = Math.round(matched.valueCents * distanceKm);
    } else if (rule.chargeType === "por_km_kg" && distanceKm !== null) {
      baseCents = Math.round(matched.valueCents * distanceKm * chargeableWeightKg);
    }
    // por_km / por_km_kg with distanceKm === null: baseCents stays 0 — see file header. The
    // matched range's distance bounds are guaranteed null in that case (rangeMatches above), so
    // there's no rate to apply without a distance to multiply it by.
  }

  const baseAfterFloor = Math.max(baseCents, rule.minFreightCents);
  const lines: FreightBreakdownLine[] = [{ label: "Frete base", valueCents: baseAfterFloor }];

  let totalCents = baseAfterFloor;
  for (const surcharge of selectedSurcharges) {
    totalCents += surcharge.valueCents;
    lines.push({ label: surchargeLabel(surcharge.type), valueCents: surcharge.valueCents });
  }

  return { totalCents, freeShippingApplied: false, chargeableWeightKg, lines };
}
