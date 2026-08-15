export type QuantityRule = { minQuantity: number; multiple: number };

export type QuantityValidation = { valid: true } | { valid: false; reason: string };

/**
 * A quantity is valid when it's at least minQuantity and reachable from minQuantity in whole
 * steps of `multiple` — i.e. minQuantity, minQuantity + multiple, minQuantity + 2*multiple, ...
 * This mirrors the native `<input type="number" min max step>` stepper semantics used in the
 * product page's quantity selector (src/app/produto/[slug]/buy-box.tsx), so the UI and the
 * server-side check agree on what counts as valid without the user ever seeing a mismatch.
 */
export function validateQuantity(quantity: number, rule: QuantityRule): QuantityValidation {
  const { minQuantity, multiple } = rule;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { valid: false, reason: "Quantidade inválida." };
  }
  if (quantity < minQuantity) {
    return { valid: false, reason: `Quantidade mínima é ${minQuantity}.` };
  }
  if ((quantity - minQuantity) % multiple !== 0) {
    return {
      valid: false,
      reason: `Quantidade deve respeitar múltiplos de ${multiple} a partir do mínimo de ${minQuantity}.`,
    };
  }
  return { valid: true };
}

/** Smallest valid quantity at or above `atLeast` — used to re-snap a cart line when its category
 * min/multiple rule changes after the item was added. */
export function nearestValidQuantity(atLeast: number, rule: QuantityRule): number {
  const { minQuantity, multiple } = rule;
  if (atLeast <= minQuantity) return minQuantity;
  const steps = Math.ceil((atLeast - minQuantity) / multiple);
  return minQuantity + steps * multiple;
}
