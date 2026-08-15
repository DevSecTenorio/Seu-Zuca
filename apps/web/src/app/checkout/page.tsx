import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCartForBuyer } from "@/server/queries/cart";
import { listCompanyAddresses } from "@/server/actions/address-actions";
import { calculateShippingCents } from "@/lib/shipping";
import { formatCentsToBRL } from "@/lib/format";
import { CheckoutForm } from "./checkout-form";

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

  let grandTotalCents = 0;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-foreground">Checkout</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <CheckoutForm addresses={addresses} />

        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="text-base">Resumo do pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from(bySupplier.entries()).map(([supplierId, supplierItems]) => {
              const subtotalCents = supplierItems.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);
              const shippingCents = calculateShippingCents(subtotalCents);
              grandTotalCents += subtotalCents + shippingCents;
              return (
                <div key={supplierId} className="border-b pb-3 text-sm last:border-0">
                  <p className="font-medium text-foreground">{supplierItems[0].product.supplier.company?.nomeFantasia}</p>
                  {supplierItems.map((item) => (
                    <div key={item.id} className="mt-1 flex justify-between text-muted-foreground">
                      <span className="truncate pr-2">
                        {item.quantity}x {item.product.name}
                      </span>
                      <span className="shrink-0">{formatCentsToBRL(item.product.priceCents * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between text-muted-foreground">
                    <span>Frete</span>
                    <span>{shippingCents === 0 ? "Grátis" : formatCentsToBRL(shippingCents)}</span>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatCentsToBRL(grandTotalCents)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
