import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { FinancialChart } from "@/components/financial-chart";
import { PeriodSelect } from "@/components/period-select";
import { formatCentsToBRL } from "@/lib/format";
import {
  CANCELLATION_RATE_TARGET,
  getEcosystemSnapshot,
  getFinancialAnalytics,
  getQualityIndicators,
  getTopSuppliersByRevenue,
  PERIOD_LABELS,
  type AnalyticsPeriod,
} from "@/server/queries/analytics";

export const metadata: Metadata = { title: "Analytics — Admin — Seu Zuca" };

const VALID_PERIODS: AnalyticsPeriod[] = ["7d", "30d", "3m", "6m"];

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireUser(["admin"]);
  const { periodo } = await searchParams;
  const period = VALID_PERIODS.includes(periodo as AnalyticsPeriod) ? (periodo as AnalyticsPeriod) : "30d";

  const [financial, topSuppliers, quality, ecosystem] = await Promise.all([
    getFinancialAnalytics(period),
    getTopSuppliersByRevenue(period),
    getQualityIndicators(period),
    getEcosystemSnapshot(period),
  ]);

  const cancellationAboveTarget =
    quality.cancellationRate !== null && quality.cancellationRate / 100 > CANCELLATION_RATE_TARGET;

  const alerts = [
    {
      key: "disputas",
      severity: quality.disputeCount > 0 ? "warning" : "ok",
      text:
        quality.disputeCount > 0
          ? `${quality.disputeCount} pedido${quality.disputeCount > 1 ? "s" : ""} em disputa no período.`
          : "Nenhum pedido em disputa no período.",
    },
    {
      key: "cancelamento",
      severity: cancellationAboveTarget ? "warning" : "ok",
      text:
        quality.cancellationRate === null
          ? "Sem pedidos suficientes para calcular taxa de cancelamento."
          : cancellationAboveTarget
            ? `Taxa de cancelamento de ${quality.cancellationRate}% acima da meta de ${(CANCELLATION_RATE_TARGET * 100).toFixed(0)}%.`
            : `Taxa de cancelamento de ${quality.cancellationRate}%, dentro da meta.`,
    },
    {
      key: "inativos",
      severity: ecosystem.inactiveSuppliers > 0 ? "warning" : "ok",
      text:
        ecosystem.inactiveSuppliers > 0
          ? `${ecosystem.inactiveSuppliers} fornecedor${ecosystem.inactiveSuppliers > 1 ? "es" : ""} sem pedidos no período.`
          : "Todos os fornecedores tiveram pedidos no período.",
    },
    { key: "avaliacoes", severity: "unknown", text: "Fornecedores mal avaliados: sem dados (avaliações chegam em etapa futura)." },
    { key: "repasses", severity: "unknown", text: "Comissões em atraso: sem dados (controle de repasses fora do escopo do MVP)." },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="mt-1 text-muted-foreground">Período: {PERIOD_LABELS[period]}</p>
        </div>
        <PeriodSelect current={period} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="GMV" value={formatCentsToBRL(financial.gmvCents)} />
        <MetricCard label="Receita de comissões" value={formatCentsToBRL(financial.commissionCents)} />
        <MetricCard label="Comissão média" value={financial.avgCommissionPercent !== null ? `${financial.avgCommissionPercent}%` : null} />
        <MetricCard label="Total de pedidos" value={financial.totalOrders} />
        <MetricCard label="Ticket médio" value={financial.avgTicketCents !== null ? formatCentsToBRL(financial.avgTicketCents) : null} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução financeira (GMV)</CardTitle>
          <CardDescription>Receita de comissão exibida no cartão acima.</CardDescription>
        </CardHeader>
        <CardContent>
          <FinancialChart series={financial.series} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ranking de fornecedores por receita</CardTitle>
          </CardHeader>
          <CardContent>
            {topSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem pedidos no período.</p>
            ) : (
              <ol className="space-y-3">
                {topSuppliers.map((supplier, i) => (
                  <li key={supplier.supplierId} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {i + 1}
                      </span>
                      {supplier.nomeFantasia}
                    </span>
                    <span className="font-medium text-foreground">{formatCentsToBRL(supplier.commissionCents)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas operacionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.key} className="flex items-start gap-2 text-sm">
                {alert.severity === "warning" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                ) : alert.severity === "ok" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                ) : (
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground">--</span>
                )}
                <span className={alert.severity === "unknown" ? "text-muted-foreground" : "text-foreground"}>{alert.text}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Avaliação média" value={null} hint="Chega na próxima etapa" />
        <MetricCard label="Taxa de devolução" value={quality.returnRate !== null ? `${quality.returnRate}%` : null} />
        <MetricCard label="Taxa de cancelamento" value={quality.cancellationRate !== null ? `${quality.cancellationRate}%` : null} />
        <MetricCard label="Tempo médio de entrega" value={quality.avgDeliveryDays !== null ? `${quality.avgDeliveryDays} dias` : null} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ecossistema</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard label="Fornecedores ativos" value={ecosystem.activeSuppliers} />
          <MetricCard label="Compradores ativos" value={ecosystem.activeBuyers} />
          <MetricCard label="Categorias ativas" value={ecosystem.activeCategories} />
          <MetricCard label="Produtos publicados" value={ecosystem.publishedProducts} />
        </CardContent>
      </Card>
    </div>
  );
}
