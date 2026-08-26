import { describe, expect, it } from "vitest";
import { generatePickupCode } from "./pickup-code";

describe("generatePickupCode", () => {
  it("matches the XXXX-XXXX shape, using only the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePickupCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    }
  });

  it("never contains visually ambiguous characters (0, O, 1, I, L)", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePickupCode()).not.toMatch(/[01ILO]/);
    }
  });

  it("is not the same on every call", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generatePickupCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
