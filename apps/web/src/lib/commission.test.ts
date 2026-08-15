import { describe, expect, it } from "vitest";
import { calculateCommissionCents } from "./commission";

describe("calculateCommissionCents", () => {
  it("calculates a straightforward percentage", () => {
    expect(calculateCommissionCents(10000, 5)).toBe(500);
  });

  it("rounds to the nearest cent", () => {
    expect(calculateCommissionCents(999, 5)).toBe(50); // 49.95 -> 50
    expect(calculateCommissionCents(101, 5)).toBe(5); // 5.05 -> 5
  });

  it("returns 0 for a 0% commission", () => {
    expect(calculateCommissionCents(50000, 0)).toBe(0);
  });

  it("returns 0 for a 0 subtotal", () => {
    expect(calculateCommissionCents(0, 5)).toBe(0);
  });

  it("supports fractional percentages", () => {
    expect(calculateCommissionCents(100000, 2.5)).toBe(2500);
  });

  it("throws on a negative subtotal", () => {
    expect(() => calculateCommissionCents(-100, 5)).toThrow();
  });

  it("throws on a negative commission percent", () => {
    expect(() => calculateCommissionCents(100, -5)).toThrow();
  });
});
