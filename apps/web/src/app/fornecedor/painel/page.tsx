import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogoutButton } from "@/components/logout-button";
import { MetricCard } from "@/components/metric-card";
import { FinancialChart } from "@/components/financial-chart";
import { PeriodSelect } from "@/components/period-select";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { formatCentsToBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, canTransition, type OrderStatus } from "@/lib/order-status";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deactivateOwnProductAction, reactivateOwnProductAction } from "@/server/actions/product-actions";
import { supplierAdvanceOrderAction, supplierConfirmPickupAction } from "@/server/actions/order-actions";
import { getFinancialAnalytics, PERIOD_LABELS, type AnalyticsPeriod } from "@/server/queries/analytics";
import { getSupplierCoverageAreas } from "@/server/queries/logistics";
import { getSupplierFreightConfig } from "@/server/queries/freight";
import { getSupplierPickupLocations } from "@/server/queries/pickup";
import { ShipOrderForm } from "./ship-order-form";
import { AttachInvoiceForm } from "./attach-invoice-form";
import { LogisticsTab } from "./logistics-tab";

export const metadata: Metadata = {
  title: "Painel do Fornecedor — Seu Zuca",
};

const STATUS_LABELS: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  ativo: "Ativo",
  rejeitado: "Rejeitado",
  inativo: "Inativo",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  aguardando_aprovacao: "outline",
  ativo: "default",
  rejeitado: "destructive",
  inativo: "secondary",
};

const ORDER_STATUS_BADGE_VARIANT: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  aguardando_pagamento: "outline",
  pago: "default",
  em_separacao: "default",
  enviado: "default",
  entregue: "secondary",
  cancelado: "destructive",
  em_disputa: "destructive",
  devolvido: "secondary",
};

const TABS = [
  { key: "produtos", label: "Produtos", implemented: true },
  { key: "pedidos", label: "Pedidos", implemented: true },
  { key: "analytics", label: "Analytics", implemented: true },
  { key: "relatorios", label: "Relatórios", implemented: true },
  { key: "logistica", label: "Logística", implemented: true },
];

const VALID_PERIODS: AnalyticsPeriod[] = ["7d", "30d", "3m", "6m"];

