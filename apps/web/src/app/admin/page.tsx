import type { Metadata } from "next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { db, schema } from "@/db";
import { and, eq, ne, count } from "drizzle-orm";
import { formatCentsToBRL } from "@/lib/format";

export const metadata: Metadata = {
  title: "Painel do Administrador — Seu Zuca",
};

export default async function AdminOverviewPage() {
  await requireUser(["admin"]);

  const [[buyers], [suppliers], [totalOrders], [pendingOrders], revenueOrders] = await Promise.all([
    db.select({ value: count() }).from(schema.users).where(and(eq(schema.users.role, "comprador"), eq(schema.users.status, "aprovado"))),
    db.select({ value: count() }).from(schema.users).where(and(eq(schema.users.role, "fornecedor"), eq(schema.users.status, "aprovado"))),
    db.select({ value: count() }).from(schema.orders),
    db.select({ value: count() }).from(schema.orders).where(eq(schema.orders.status, "aguardando_pagamento")),
    db
      .select({ totalCents: schema.orders.totalCents, commissionCents: schema.orders.commissionCents })
      .from(schema.orders)
      .where(ne(schema.orders.status, "cancelado")),
  ]);

  const gmvCents = revenueOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const commissionCents = revenueOrders.reduce((sum, o) => sum + o.commissionCents, 0);

  const cards = [
    { label: "Compradores aprovados", value: buyers.value },
    { label: "Fornecedores ativos", value: suppliers.value },
    { label: "Total de pedidos", value: totalOrders.value },
    { label: "GMV total", value: formatCentsToBRL(gmvCents) },
    { label: "Pedidos pendentes", value: pendingOrders.value },
    { label: "Comissões geradas", value: formatCentsToBRL(commissionCents) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-3xl">{card.value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
