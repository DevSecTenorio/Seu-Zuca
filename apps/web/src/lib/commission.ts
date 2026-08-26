export const DEFAULT_COMMISSION_PERCENT = 5;
export const DEFAULT_COMMISSION_BASE: CommissionBase = "mercadoria";

export type CommissionBase = "mercadoria" | "mercadoria_frete";

/**
 * Commission is calculated on a base amount — the order subtotal alone, or subtotal + shipping,
 * depending on the admin-configurable `commission_base` setting (SPEC.md §9, decided 2026-08-25)
 * — and frozen onto the order at creation time — orders.commissionPercent/commissionCents
 * (SPEC.md §5) — so a later change to either platform-wide setting never retroactively changes
 * historical orders.
 */
export function calculateCommissionCents(baseCents: number, commissionPercent: number): number {
  if (baseCents < 0) throw new Error("baseCents não pode ser negativo");
  if (commissionPercent < 0) throw new Error("commissionPercent não pode ser negativo");
  return Math.round(baseCents * (commissionPercent / 100));
}

/** Resolves the cents amount commission is calculated over, given the configured base. */
export function commissionBaseCents(subtotalCents: number, shippingCents: number, base: CommissionBase): number {
  return base === "mercadoria_frete" ? subtotalCents + shippingCents : subtotalCents;
}
