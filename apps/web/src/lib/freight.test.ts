import { describe, expect, it } from "vitest";
import { calculateChargeableWeightKg, calculateFreightCents, type FreightRuleInput, type FreightRangeInput } from "./freight";

function rule(overrides: Partial<FreightRuleInput>): FreightRuleInput {
  return {
    chargeType: "fixo",
    cubicFactorKgPerM3: 300,
    minFreightCents: 0,
    freeShippingMinSubtotalCents: null,
    freeShippingMaxWeightKg: null,
    ...overrides,
  };
}

describe("calculateChargeableWeightKg", () => {
  it("uses real weight when it's the larger figure", () => {
    expect(calculateChargeableWeightKg(50, 0.01, 300)).toBe(50);
  });

  it("uses cubic (volumetric) weight when the shipment is bulky but light", () => {
    // 1 m³ at 300 kg/m³ = 300 kg cubic weight, vs. 20 kg real.
    expect(calculateChargeableWeightKg(20, 1, 300)).toBe(300);
  });
});

describe("calculateFreightCents", () => {
  const noSurcharges: FreightRangeInput[] = [];

  it("charges the flat range value for chargeType=fixo", () => {
    const ranges: FreightRangeInput[] = [
      { distanceFromKm: null, distanceToKm: null, weightFromKg: null, weightToKg: null, valueCents: 3000 },
    ];
    const result = calculateFreightCents({
      rule: rule({ chargeType: "fixo" }),
      ranges,
      selectedSurcharges: [],
      realWeightKg: 10,
      volumeM3: 0.01,
      distanceKm: null,
      subtotalCents: 10000,
    });
    expect(result.totalCents).toBe(3000);
    expect(result.freeShippingApplied).toBe(false);
  });

  it("picks the matching weight band for chargeType=por_kg and multiplies by chargeable weight", () => {
    const ranges: FreightRangeInput[] = [
      { distanceFromKm: null, distanceToKm: null, weightFromKg: 0, weightToKg: 50, valueCents: 200 },
      { distanceFromKm: null, distanceToKm: null, weightFromKg: 50, weightToKg: null, valueCents: 150 },
    ];
    const light = calculateFreightCents({
      rule: rule({ chargeType: "por_kg" }),
      ranges,
      selectedSurcharges: [],
      realWeightKg: 30,
      volumeM3: 0,
      distanceKm: null,
      subtotalCents: 0,
    });
    expect(light.totalCents).toBe(30 * 200);

    const heavy = calculateFreightCents({
      rule: rule({ chargeType: "por_kg" }),
      ranges,
      selectedSurcharges: [],
      realWeightKg: 80,
      volumeM3: 0,
      distanceKm: null,
      subtotalCents: 0,
    });
    expect(heavy.totalCents).toBe(80 * 150);
  });

  it("falls back to the minimum floor for distance-based charge types while distanceKm is unknown (pre-LOG-03)", () => {
    const ranges: FreightRangeInput[] = [
      { distanceFromKm: 0, distanceToKm: 100, weightFromKg: null, weightToKg: null, valueCents: 500 },
    ];
    const result = calculateFreightCents({
      rule: rule({ chargeType: "por_km", minFreightCents: 4990 }),
      ranges,
      selectedSurcharges: [],
      realWeightKg: 10,
      volumeM3: 0,
      distanceKm: null,
      subtotalCents: 0,
    });
    // The range has a distance bound, so it can't match a null distance — base is 0 and the floor
    // takes over. This never silently charges R$ 0,00.
    expect(result.totalCents).toBe(4990);
  });

  it("applies a por_km_kg rate once distance is known", () => {
    const ranges: FreightRangeInput[] = [
      { distanceFromKm: 0, distanceToKm: 500, weightFromKg: 0, weightToKg: 1000, valueCents: 10 },
    ];
    const result = calculateFreightCents({
      rule: rule({ chargeType: "por_km_kg" }),
      ranges,
      selectedSurcharges: [],
      realWeightKg: 20,
      volumeM3: 0,
      distanceKm: 50,
      subtotalCents: 0,
    });
    expect(result.totalCents).toBe(10 * 50 * 20);
  });

  it("applies the minimum floor when the computed base is below it", () => {
    const ranges: FreightRangeInput[] = [
      { distanceFromKm: null, distanceToKm: null, weightFromKg: null, weightToKg: null, valueCents: 100 },
    ];
    const result = calculateFreightCents({
      rule: rule({ chargeType: "fixo", minFreightCents: 2500 }),
      ranges,
      selectedSurcharges: [],
      realWeightKg: 1,
      volumeM3: 0,
      distanceKm: null,
      subtotalCents: 0,
    });
    expect(result.totalCents).toBe(2500);
  });

  it("adds each selected surcharge as its own auditable line", () => {
    const result = calculateFreightCents({
      rule: rule({ chargeType: "fixo", minFreightCents: 3000 }),
      ranges: noSurcharges,
      selectedSurcharges: [
        { type: "ajudante", valueCents: 5000 },
        { type: "andar", valueCents: 2000 },
      ],
      realWeightKg: 1,
      volumeM3: 0,
      distanceKm: null,
      subtotalCents: 0,
    });
    expect(result.totalCents).toBe(3000 + 5000 + 2000);
    expect(result.lines).toEqual([
      { label: "Frete base", valueCents: 3000 },
      { label: "Ajudante", valueCents: 5000 },
      { label: "Andar (sem elevador)", valueCents: 2000 },
    ]);
  });

  it("grants free shipping when the subtotal meets the configured minimum", () => {
    const result = calculateFreightCents({
      rule: rule({ chargeType: "fixo", minFreightCents: 3000, freeShippingMinSubtotalCents: 50000 }),
      ranges: [{ distanceFromKm: null, distanceToKm: null, weightFromKg: null, weightToKg: null, valueCents: 9999 }],
      selectedSurcharges: [{ type: "pedagio", valueCents: 1000 }],
      realWeightKg: 1,
      volumeM3: 0,
      distanceKm: null,
      subtotalCents: 50000,
    });
    expect(result.totalCents).toBe(0);
    expect(result.freeShippingApplied).toBe(true);
  });

  it("grants free shipping when the chargeable weight is at or under the configured maximum", () => {
    const result = calculateFreightCents({
      rule: rule({ freeShippingMaxWeightKg: 20 }),
      ranges: [{ distanceFromKm: null, distanceToKm: null, weightFromKg: null, weightToKg: null, valueCents: 9999 }],
      selectedSurcharges: [],
      realWeightKg: 20,
      volumeM3: 0,
      distanceKm: null,
      subtotalCents: 0,
    });
    expect(result.freeShippingApplied).toBe(true);
  });

  it("does not grant free shipping when neither condition is met", () => {
    const result = calculateFreightCents({
      rule: rule({ freeShippingMinSubtotalCents: 50000, freeShippingMaxWeightKg: 5 }),
      ranges: [{ distanceFromKm: null, distanceToKm: null, weightFromKg: null, weightToKg: null, valueCents: 4000 }],
      selectedSurcharges: [],
      realWeightKg: 10,
      volumeM3: 0,
      distanceKm: null,
      subtotalCents: 10000,
    });
    expect(result.freeShippingApplied).toBe(false);
    expect(result.totalCents).toBe(4000);
  });
});
