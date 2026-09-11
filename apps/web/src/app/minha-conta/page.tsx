import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { FileText, Heart } from "lucide-react";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { BuyerOrderList } from "@/components/buyer-order-list";
import { ProductCard } from "@/components/product-card";
import { LogoutButton } from "@/components/logout-button";
import { formatCentsToBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getSignedInvoiceUrl } from "@/lib/storage";
import { getWishlistProducts } from "@/server/actions/wishlist-actions";

export const metadata: Metadata = { title: "Minha conta — Seu Zuca" };

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "pedidos", label: "Pedidos" },
  { key: "notas-fiscais", label: "Notas fiscais" },
];

const ONGOING_STATUSES = new Set(["pago", "em_separacao", "enviado"]);
const NEEDS_ACTION_STATUSES = new Set(["aguardando_pagamento", "enviado"]);

export default async function MyAccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireApprovedUser(["comprador"]);
  const { tab } = await searchParams;
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  const [orders, wishlistProducts] = await Promise.all([
    db.query.orders.findMany({
      where: eq(schema.orders.buyerId, user.id),
      orderBy: (o, { desc }) => [desc(o.createdAt)],
      with: { supplier: { with: { company: true } }, items: true },
    }),
    getWishlistProducts(user.id),
  ]);

  const ongoingCount = orders.filter((o) => ONGOING_STATUSES.has(o.status)).length;
  const needsActionCount = orders.filter((o) => NEEDS_ACTION_STATUSES.has(o.status)).length;
  const totalSpentCents = orders
    .filter((o) => o.status !== "cancelado")
    .reduce((sum, o) => sum + o.totalCents, 0);

  const invoicedOrders = orders
    .filter((o): o is typeof o & { invoiceUrl: string; invoiceUploadedAt: Date } => Boolean(o.invoiceUrl && o.invoiceUploadedAt))
    .sort((a, b) => b.invoiceUploadedAt.getTime() - a.invoiceUploadedAt.getTime());

  // Signed URLs expire quickly (10min default) — only generated for what this render actually
  // shows: the 3-item dashboard preview, or the full list on the "Notas fiscais" tab.
  const invoicesToSign = activeTab.key === "notas-fiscais" ? invoicedOrders : invoicedOrders.slice(0, 3);
  const signedInvoiceUrls = new Map(
    await Promise.all(invoicesToSign.map(async (o) => [o.id, await getSignedInvoiceUrl(o.invoiceUrl)] as const)),
  );

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Minha conta {user.company?.nomeFantasia ? `— ${user.company.nomeFantasia}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">Logado como {user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-8 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/minha-conta?tab=${t.key}`}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium",
              activeTab.key === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab.key === "dashboard" && (
        <div className="mt-6 space-y-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MetricCard label="Pedidos em andamento" value={ongoingCount} />
            <MetricCard label="Aguardando pagamento/ação" value={needsActionCount} />
            <MetricCard label="Total gasto" value={formatCentsToBRL(totalSpentCents)} hint="Exclui pedidos cancelados" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Favoritos</CardTitle>
                  <CardDescription>Para recomprar rápido</CardDescription>
                </div>
                <Link href="/favoritos" className="text-sm text-primary hover:underline">
                  Ver todos
                </Link>
              </CardHeader>
              <CardContent>
                {wishlistProducts.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                    <Heart className="size-8 text-muted-foreground/40" />
                    <p className="text-sm">Você ainda não favoritou nenhum produto.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {wishlistProducts.slice(0, 4).map((product) => (
                      <ProductCard key={product.slug} product={product} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Últimas notas fiscais</CardTitle>
                  <CardDescription>Anexadas pelo fornecedor após o pagamento</CardDescription>
                </div>
                <Link href="/minha-conta?tab=notas-fiscais" className="text-sm text-primary hover:underline">
                  Ver todas
                </Link>
              </CardHeader>
              <CardContent>
                {invoicedOrders.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                    <FileText className="size-8 text-muted-foreground/40" />
                    <p className="text-sm">Nenhuma nota fiscal disponível ainda.</p>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {invoicedOrders.slice(0, 3).map((order) => (
                      <li key={order.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{order.supplier.company?.nomeFantasia ?? "Fornecedor"}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.invoiceUploadedAt)}</p>
                        </div>
                        <a
                          href={signedInvoiceUrls.get(order.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Baixar
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab.key === "pedidos" && (
        <div className="mt-6">
          <BuyerOrderList orders={orders} />
        </div>
      )}

      {activeTab.key === "notas-fiscais" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">{invoicedOrders.length} nota(s) fiscal(is)</CardTitle>
            <CardDescription>Um arquivo por pedido, cobrindo todos os produtos daquele pedido.</CardDescription>
          </CardHeader>
          <CardContent>
            {invoicedOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <FileText className="size-10 text-muted-foreground/40" />
                <p>Nenhuma nota fiscal disponível ainda.</p>
                <p className="text-sm">O fornecedor anexa a nota fiscal após confirmar o pagamento do pedido.</p>
              </div>
            ) : (
              <ul className="divide-y">
                {invoicedOrders.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-foreground">{order.supplier.company?.nomeFantasia ?? "Fornecedor"}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.invoiceFileName} · anexada em {formatDate(order.invoiceUploadedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Link href={`/pedidos/${order.id}`} className="text-sm text-muted-foreground hover:text-foreground">
                        Ver pedido
                      </Link>
                      <a
                        href={signedInvoiceUrls.get(order.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Baixar NF
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
