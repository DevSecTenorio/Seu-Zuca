import "server-only";
import { and, eq, gte, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { type AnalyticsPeriod } from "@/lib/analytics-period";

export type ReportTable = { columns: string[]; rows: (string | number)[][] };

export const REPORT_KEYS = [
  "saude-financeira",
  "comissoes-repasses",
  "top-fornecedores",
  "qualidade-fornecedores",
  "vendas-categoria",
  "comportamento-compradores",
  "novos-cadastros",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_LABELS: Record<ReportKey, string> = {
  "saude-financeira": "Saúde financeira",
  "comissoes-repasses": "Comissões e repasses por pedido",
  "top-fornecedores": "Top fornecedores",
  "qualidade-fornecedores": "Qualidade por fornecedor",
  "vendas-categoria": "Vendas por categoria",
  "comportamento-compradores": "Comportamento de compradores",
  "novos-cadastros": "Novos cadastros no período",
};

function periodToSince(period: AnalyticsPeriod): Date {
  const now = new Date();
  const days: Record<AnalyticsPeriod, number> = { "7d": 7, "30d": 30, "3m": 90, "6m": 180 };
  return new Date(now.getTime() - days[period] * 24 * 60 * 60 * 1000);
}

async function getAvgRatingBySupplier(): Promise<Map<string, number>> {
  const rows = await db.query.reviews.findMany({
    where: eq(schema.reviews.moderationStatus, "aprovado"),
    with: { product: true },
  });
  const bySupplier = new Map<string, number[]>();
  for (const row of rows) {
    const list = bySupplier.get(row.product.supplierId) ?? [];
    list.push(row.rating);
    bySupplier.set(row.product.supplierId, list);
  }
  const averages = new Map<string, number>();
  for (const [supplierId, ratings] of bySupplier) {
    averages.set(supplierId, Number((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(2)));
  }
  return averages;
}

async function reportSaudeFinanceira(period: AnalyticsPeriod): Promise<ReportTable> {
  const since = periodToSince(period);
  const orders = await db
    .select({ createdAt: schema.orders.createdAt, totalCents: schema.orders.totalCents, commissionCents: schema.orders.commissionCents })
    .from(schema.orders)
    .where(and(gte(schema.orders.createdAt, since), ne(schema.orders.status, "cancelado")));

  const byDay = new Map<string, { gmv: number; commission: number; count: number }>();
  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { gmv: 0, commission: 0, count: 0 };
    entry.gmv += order.totalCents;
    entry.commission += order.commissionCents;
    entry.count += 1;
    byDay.set(key, entry);
  }

  const rows = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, e]) => [day, e.count, (e.gmv / 100).toFixed(2), (e.commission / 100).toFixed(2), (e.gmv / e.count / 100).toFixed(2)]);

  return { columns: ["Data", "Pedidos", "GMV (R$)", "Comissão (R$)", "Ticket médio (R$)"], rows };
}

async function reportComissoesRepasses(period: AnalyticsPeriod): Promise<ReportTable> {
  const since = periodToSince(period);
  const orders = await db.query.orders.findMany({
    where: gte(schema.orders.createdAt, since),
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    with: { supplier: { with: { company: true } } },
  });

  const rows = orders.map((o) => [
    o.id,
    o.supplier.company?.nomeFantasia ?? o.supplier.email,
    formatDate(o.createdAt),
    (o.subtotalCents / 100).toFixed(2),
    `${Number(o.commissionPercent).toFixed(2)}%`,
    (o.commissionCents / 100).toFixed(2),
    ORDER_STATUS_LABELS[o.status as OrderStatus],
  ]);

  return { columns: ["Pedido", "Fornecedor", "Data", "Subtotal (R$)", "Comissão %", "Comissão (R$)", "Status"], rows };
}

async function reportTopFornecedores(period: AnalyticsPeriod): Promise<ReportTable> {
  const since = periodToSince(period);
  const [orders, ratings] = await Promise.all([
    db.query.orders.findMany({
      where: and(gte(schema.orders.createdAt, since), ne(schema.orders.status, "cancelado")),
      with: { supplier: { with: { company: true } } },
    }),
    getAvgRatingBySupplier(),
  ]);

  const bySupplier = new Map<string, { name: string; gmv: number; commission: number; count: number }>();
  for (const o of orders) {
    const entry = bySupplier.get(o.supplierId) ?? { name: o.supplier.company?.nomeFantasia ?? o.supplier.email, gmv: 0, commission: 0, count: 0 };
    entry.gmv += o.totalCents;
    entry.commission += o.commissionCents;
    entry.count += 1;
    bySupplier.set(o.supplierId, entry);
  }

  const rows = Array.from(bySupplier.entries())
    .sort(([, a], [, b]) => b.commission - a.commission)
    .map(([supplierId, e]) => [
      e.name,
      e.count,
      (e.gmv / 100).toFixed(2),
      (e.commission / 100).toFixed(2),
      ratings.has(supplierId) ? ratings.get(supplierId)!.toFixed(2) : "--",
    ]);

  return { columns: ["Fornecedor", "Pedidos", "Volume (R$)", "Comissão (R$)", "Avaliação média"], rows };
}

