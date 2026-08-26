import { describe, expect, it } from "vitest";
import { geodesicRouteEstimateKm, haversineDistanceKm } from "./distance";

// São Paulo (Sé) and Rio de Janeiro (Centro) — well-known straight-line distance ~357km.
const SAO_PAULO = { lat: -23.5505, lng: -46.6333 };
const RIO_DE_JANEIRO = { lat: -22.9068, lng: -43.1729 };

describe("haversineDistanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistanceKm(SAO_PAULO, SAO_PAULO)).toBe(0);
  });

  it("matches the known straight-line distance between São Paulo and Rio de Janeiro", () => {
    const distance = haversineDistanceKm(SAO_PAULO, RIO_DE_JANEIRO);
    expect(distance).toBeGreaterThan(350);
    expect(distance).toBeLessThan(365);
  });

  it("is symmetric", () => {
    expect(haversineDistanceKm(SAO_PAULO, RIO_DE_JANEIRO)).toBeCloseTo(haversineDistanceKm(RIO_DE_JANEIRO, SAO_PAULO), 6);
  });
});

describe("geodesicRouteEstimateKm", () => {
  it("scales the geodesic distance by the correction factor", () => {
    const geodesic = haversineDistanceKm(SAO_PAULO, RIO_DE_JANEIRO);
    expect(geodesicRouteEstimateKm(SAO_PAULO, RIO_DE_JANEIRO, 1.3)).toBeCloseTo(geodesic * 1.3, 6);
  });

  it("a correction factor of 1 is just the geodesic distance", () => {
    const geodesic = haversineDistanceKm(SAO_PAULO, RIO_DE_JANEIRO);
    expect(geodesicRouteEstimateKm(SAO_PAULO, RIO_DE_JANEIRO, 1)).toBeCloseTo(geodesic, 9);
  });
});
