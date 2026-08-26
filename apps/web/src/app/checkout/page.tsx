import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { getCartForBuyer } from "@/server/queries/cart";
import { listCompanyAddresses } from "@/server/actions/address-actions";
import { getSupplierFreightConfig, resolveSupplierDistanceKm, shipmentWeightAndVolume } from "@/server/queries/freight";
import { getActiveSupplierPickupLocations } from "@/server/queries/pickup";
import { CheckoutClient } from "./checkout-client";
import type { CheckoutSupplierGroup } from "./order-summary";

export const metadata: Metadata = { title: "Checkout — Seu Zuca" };

export default async function CheckoutPage() {
  const user = await requireApprovedUser(["comprador"]);
  if (!user.company) redirect("/");

  const [items, addresses] = await Promise.all([
    getCartForBuyer(user.id),
    listCompanyAddresses(user.company.id),
  ]);

  if (items.length === 0) redirect("/carrinho");

  const bySupplier = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.product.supplierId;
    const list = bySupplier.get(key) ?? [];
    list.push(item);
    bySupplier.set(key, list);
  }

  const groups: CheckoutSupplierGroup[] = await Promise.all(
    Array.from(bySupplier.entries()).map(async ([supplierId, supplierItems]) => {
      const subtotalCents = supplierItems.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);
      const [rule, pickupLocations] = await Promise.all([
        getSupplierFreightConfig(supplierId),
        getActiveSupplierPickupLocations(supplierId),
      ]);
      const freight = rule
        ? {
            rule: {
              chargeType: rule.chargeType,
              cubicFactorKgPerM3: rule.cubicFactorKgPerM3,
              minFreightCents: rule.minFreightCents,
              freeShippingMinSubtotalCents: rule.freeShippingMinSubtotalCents,
              freeShippingMaxWeightKg: rule.freeShippingMaxWeightKg,
            },
            ranges: rule.ranges.map((r) => ({
              distanceFromKm: r.distanceFromKm,
              distanceToKm: r.distanceToKm,
              weightFromKg: r.weightFromKg,
              weightToKg: r.weightToKg,
              valueCents: r.valueCents,
            })),
            availableSurcharges: rule.surcharges.filter((s) => s.active).map((s) => ({ type: s.type, valueCents: s.valueCents })),
            ...shipmentWeightAndVolume(
              supplierItems.map((i) => ({
                weightGrams: i.product.weightGrams,
                lengthCm: i.product.lengthCm,
                widthCm: i.product.widthCm,
                heightCm: i.product.heightCm,
                quantity: i.quantity,
              })),
            ),
            // One distance per address on file (SPEC.md §10, LOG-03) — few enough addresses that
            // precomputing all of them server-side beats a round-trip every time the buyer
            // switches which one they're shipping to.
            distanceKmByAddressId: Object.fromEntries(
              await Promise.all(
                addresses.map(async (a) => [
                  a.id,
                  await resolveSupplierDistanceKm(supplierId, a.latitude !== null && a.longitude !== null ? { lat: a.latitude, lng: a.longitude } : null),
                ] as const),
              ),
            ),
          }
        : null;

      return {
        supplierId,
        supplierName: supplierItems[0].product.supplier.company?.nomeFantasia ?? "Fornecedor",
        items: supplierItems.map((i) => ({ id: i.id, name: i.product.name, quantity: i.quantity, priceCents: i.product.priceCents })),
        subtotalCents,
        freight,
        pickupLocations: pickupLocations.map((l) => ({
          id: l.id,
          label: l.label,
          logradouro: l.logradouro,
          numero: l.numero,
          complemento: l.complemento,
          bairro: l.bairro,
          cidade: l.cidade,
          estado: l.estado,
          horarioFuncionamento: l.horarioFuncionamento,
          prazoDisponibilizacaoDias: l.prazoDisponibilizacaoDias,
          documentoExigido: l.documentoExigido,
        })),
      };
    }),
  );

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-foreground">Checkout</h1>
      <CheckoutClient addresses={addresses} groups={groups} />
    </div>
  );
}
