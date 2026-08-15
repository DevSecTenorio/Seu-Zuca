import { describe, expect, it } from "vitest";
import { nearestValidQuantity, validateQuantity } from "./quantity-rules";

const CIMENTO_RULE = { minQuantity: 50, multiple: 10 };
const DEFAULT_RULE = { minQuantity: 1, multiple: 1 };

describe("validateQuantity", () => {
  it("accepts the exact minimum", () => {
    expect(validateQuantity(50, CIMENTO_RULE)).toEqual({ valid: true });
  });

  it("accepts a minimum plus whole multiples", () => {
    expect(validateQuantity(60, CIMENTO_RULE)).toEqual({ valid: true });
    expect(validateQuantity(120, CIMENTO_RULE)).toEqual({ valid: true });
  });

  it("rejects below the minimum", () => {
    const result = validateQuantity(40, CIMENTO_RULE);
    expect(result.valid).toBe(false);
  });

  it("rejects a quantity that isn't a whole step above the minimum", () => {
    const result = validateQuantity(55, CIMENTO_RULE);
    expect(result.valid).toBe(false);
  });

  it("rejects zero and negative quantities", () => {
    expect(validateQuantity(0, DEFAULT_RULE).valid).toBe(false);
    expect(validateQuantity(-5, DEFAULT_RULE).valid).toBe(false);
  });

  it("rejects non-integer quantities", () => {
    expect(validateQuantity(1.5, DEFAULT_RULE).valid).toBe(false);
  });

  it("accepts any positive integer under the default (1, 1) rule", () => {
    expect(validateQuantity(1, DEFAULT_RULE).valid).toBe(true);
    expect(validateQuantity(37, DEFAULT_RULE).valid).toBe(true);
  });
});

describe("nearestValidQuantity", () => {
  it("snaps up to the minimum when below it", () => {
    expect(nearestValidQuantity(10, CIMENTO_RULE)).toBe(50);
  });

  it("returns the same value when already valid", () => {
    expect(nearestValidQuantity(70, CIMENTO_RULE)).toBe(70);
  });

  it("snaps up to the next valid step when between steps", () => {
    expect(nearestValidQuantity(65, CIMENTO_RULE)).toBe(70);
  });
});
