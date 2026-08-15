import type { Metadata } from "next";
import Link from "next/link";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { getCategoryIcon } from "@/lib/icons";
import { deleteCategoryAction, toggleCategoryActiveAction } from "@/server/actions/category-actions";
import { CategoryFormDialog } from "./category-form-dialog";

export const metadata: Metadata = { title: "Categorias — Admin — Seu Zuca" };

export default async function AdminCategoriesPage() {
  await requireUser(["admin"]);

  const [categories, units] = await Promise.all([
    db.query.categories.findMany({
      orderBy: (c, { asc }) => [asc(c.name)],
      with: { defaultUnit: true, parent: true },
    }),
    db.query.units.findMany({ orderBy: (u, { asc }) => [asc(u.name)] }),
  ]);

  const productCounts = await db.select({ categoryId: schema.products.categoryId }).from(schema.products);
  const productCountByCategory = new Map<string, number>();
  for (const row of productCounts) {
    productCountByCategory.set(row.categoryId, (productCountByCategory.get(row.categoryId) ?? 0) + 1);
  }
  const childCountByParent = new Map<string, number>();
  for (const c of categories) {
    if (c.parentId) childCountByParent.set(c.parentId, (childCountByParent.get(c.parentId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Categorias</h1>
          <p className="mt-1 text-muted-foreground">
            Árvore oficial de categorias. Produtos só podem referenciar categorias cadastradas aqui —
            nunca texto livre.
          </p>
        </div>
        <CategoryFormDialog mode="create" parentOptions={categories} units={units} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{categories.length} categorias</CardTitle>
          <CardDescription>Categorias inativas não aparecem na loja pública.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Categoria pai</TableHead>
                <TableHead>Unidade padrão</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => {
                const Icon = getCategoryIcon(category.icon);
                const productCount = productCountByCategory.get(category.id) ?? 0;
                const childCount = childCountByParent.get(category.id) ?? 0;
                const canDelete = productCount === 0 && childCount === 0;
                return (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <Icon className="size-4 text-muted-foreground" /> {category.name}
                      </div>
                      <div className="text-xs text-muted-foreground">/{category.slug}</div>
                    </TableCell>
                    <TableCell>{category.parent?.name ?? "—"}</TableCell>
                    <TableCell>
                      {category.defaultUnit ? `${category.defaultUnit.name} (${category.defaultUnit.abbreviation})` : "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/produtos?tab=todos&categoria=${category.id}`} className="hover:underline">
                        {productCount}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.active ? "default" : "secondary"}>
                        {category.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <CategoryFormDialog
                          mode="edit"
                          parentOptions={categories}
                          units={units}
                          category={category}
                        />
                        <form
                          action={async () => {
                            "use server";
                            await toggleCategoryActiveAction(category.id, !category.active);
                          }}
                        >
                          <Button variant="ghost" size="sm" type="submit">
                            {category.active ? "Desativar" : "Ativar"}
                          </Button>
                        </form>
                        {canDelete && (
                          <form
                            action={async () => {
                              "use server";
                              await deleteCategoryAction(category.id);
                            }}
                          >
                            <ConfirmSubmitButton
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              confirmMessage={`Excluir a categoria "${category.name}"? Essa ação não pode ser desfeita.`}
                            >
                              Excluir
                            </ConfirmSubmitButton>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
