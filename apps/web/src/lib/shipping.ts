/**
 * Fallback shipping model, used only for a supplier who hasn't configured a freight rule yet
 * (SPEC.md §10, LOG-02, in src/lib/freight.ts): free above a threshold, flat fee below it. Kept
 * so a supplier's catalog doesn't go from "has a shipping cost" to "ships free" the moment LOG-02
 * shipped, before they've had a chance to set up real rates.
 */
const FREE_SHIPPING_THRESHOLD_CENTS = 50000; // R$ 500,00
const FLAT_SHIPPING_CENTS = 2990; // R$ 29,90

export function calculateShippingCents(orderSubtotalCents: number): number {
  return orderSubtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
}
