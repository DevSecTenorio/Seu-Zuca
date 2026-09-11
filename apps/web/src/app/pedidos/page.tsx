import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { BuyerOrderList } from "@/components/buyer-order-list";

export const metadata: Metadata = { title: "Meus pedidos — Seu Zuca" };

export default async function OrdersPage() {
  const user = await requireApprovedUser(["comprador"]);

  const orders = await db.query.orders.findMany({
    where: eq(schema.orders.buyerId, user.id),
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    with: { supplier: { with: { company: true } }, items: true },
  });

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Meus pedidos</h1>
        <Link href="/minha-conta" className="text-sm text-primary hover:underline">
          Ir para meu painel
        </Link>
      </div>

      <div className="mt-6">
        <BuyerOrderList orders={orders} />
      </div>
    </div>
  );
}
