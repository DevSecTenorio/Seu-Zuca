import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCentsToBRL, formatDate } from "@/lib/format";
import {
  approveProductAction,
  deactivateProductAction,
} from "@/server/actions/product-moderation-actions";
import { RejectProductDialog } from "./reject-product-dialog";

export const metadata: Metadata = { title: "Produtos — Admin — Seu Zuca" };

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
  { key: "aguardando", label: "Aguardando", status: "aguardando_aprovacao" as const },
  { key: "aprovados", label: "Aprovados", status: "ativo" as const },
  { key: "todos", label: "Todos", status: undefined },
];

type SearchParams = { tab?: string; categoria?: string };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser(["admin"]);
  const params = await searchParams;
  const activeTab = TABS.find((t) => t.key === params.tab) ?? TABS[0];

  const filters = [];
  if (activeTab.status) filters.push(eq(schema.products.moderationStatus, activeTab.status));
  if (params.categoria) filters.push(eq(schema.products.categoryId, params.categoria));

  const [products, category] = await Promise.all([
    db.query.products.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      with: { supplier: { with: { company: true } }, category: true, unit: true },
      limit: 100,
    }),
    params.categoria
      ? db.query.categories.findFirst({ where: eq(schema.categories.id, params.categoria) })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Produtos</h1>
        <p className="mt-1 text-muted-foreground">
          Fila de moderação de produtos cadastrados pelos fornecedores.
        </p>
      </div>

      {category && (
        <div className="flex items-center gap-2">
          <Badge variant="outline">Filtrando por: {category.name}</Badge>
          <Link href={`/admin/produtos?tab=${activeTab.key}`} className="text-sm text-primary hover:underline">
            Limpar filtro
          </Link>
        </div>
      )}

      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/produtos?tab=${tab.key}${params.categoria ? `&categoria=${params.categoria}` : ""}`}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium",
              activeTab.key === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{products.length} produtos</CardTitle>
          <CardDescription>Produtos novos ou com edições sensíveis voltam para &ldquo;Aguardando&rdquo;.</CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto nesta lista.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
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
                    <TableCell>{product.supplier.company?.nomeFantasia ?? product.supplier.email}</TableCell>
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
                      {product.moderationStatus === "rejeitado" && product.rejectionReason && (
                        <p className="mt-1 max-w-48 text-xs text-muted-foreground">{product.rejectionReason}</p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(product.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {product.moderationStatus === "aguardando_aprovacao" && (
                          <>
                            <form
                              action={async () => {
                                "use server";
                                await approveProductAction(product.id);
                              }}
                            >
                              <Button type="submit" size="sm">
                                Aprovar
                              </Button>
                            </form>
                            <RejectProductDialog productId={product.id} productName={product.name} />
                          </>
                        )}
                        {product.moderationStatus === "ativo" && (
                          <form
                            action={async () => {
                              "use server";
                              await deactivateProductAction(product.id);
                            }}
                          >
                            <Button type="submit" variant="outline" size="sm">
                              Desativar
                            </Button>
                          </form>
                        )}
                        {product.moderationStatus === "ativo" && (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/produto/${product.slug}`} target="_blank">
                              Ver
                            </Link>
                          </Button>
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
    </div>
  );
}
