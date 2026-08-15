import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getCartForBuyer } from "@/server/queries/cart";
import { calculateShippingCents } from "@/lib/shipping";
import { formatCentsToBRL } from "@/lib/format";
import { CartItemRow } from "./cart-item-row";

export const metadata: Metadata = { title: "Carrinho — Seu Zuca" };

const ROLE_LABELS: Record<string, string> = {
  admin: "Administradores",
  suporte: "Contas de suporte",
  fornecedor: "Contas de fornecedor",
};

export default async function CartPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <ShoppingCart className="size-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Entre para ver seu carrinho</h1>
        <div className="mt-6 flex gap-3">
          <Button asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/cadastro">Criar conta B2B</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (user.role !== "comprador") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <ShoppingCart className="size-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Carrinho indisponível</h1>
        <p className="mt-2 text-muted-foreground">
          {ROLE_LABELS[user.role] ?? "Esta conta"} não possuem carrinho de compras. Apenas contas de
          comprador podem finalizar pedidos.
        </p>
      </div>
    );
  }

  const items = await getCartForBuyer(user.id);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <ShoppingCart className="size-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Seu carrinho está vazio</h1>
        <Button asChild className="mt-6">
          <Link href="/catalogo">Ver catálogo</Link>
        </Button>
      </div>
    );
  }

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
      <h1 className="text-2xl font-semibold text-foreground">Carrinho</h1>

      <div className="mt-6 space-y-6">
        {Array.from(bySupplier.values()).map((supplierItems) => {
          const supplier = supplierItems[0].product.supplier;
          const subtotalCents = supplierItems.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);
          const shippingCents = calculateShippingCents(subtotalCents);
          grandTotalCents += subtotalCents + shippingCents;

          return (
            <Card key={supplier.id}>
              <CardHeader>
                <CardTitle className="text-base">{supplier.company?.nomeFantasia ?? "Fornecedor"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  {supplierItems.map((item) => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      minQuantity={item.product.category.minQuantityRule?.minQuantity ?? 1}
                      multiple={item.product.category.minQuantityRule?.multiple ?? 1}
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-8 pt-4 text-sm">
                  <span className="text-muted-foreground">Subtotal: {formatCentsToBRL(subtotalCents)}</span>
                  <span className="text-muted-foreground">
                    Frete: {shippingCents === 0 ? "Grátis" : formatCentsToBRL(shippingCents)}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-end gap-3 border-t pt-6">
        <p className="text-lg font-semibold text-foreground">Total: {formatCentsToBRL(grandTotalCents)}</p>
        <p className="text-sm text-muted-foreground">
          Seu pedido será dividido em {bySupplier.size} pedido{bySupplier.size > 1 ? "s" : ""}, um por fornecedor.
        </p>
        <Button asChild size="lg">
          <Link href="/checkout">Continuar para o checkout</Link>
        </Button>
      </div>
    </div>
  );
}
