import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** CSV export of the supplier's own orders — "aba Relatórios (exportação dos próprios dados)",
 * SPEC.md §6. PDF/Excel formats are scoped to the admin's 7 reports later in the roadmap. */
export async function GET() {
  const supplier = await requireApprovedUser(["fornecedor"]);

  const orders = await db.query.orders.findMany({
    where: eq(schema.orders.supplierId, supplier.id),
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    with: { buyer: { with: { company: true } }, items: true },
  });

  const header = ["Pedido", "Comprador", "Data", "Status", "Itens", "Subtotal (R$)", "Frete (R$)", "Comissão (R$)", "Total (R$)"];
  const rows = orders.map((order) => [
    order.id,
    order.buyer.company?.nomeFantasia ?? order.buyer.email,
    formatDate(order.createdAt),
    ORDER_STATUS_LABELS[order.status as OrderStatus],
    String(order.items.length),
    (order.subtotalCents / 100).toFixed(2),
    (order.shippingCents / 100).toFixed(2),
    (order.commissionCents / 100).toFixed(2),
    (order.totalCents / 100).toFixed(2),
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const bom = "﻿"; // Excel needs a UTF-8 BOM to not mangle accented characters.

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-${supplier.id}.csv"`,
    },
  });
}
