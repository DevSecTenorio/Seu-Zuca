import "server-only";
import { and, eq, gte, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { PERIOD_LABELS, type AnalyticsPeriod } from "@/lib/analytics-period";

// Re-exported for pages that already import period plumbing from here alongside the queries —
// client components must import these two straight from "@/lib/analytics-period" instead (no db).
export { PERIOD_LABELS };
export type { AnalyticsPeriod };

function periodToSince(period: AnalyticsPeriod): Date {
  const now = new Date();
  const days: Record<AnalyticsPeriod, number> = { "7d": 7, "30d": 30, "3m": 90, "6m": 180 };
  return new Date(now.getTime() - days[period] * 24 * 60 * 60 * 1000);
}

/** Buckets by day for short windows, by ISO week for longer ones — keeps the chart to a
 * readable number of points regardless of period length. */
function bucketKey(date: Date, period: AnalyticsPeriod): string {
  if (period === "7d" || period === "30d") {
    return date.toISOString().slice(0, 10);
  }
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - firstDayOfYear.getTime()) / 86400000 + firstDayOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-S${String(week).padStart(2, "0")}`;
}

export type FinancialPoint = { bucket: string; gmvCents: number; commissionCents: number };

export type FinancialAnalytics = {
  period: AnalyticsPeriod;
  gmvCents: number;
  commissionCents: number;
  avgCommissionPercent: number | null;
  totalOrders: number;
  avgTicketCents: number | null;
  series: FinancialPoint[];
};

/** Financial rollup for a period, optionally scoped to one supplier (fornecedor painel) — GMV,
 * commission revenue, order count and a chart-ready time series. Cancelled orders are excluded:
 * GMV reflects value actually transacted, not attempted. */
export async function getFinancialAnalytics(period: AnalyticsPeriod, supplierId?: string): Promise<FinancialAnalytics> {
  const since = periodToSince(period);
  const conditions = [gte(schema.orders.createdAt, since), ne(schema.orders.status, "cancelado")];
  if (supplierId) conditions.push(eq(schema.orders.supplierId, supplierId));

  const orders = await db
    .select({
      createdAt: schema.orders.createdAt,
      totalCents: schema.orders.totalCents,
      commissionCents: schema.orders.commissionCents,
      commissionPercent: schema.orders.commissionPercent,
    })
    .from(schema.orders)
    .where(and(...conditions));

  const gmvCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const commissionCents = orders.reduce((sum, o) => sum + o.commissionCents, 0);
  const totalOrders = orders.length;

  const buckets = new Map<string, FinancialPoint>();
  for (const order of orders) {
    const key = bucketKey(order.createdAt, period);
    const point = buckets.get(key) ?? { bucket: key, gmvCents: 0, commissionCents: 0 };
    point.gmvCents += order.totalCents;
    point.commissionCents += order.commissionCents;
    buckets.set(key, point);
  }
  const series = Array.from(buckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));

  return {
    period,
    gmvCents,
    commissionCents,
    avgCommissionPercent: totalOrders > 0 ? Number((orders.reduce((s, o) => s + Number(o.commissionPercent), 0) / totalOrders).toFixed(2)) : null,
    totalOrders,
    avgTicketCents: totalOrders > 0 ? Math.round(gmvCents / totalOrders) : null,
    series,
  };
}

export type SupplierRevenueRank = { supplierId: string; nomeFantasia: string; gmvCents: number; commissionCents: number; orderCount: number };

export async function getTopSuppliersByRevenue(period: AnalyticsPeriod, limit = 5): Promise<SupplierRevenueRank[]> {
  const since = periodToSince(period);
  const orders = await db.query.orders.findMany({
    where: and(gte(schema.orders.createdAt, since), ne(schema.orders.status, "cancelado")),
    with: { supplier: { with: { company: true } } },
  });

  const bySupplier = new Map<string, SupplierRevenueRank>();
  for (const order of orders) {
    const key = order.supplierId;
    const entry = bySupplier.get(key) ?? {
      supplierId: key,
      nomeFantasia: order.supplier.company?.nomeFantasia ?? "—",
      gmvCents: 0,
      commissionCents: 0,
      orderCount: 0,
    };
    entry.gmvCents += order.totalCents;
    entry.commissionCents += order.commissionCents;
    entry.orderCount += 1;
    bySupplier.set(key, entry);
  }

  return Array.from(bySupplier.values())
    .sort((a, b) => b.commissionCents - a.commissionCents)
    .slice(0, limit);
}

export type QualityIndicators = {
  cancellationRate: number | null;
  returnRate: number | null;
  avgDeliveryDays: number | null;
  disputeCount: number;
};

export const CANCELLATION_RATE_TARGET = 0.05;

export async function getQualityIndicators(period: AnalyticsPeriod, supplierId?: string): Promise<QualityIndicators> {
  const since = periodToSince(period);
  const conditions = [gte(schema.orders.createdAt, since)];
  if (supplierId) conditions.push(eq(schema.orders.supplierId, supplierId));

  const orders = await db
    .select({ id: schema.orders.id, status: schema.orders.status })
    .from(schema.orders)
    .where(and(...conditions));

  const total = orders.length;
  const cancelled = orders.filter((o) => o.status === "cancelado").length;
  const returned = orders.filter((o) => o.status === "devolvido").length;
  const disputed = orders.filter((o) => o.status === "em_disputa").length;

  const deliveredOrderIds = orders.filter((o) => o.status === "entregue").map((o) => o.id);
  let avgDeliveryDays: number | null = null;
  if (deliveredOrderIds.length > 0) {
    const events = await db
      .select({ orderId: schema.orderStatusEvents.orderId, status: schema.orderStatusEvents.status, createdAt: schema.orderStatusEvents.createdAt })
      .from(schema.orderStatusEvents)
      .where(inArray(schema.orderStatusEvents.orderId, deliveredOrderIds));

    const byOrder = new Map<string, { pago?: Date; entregue?: Date }>();
    for (const event of events) {
      const entry = byOrder.get(event.orderId) ?? {};
      if (event.status === "pago" && !entry.pago) entry.pago = event.createdAt;
      if (event.status === "entregue") entry.entregue = event.createdAt;
      byOrder.set(event.orderId, entry);
    }
    const deliveryDurations = Array.from(byOrder.values())
      .filter((e) => e.pago && e.entregue)
      .map((e) => (e.entregue!.getTime() - e.pago!.getTime()) / (24 * 60 * 60 * 1000));
    if (deliveryDurations.length > 0) {
      avgDeliveryDays = Number((deliveryDurations.reduce((s, d) => s + d, 0) / deliveryDurations.length).toFixed(1));
    }
  }

  return {
    cancellationRate: total > 0 ? Number(((cancelled / total) * 100).toFixed(1)) : null,
    returnRate: total > 0 ? Number(((returned / total) * 100).toFixed(1)) : null,
    avgDeliveryDays,
    disputeCount: disputed,
  };
}

export type EcosystemSnapshot = {
  activeSuppliers: number;
  activeBuyers: number;
  activeCategories: number;
  publishedProducts: number;
  inactiveSuppliers: number;
};

/** Current-state counts (not period-filtered) — "quantos fornecedores/compradores/categorias/
 * produtos existem agora", SPEC.md's "dados do ecossistema". */
export async function getEcosystemSnapshot(period: AnalyticsPeriod): Promise<EcosystemSnapshot> {
  const since = periodToSince(period);

  const [suppliers, buyers, categories, products, recentOrders] = await Promise.all([
    db.query.users.findMany({ where: and(eq(schema.users.role, "fornecedor"), eq(schema.users.status, "aprovado")) }),
    db.query.users.findMany({ where: and(eq(schema.users.role, "comprador"), eq(schema.users.status, "aprovado")) }),
    db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.active, true)),
    db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.moderationStatus, "ativo")),
    db
      .select({ supplierId: schema.orders.supplierId })
      .from(schema.orders)
      .where(gte(schema.orders.createdAt, since)),
  ]);

  const activeSupplierIds = new Set(recentOrders.map((o) => o.supplierId));

  return {
    activeSuppliers: suppliers.length,
    activeBuyers: buyers.length,
    activeCategories: categories.length,
    publishedProducts: products.length,
    inactiveSuppliers: suppliers.filter((s) => !activeSupplierIds.has(s.id)).length,
  };
}
