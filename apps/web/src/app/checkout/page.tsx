import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { getCartForBuyer } from "@/server/queries/cart";
import { listCompanyAddresses } from "@/server/actions/address-actions";
import { getSupplierFreightConfig, shipmentWeightAndVolume } from "@/server/queries/freight";
import { CheckoutForm } from "./checkout-form";
import { OrderSummary, type CheckoutSupplierGroup } from "./order-summary";

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
      const rule = await getSupplierFreightConfig(supplierId);
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
          }
        : null;

      return {
        supplierId,
        supplierName: supplierItems[0].product.supplier.company?.nomeFantasia ?? "Fornecedor",
        items: supplierItems.map((i) => ({ id: i.id, name: i.product.name, quantity: i.quantity, priceCents: i.product.priceCents })),
        subtotalCents,
        freight,
      };
    }),
  );

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-foreground">Checkout</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <CheckoutForm addresses={addresses} />
        <OrderSummary groups={groups} formId="checkout-form" />
      </div>
    </div>
  );
}
