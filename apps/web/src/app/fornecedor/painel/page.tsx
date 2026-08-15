import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogoutButton } from "@/components/logout-button";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { formatCentsToBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deactivateOwnProductAction, reactivateOwnProductAction } from "@/server/actions/product-actions";

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

const TABS = [
  { key: "produtos", label: "Produtos", implemented: true },
  { key: "pedidos", label: "Pedidos", implemented: false },
  { key: "analytics", label: "Analytics", implemented: false },
  { key: "relatorios", label: "Relatórios", implemented: false },
];

export default async function SupplierDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireApprovedUser(["fornecedor"]);
  const { tab } = await searchParams;
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  const products = await db.query.products.findMany({
    where: eq(schema.products.supplierId, user.id),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    with: { category: true, unit: true },
  });

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
    </div>
  );
}
