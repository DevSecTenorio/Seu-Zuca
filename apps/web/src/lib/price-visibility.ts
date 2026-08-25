import "server-only";
import type { AuthenticatedUser } from "@/lib/auth/session";

/**
 * SPEC.md "Visibilidade de preço": only an approved comprador may see product prices anywhere
 * in the storefront. Everyone else — anonymous visitors, pending/rejected/suspended accounts,
 * fornecedor, suporte, admin — sees the product but not its price.
 */
export function canViewPrices(user: AuthenticatedUser | null): boolean {
  return user?.role === "comprador" && user?.status === "aprovado";
}

/**
 * Strips `priceCents` from a product object when the viewer isn't authorized to see it. The key
 * is removed via destructuring, not set to null — so when `canView` is false, the field is
 * genuinely absent from what this function returns, which means it's absent from the RSC payload
 * serialized to the client too. Callers must not fetch the price a different way and hide it
 * client-side; this is the one point where that decision is made, server-side, before the data
 * ever leaves this function.
 */
export function withPriceVisibility<T extends { priceCents: number }>(
  product: T,
  canView: boolean,
): Omit<T, "priceCents"> & { priceCents?: number } {
  if (canView) return product;
  const { priceCents: _priceCents, ...rest } = product;
  return rest;
}
