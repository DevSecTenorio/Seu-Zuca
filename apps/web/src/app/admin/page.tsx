import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { db, schema } from "@/db";
import { eq, count } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Painel do Administrador — Seu Zuca",
};

const UPCOMING_SECTIONS = [
  "Usuários",
  "Criar Fornecedor",
  "Usuários Internos",
  "Banners",
  "Qtd. Mínimas",
  "Avaliações",
  "Relatórios completos",
  "Analytics",
];

export default async function AdminOverviewPage() {
  await requireUser(["admin"]);

  const [[buyers], [suppliers], [pendingUsers], [activeProducts], [pendingProducts]] = await Promise.all([
    db.select({ value: count() }).from(schema.users).where(eq(schema.users.role, "comprador")),
    db.select({ value: count() }).from(schema.users).where(eq(schema.users.role, "fornecedor")),
    db.select({ value: count() }).from(schema.users).where(eq(schema.users.status, "pendente")),
    db
      .select({ value: count() })
      .from(schema.products)
      .where(eq(schema.products.moderationStatus, "ativo")),
    db
      .select({ value: count() })
      .from(schema.products)
      .where(eq(schema.products.moderationStatus, "aguardando_aprovacao")),
  ]);

  const cards = [
    { label: "Compradores cadastrados", value: buyers.value },
    { label: "Fornecedores cadastrados", value: suppliers.value },
    { label: "Cadastros pendentes", value: pendingUsers.value },
    { label: "Produtos ativos", value: activeProducts.value },
    { label: "Produtos aguardando moderação", value: pendingProducts.value },
  ];

  return (
    <div className="space-y-8">
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

      <Card>
        <CardHeader>
          <CardTitle>Área em construção</CardTitle>
          <CardDescription>
            As demais seções administrativas (usuários, aprovação de cadastros, relatórios completos,
            analytics) chegam nas próximas etapas do roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            {UPCOMING_SECTIONS.map((section) => (
              <li key={section} className="rounded-md border px-3 py-2">
                {section}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
