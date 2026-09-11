import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCentsToBRL, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

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

export type BuyerOrderSummary = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  supplier: { company: { nomeFantasia: string } | null };
  items: { id: string }[];
};

/** Shared between /pedidos and the "Pedidos" tab of /minha-conta. */
export function BuyerOrderList({ orders }: { orders: BuyerOrderSummary[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <PackageSearch className="size-10 text-muted-foreground/40" />
        <p>Você ainda não fez nenhum pedido.</p>
        <Link href="/catalogo" className="text-primary hover:underline">
          Explorar catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
  );
}
