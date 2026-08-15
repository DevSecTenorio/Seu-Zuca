import type { Metadata } from "next";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteMinQuantityRuleAction } from "@/server/actions/min-quantity-actions";
import { MinQuantityFormDialog } from "./min-quantity-form-dialog";

export const metadata: Metadata = { title: "Qtd. Mínimas — Admin — Seu Zuca" };

export default async function AdminMinQuantityPage() {
  await requireUser(["admin"]);

  const categories = await db.query.categories.findMany({
    orderBy: (c, { asc }) => [asc(c.name)],
    with: { minQuantityRule: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Quantidades mínimas</h1>
        <p className="mt-1 text-muted-foreground">
          Pedido mínimo e múltiplo de compra por categoria, aplicados no carrinho e no checkout.
          Categorias sem regra aceitam qualquer quantidade a partir de 1.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{categories.length} categorias</CardTitle>
          <CardDescription>Ex.: mínimo 50, múltiplo 10 — aceita 50, 60, 70...</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Mínimo</TableHead>
                <TableHead>Múltiplo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium text-foreground">{category.name}</TableCell>
                  <TableCell>{category.minQuantityRule?.minQuantity ?? "—"}</TableCell>
                  <TableCell>{category.minQuantityRule?.multiple ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <MinQuantityFormDialog
                        categoryId={category.id}
                        categoryName={category.name}
                        rule={category.minQuantityRule ?? undefined}
                      />
                      {category.minQuantityRule && (
                        <form
                          action={async () => {
                            "use server";
                            await deleteMinQuantityRuleAction(category.id);
                          }}
                        >
                          <ConfirmSubmitButton
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            confirmMessage={`Remover a regra de quantidade mínima de "${category.name}"?`}
                          >
                            Remover
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
