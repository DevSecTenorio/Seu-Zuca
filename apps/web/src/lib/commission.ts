export const DEFAULT_COMMISSION_PERCENT = 5;

/**
 * Commission is calculated on the order subtotal (before shipping) and frozen onto the order at
 * creation time — orders.commissionPercent/commissionCents (SPEC.md §5) — so a later change to
 * the platform-wide setting never retroactively changes historical orders.
 */
export function calculateCommissionCents(subtotalCents: number, commissionPercent: number): number {
  if (subtotalCents < 0) throw new Error("subtotalCents não pode ser negativo");
  if (commissionPercent < 0) throw new Error("commissionPercent não pode ser negativo");
  return Math.round(subtotalCents * (commissionPercent / 100));
}
