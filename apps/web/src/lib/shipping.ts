/**
 * MVP shipping model (SPEC.md §5 explicitly leaves this open: "valor informado por fornecedor
 * por pedido ou tabela simples — decidir e documentar"). Per-supplier freight tables aren't in
 * the data model, so this is a simple flat rule per order (i.e. per supplier, since checkout
 * splits into one order per supplier): free above a threshold, flat fee below it. Revisit with a
 * real carrier/rate integration post-MVP (see ROADMAP.md backlog).
 */
const FREE_SHIPPING_THRESHOLD_CENTS = 50000; // R$ 500,00
const FLAT_SHIPPING_CENTS = 2990; // R$ 29,90

export function calculateShippingCents(orderSubtotalCents: number): number {
  return orderSubtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
}
