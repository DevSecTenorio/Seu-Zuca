import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { PackageSearch } from "lucide-react";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCentsToBRL, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

export const metadata: Metadata = { title: "Meus pedidos — Seu Zuca" };

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  aguardando_pagamento: "outline",
  pago: "default",
  em_separacao: "default",
  enviado: "default",
  entregue: "secondary",
  cancelado: "destructive",
  em_disputa: "destructive",
  devolvido: "secondary",
};

export default async function OrdersPage() {
  const user = await requireApprovedUser(["comprador"]);

  const orders = await db.query.orders.findMany({
    where: eq(schema.orders.buyerId, user.id),
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    with: { supplier: { with: { company: true } }, items: true },
  });

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-foreground">Meus pedidos</h1>

      {orders.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <PackageSearch className="size-10 text-muted-foreground/40" />
          <p>Você ainda não fez nenhum pedido.</p>
          <Link href="/catalogo" className="text-primary hover:underline">
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/pedidos/${order.id}`}>
              <Card className="transition-colors hover:border-primary">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium text-foreground">{order.supplier.company?.nomeFantasia ?? "Fornecedor"}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.items.length} ite{order.items.length > 1 ? "ns" : "m"} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{formatCentsToBRL(order.totalCents)}</span>
                    <Badge variant={STATUS_VARIANT[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