export default async function SupplierDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; periodo?: string }>;
}) {
  const user = await requireApprovedUser(["fornecedor"]);
  const { tab, periodo } = await searchParams;
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
  const period = VALID_PERIODS.includes(periodo as AnalyticsPeriod) ? (periodo as AnalyticsPeriod) : "30d";

  const products = await db.query.products.findMany({
    where: eq(schema.products.supplierId, user.id),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    with: { category: true, unit: true },
  });

  const orders =
    activeTab.key === "pedidos"
      ? await db.query.orders.findMany({
          where: eq(schema.orders.supplierId, user.id),
          orderBy: (o, { desc }) => [desc(o.createdAt)],
          with: { buyer: { with: { company: true } }, items: true },
        })
      : [];

  // pickup_codes has no drizzle relations() config against orders (would need a circular import
  // between db/schema/{orders,pickup}.ts for a relation this is the only caller of) — fetched
  // separately instead and merged by orderId.
  const pickupCodesByOrderId = new Map<string, { code: string; used: boolean }>();
  if (orders.some((o) => o.deliveryModality === "retirada")) {
    const codes = await db
      .select({ orderId: schema.pickupCodes.orderId, code: schema.pickupCodes.code, used: schema.pickupCodes.used })
      .from(schema.pickupCodes)
      .where(
        inArray(
          schema.pickupCodes.orderId,
          orders.filter((o) => o.deliveryModality === "retirada").map((o) => o.id),
        ),
      );
    for (const c of codes) pickupCodesByOrderId.set(c.orderId, c);
  }

  const [coverageAreas, allCategories, freightRule, pickupLocations] =
    activeTab.key === "logistica"
      ? await Promise.all([
          getSupplierCoverageAreas(user.id),
          db.query.categories.findMany({ orderBy: (c, { asc }) => [asc(c.name)] }),
          getSupplierFreightConfig(user.id),
          getSupplierPickupLocations(user.id),
        ])
      : [[], [], undefined, []];

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [allOrders, ordersThisMonth, analytics] = await Promise.all([
    db
      .select({ totalCents: schema.orders.totalCents, commissionCents: schema.orders.commissionCents })
      .from(schema.orders)
      .where(and(eq(schema.orders.supplierId, user.id), ne(schema.orders.status, "cancelado"))),
    db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(and(eq(schema.orders.supplierId, user.id), gte(schema.orders.createdAt, startOfMonth), ne(schema.orders.status, "cancelado"))),
    activeTab.key === "analytics" ? getFinancialAnalytics(period, user.id) : null,
  ]);
  const grossRevenueCents = allOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const commissionPaidCents = allOrders.reduce((sum, o) => sum + o.commissionCents, 0);
  const netRevenueCents = grossRevenueCents - commissionPaidCents;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Painel do fornecedor {user.company?.nomeFantasia ? `— ${user.company.nomeFantasia}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">Logado como {user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Pedidos (total)" value={allOrders.length} />
        <MetricCard label="Pedidos este mês" value={ordersThisMonth.length} />
        <MetricCard label="Faturamento bruto" value={formatCentsToBRL(grossRevenueCents)} />
        <MetricCard label="Faturamento líquido" value={formatCentsToBRL(netRevenueCents)} hint="Já descontada a comissão" />
      </div>

      <div className="mt-8 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.implemented ? `/fornecedor/painel?tab=${t.key}` : "#"}
            aria-disabled={!t.implemented}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium",
              !t.implemented && "pointer-events-none text-muted-foreground/50",
              activeTab.key === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {!t.implemented && <span className="ml-1 text-xs">(em breve)</span>}
          </Link>
        ))}
      </div>

      {activeTab.key === "produtos" && (
        <Card className="mt-6">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>{products.length} produtos</CardTitle>
              <CardDescription>Categoria sempre da árvore oficial; edições reabrem a moderação.</CardDescription>
            </div>
            <Button asChild>
              <Link href="/fornecedor/produtos/novo">Novo produto</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Você ainda não cadastrou produtos.{" "}
                <Link href="/fornecedor/produtos/novo" className="text-primary hover:underline">
                  Cadastre o primeiro
                </Link>
                .
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{product.name}</div>
                        <div className="text-xs text-muted-foreground">SKU {product.sku}</div>
                      </TableCell>
                      <TableCell>{product.category.name}</TableCell>
                      <TableCell>
                        {formatCentsToBRL(product.priceCents)}
                        <span className="text-muted-foreground">/{product.unit.abbreviation}</span>
                      </TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE_VARIANT[product.moderationStatus]}>
                          {STATUS_LABELS[product.moderationStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/fornecedor/produtos/${product.id}/editar`}>Editar</Link>
                          </Button>
                          {product.moderationStatus === "ativo" && (
                            <form
                              action={async () => {
                                "use server";
                                await deactivateOwnProductAction(product.id);
                              }}
                            >
                              <Button type="submit" variant="ghost" size="sm">
                                Desativar
                              </Button>
                            </form>
                          )}
                          {product.moderationStatus === "inativo" && (
                            <form
                              action={async () => {
                                "use server";
                                await reactivateOwnProductAction(product.id);
                              }}
                            >
                              <Button type="submit" variant="ghost" size="sm">
                                Reativar
                              </Button>
                            </form>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab.key === "pedidos" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{orders.length} pedidos</CardTitle>
            <CardDescription>Atualize o status conforme separa, envia e entrega cada pedido.</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido recebido ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-foreground">
                        {order.buyer.company?.nomeFantasia ?? order.buyer.email}
                      </TableCell>
                      <TableCell>{order.items.length}</TableCell>
                      <TableCell>{formatCentsToBRL(order.totalCents)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canTransition(order.status, "em_separacao", "fornecedor") && (
                          <form
                            action={async () => {
                              "use server";
                              await supplierAdvanceOrderAction(order.id, "em_separacao");
                            }}
                          >
                            <Button type="submit" size="sm">
                              Iniciar separação
                            </Button>
                          </form>
                        )}
                        {order.deliveryModality === "retirada" && order.status === "em_separacao" ? (
                          <div className="flex flex-col items-end gap-1">
                            {pickupCodesByOrderId.get(order.id) && (
                              <span className="font-mono text-xs text-muted-foreground">
                                Código: {pickupCodesByOrderId.get(order.id)!.code}
                              </span>
                            )}
                            <form
                              action={async () => {
                                "use server";
                                await supplierConfirmPickupAction(order.id);
                              }}
                            >
                              <ConfirmSubmitButton
                                size="sm"
                                confirmMessage="Confirmar que o comprador retirou o pedido e o código foi conferido?"
                              >
                                Confirmar retirada
                              </ConfirmSubmitButton>
                            </form>
                          </div>
                        ) : (
                          canTransition(order.status, "enviado", "fornecedor") && <ShipOrderForm orderId={order.id} />
                        )}
                        {canTransition(order.status, "entregue", "fornecedor") && (
                          <form
                            action={async () => {
                              "use server";
                              await supplierAdvanceOrderAction(order.id, "entregue");
                            }}
                          >
                            <Button type="submit" size="sm">
                              Marcar como entregue
                            </Button>
                          </form>
                        )}
                        {order.status !== "aguardando_pagamento" && order.status !== "cancelado" && (
                          <div className="mt-1 flex flex-col items-end gap-1">
                            {order.invoiceFileName && (
                              <span className="max-w-40 truncate text-xs text-muted-foreground" title={order.invoiceFileName}>
                                NF: {order.invoiceFileName}
                              </span>
                            )}
                            <AttachInvoiceForm orderId={order.id} hasInvoice={Boolean(order.invoiceUrl)} />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab.key === "analytics" && analytics && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Período: {PERIOD_LABELS[period]}</p>
            <PeriodSelect current={period} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Pedidos no período" value={analytics.totalOrders} />
            <MetricCard label="Faturamento no período" value={formatCentsToBRL(analytics.gmvCents)} />
            <MetricCard label="Comissão no período" value={formatCentsToBRL(analytics.commissionCents)} />
            <MetricCard
              label="Ticket médio"
              value={analytics.avgTicketCents !== null ? formatCentsToBRL(analytics.avgTicketCents) : null}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Vendas por período</CardTitle>
            </CardHeader>
            <CardContent>
              <FinancialChart series={analytics.series} />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab.key === "relatorios" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Relatórios</CardTitle>
            <CardDescription>Exportação de todos os seus pedidos em CSV, com itens e valores.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/api/fornecedor/relatorio">Baixar CSV de pedidos</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab.key === "logistica" && (
        <LogisticsTab
          areas={coverageAreas}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          categories={allCategories.map((c) => ({ id: c.id, name: c.name }))}
          freightConfig={
            freightRule
              ? {
                  chargeType: freightRule.chargeType,
                  cubicFactorKgPerM3: freightRule.cubicFactorKgPerM3,
                  minFreightCents: freightRule.minFreightCents,
                  freeShippingMinSubtotalCents: freightRule.freeShippingMinSubtotalCents,
                  freeShippingMaxWeightKg: freightRule.freeShippingMaxWeightKg,
                  ranges: freightRule.ranges,
                  surcharges: freightRule.surcharges,
                }
              : null
          }
          pickupLocations={pickupLocations}
        />
      )}
    </div>
  );
}