async function reportQualidadeFornecedores(period: AnalyticsPeriod): Promise<ReportTable> {
  const since = periodToSince(period);
  const [orders, ratings] = await Promise.all([
    db.query.orders.findMany({
      where: gte(schema.orders.createdAt, since),
      with: { supplier: { with: { company: true } } },
    }),
    getAvgRatingBySupplier(),
  ]);

  const bySupplier = new Map<string, { name: string; total: number; cancelled: number; returned: number }>();
  for (const o of orders) {
    const entry = bySupplier.get(o.supplierId) ?? { name: o.supplier.company?.nomeFantasia ?? o.supplier.email, total: 0, cancelled: 0, returned: 0 };
    entry.total += 1;
    if (o.status === "cancelado") entry.cancelled += 1;
    if (o.status === "devolvido") entry.returned += 1;
    bySupplier.set(o.supplierId, entry);
  }

  const rows = Array.from(bySupplier.entries()).map(([supplierId, e]) => [
    e.name,
    e.total,
    `${((e.cancelled / e.total) * 100).toFixed(1)}%`,
    `${((e.returned / e.total) * 100).toFixed(1)}%`,
    ratings.has(supplierId) ? ratings.get(supplierId)!.toFixed(2) : "--",
  ]);

  return { columns: ["Fornecedor", "Pedidos", "Taxa de cancelamento", "Taxa de devolução", "Avaliação média"], rows };
}

async function reportVendasCategoria(period: AnalyticsPeriod): Promise<ReportTable> {
  const since = periodToSince(period);
  const items = await db
    .select({
      quantity: schema.orderItems.quantity,
      totalCents: schema.orderItems.totalCents,
      categoryId: schema.products.categoryId,
      categoryName: schema.categories.name,
      orderCreatedAt: schema.orders.createdAt,
      orderStatus: schema.orders.status,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(and(gte(schema.orders.createdAt, since), ne(schema.orders.status, "cancelado")));

  const byCategory = new Map<string, { name: string; qty: number; gmv: number }>();
  for (const item of items) {
    const entry = byCategory.get(item.categoryId) ?? { name: item.categoryName, qty: 0, gmv: 0 };
    entry.qty += item.quantity;
    entry.gmv += item.totalCents;
    byCategory.set(item.categoryId, entry);
  }

  const rows = Array.from(byCategory.values())
    .sort((a, b) => b.gmv - a.gmv)
    .map((e) => [e.name, e.qty, (e.gmv / 100).toFixed(2)]);

  return { columns: ["Categoria", "Unidades vendidas", "GMV (R$)"], rows };
}

async function reportComportamentoCompradores(period: AnalyticsPeriod): Promise<ReportTable> {
  const since = periodToSince(period);
  const orders = await db.query.orders.findMany({
    where: and(gte(schema.orders.createdAt, since), ne(schema.orders.status, "cancelado")),
    with: { buyer: { with: { company: true } } },
  });

  const byBuyer = new Map<string, { name: string; count: number; ltv: number }>();
  for (const o of orders) {
    const entry = byBuyer.get(o.buyerId) ?? { name: o.buyer.company?.nomeFantasia ?? o.buyer.email, count: 0, ltv: 0 };
    entry.count += 1;
    entry.ltv += o.totalCents;
    byBuyer.set(o.buyerId, entry);
  }

  const rows = Array.from(byBuyer.values())
    .sort((a, b) => b.ltv - a.ltv)
    .map((e) => [e.name, e.count, e.count > 1 ? "Sim" : "Não", (e.ltv / 100).toFixed(2)]);

  return { columns: ["Comprador", "Pedidos no período", "Recompra", "LTV no período (R$)"], rows };
}

async function reportNovosCadastros(period: AnalyticsPeriod): Promise<ReportTable> {
  const since = periodToSince(period);
  const users = await db.query.users.findMany({
    where: and(gte(schema.users.createdAt, since), inArray(schema.users.role, ["comprador", "fornecedor"])),
    orderBy: (u, { desc }) => [desc(u.createdAt)],
    with: { company: true },
  });

  const rows = users.map((u) => [
    u.company?.nomeFantasia ?? "—",
    u.email,
    u.role === "fornecedor" ? "Fornecedor" : "Comprador",
    u.status === "aprovado" ? "Aprovado" : u.status === "pendente" ? "Pendente" : u.status === "rejeitado" ? "Rejeitado" : "Suspenso",
    formatDate(u.createdAt),
  ]);

  return { columns: ["Empresa", "E-mail", "Tipo", "Status", "Cadastro"], rows };
}

export async function getReport(key: ReportKey, period: AnalyticsPeriod): Promise<ReportTable> {
  switch (key) {
    case "saude-financeira":
      return reportSaudeFinanceira(period);
    case "comissoes-repasses":
      return reportComissoesRepasses(period);
    case "top-fornecedores":
      return reportTopFornecedores(period);
    case "qualidade-fornecedores":
      return reportQualidadeFornecedores(period);
    case "vendas-categoria":
      return reportVendasCategoria(period);
    case "comportamento-compradores":
      return reportComportamentoCompradores(period);
    case "novos-cadastros":
      return reportNovosCadastros(period);
  }
}
