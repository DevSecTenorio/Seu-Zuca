import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, count, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/metric-card";
import { PeriodSelect } from "@/components/period-select";
import { formatCnpj } from "@/lib/cnpj";
import { formatCentsToBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getFinancialAnalytics, PERIOD_LABELS, type AnalyticsPeriod } from "@/server/queries/analytics";
import { getSignedDocumentUrl } from "@/lib/storage";
import { KycDocumentsDialog } from "../admin/usuarios/kyc-documents-dialog";

export const metadata: Metadata = {
  title: "Painel de Suporte — Seu Zuca",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  suspenso: "Suspenso",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "outline",
  aprovado: "default",
  rejeitado: "destructive",
  suspenso: "secondary",
};

const TABS = [
  { key: "geral", label: "Visão Geral" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "compradores", label: "Compradores" },
  { key: "relatorios", label: "Relatórios" },
];

const VALID_PERIODS: AnalyticsPeriod[] = ["7d", "30d", "3m", "6m"];

async function CompanyTable({ role }: { role: "fornecedor" | "comprador" }) {
  const usersWithCompany = await db.query.users.findMany({
    where: eq(schema.users.role, role),
    orderBy: (u, { desc }) => [desc(u.createdAt)],
    with: { company: { with: { kycDocuments: true } } },
  });

  // Same private-bucket signing as admin/usuarios/page.tsx — the caller already went through
  // requireUser(["suporte"]) before this component renders.
  const users = await Promise.all(
    usersWithCompany.map(async (user) => {
      if (!user.company) return user;
      const kycDocuments = await Promise.all(
        user.company.kycDocuments.map(async (doc) => ({
          ...doc,
          fileUrl: await getSignedDocumentUrl(doc.fileUrl),
        })),
      );
      return { ...user, company: { ...user.company, kycDocuments } };
    }),
  );

  if (users.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma conta encontrada.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Empresa</TableHead>
          <TableHead>CNPJ</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Cadastro</TableHead>
          <TableHead className="text-right">Documentos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="font-medium text-foreground">{user.company?.nomeFantasia ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </TableCell>
            <TableCell>{user.company ? formatCnpj(user.company.cnpj) : "—"}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[user.status]}>{STATUS_LABELS[user.status]}</Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
            <TableCell className="text-right">
              {user.company && <KycDocumentsDialog companyName={user.company.nomeFantasia} documents={user.company.kycDocuments} />}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ tab?: string; periodo?: string }> }) {
  const user = await requireUser(["suporte"]);
  const { tab, periodo } = await searchParams;
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
  const period = VALID_PERIODS.includes(periodo as AnalyticsPeriod) ? (periodo as AnalyticsPeriod) : "30d";

  const [[buyers], [suppliers], [pendingUsers], [totalOrders], [pendingOrders], financial] = await Promise.all([
    db.select({ value: count() }).from(schema.users).where(and(eq(schema.users.role, "comprador"), eq(schema.users.status, "aprovado"))),
    db.select({ value: count() }).from(schema.users).where(and(eq(schema.users.role, "fornecedor"), eq(schema.users.status, "aprovado"))),
    db.select({ value: count() }).from(schema.users).where(and(inArray(schema.users.role, ["comprador", "fornecedor"]), eq(schema.users.status, "pendente"))),
    db.select({ value: count() }).from(schema.orders),
    db.select({ value: count() }).from(schema.orders).where(eq(schema.orders.status, "aguardando_pagamento")),
    activeTab.key === "relatorios" ? getFinancialAnalytics(period) : null,
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Painel de Suporte</h1>
          <p className="mt-1 text-muted-foreground">
            Logado como {user.email} — consulta somente leitura; o servidor rejeita qualquer mutação vinda desta conta.
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-8 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/suporte?tab=${t.key}`}
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

      {activeTab.key === "geral" && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="Compradores aprovados" value={buyers.value} />
          <MetricCard label="Fornecedores aprovados" value={suppliers.value} />
          <MetricCard label="Cadastros pendentes" value={pendingUsers.value} />
          <MetricCard label="Total de pedidos" value={totalOrders.value} />
          <MetricCard label="Pedidos aguardando pagamento" value={pendingOrders.value} />
        </div>
      )}

      {activeTab.key === "fornecedores" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Fornecedores</CardTitle>
            <CardDescription>Consulta de cadastro e documentos — sem ações de moderação neste painel.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyTable role="fornecedor" />
          </CardContent>
        </Card>
      )}

      {activeTab.key === "compradores" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Compradores</CardTitle>
            <CardDescription>Consulta de cadastro e documentos — sem ações de moderação neste painel.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyTable role="comprador" />
          </CardContent>
        </Card>
      )}

      {activeTab.key === "relatorios" && financial && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Período: {PERIOD_LABELS[period]}</p>
            <PeriodSelect current={period} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="GMV" value={formatCentsToBRL(financial.gmvCents)} />
            <MetricCard label="Receita de comissões" value={formatCentsToBRL(financial.commissionCents)} />
            <MetricCard label="Total de pedidos" value={financial.totalOrders} />
            <MetricCard label="Ticket médio" value={financial.avgTicketCents !== null ? formatCentsToBRL(financial.avgTicketCents) : null} />
          </div>
        </div>
      )}
    </div>
  );
}
