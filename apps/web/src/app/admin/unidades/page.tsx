import type { Metadata } from "next";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteUnitAction } from "@/server/actions/unit-actions";
import { UnitFormDialog } from "./unit-form-dialog";

export const metadata: Metadata = { title: "Unidades — Admin — Seu Zuca" };

export default async function AdminUnitsPage() {
  await requireUser(["admin"]);

  const [units, productRows, categoryRows] = await Promise.all([
    db.query.units.findMany({ orderBy: (u, { asc }) => [asc(u.name)] }),
    db.select({ unitId: schema.products.unitId }).from(schema.products),
    db.select({ defaultUnitId: schema.categories.defaultUnitId }).from(schema.categories),
  ]);
  const usedByProduct = new Set(productRows.map((r) => r.unitId));
  const usedByCategory = new Set(categoryRows.map((r) => r.defaultUnitId).filter(Boolean));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Unidades de medida</h1>
          <p className="mt-1 text-muted-foreground">
            Lista oficial de unidades disponíveis no formulário de produto.
          </p>
        </div>
        <UnitFormDialog mode="create" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{units.length} unidades</CardTitle>
          <CardDescription>Unidades em uso por produtos ou categorias não podem ser excluídas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Abreviação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => {
                const canDelete = !usedByProduct.has(unit.id) && !usedByCategory.has(unit.id);
                return (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium text-foreground">{unit.name}</TableCell>
                    <TableCell>{unit.abbreviation}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <UnitFormDialog mode="edit" unit={unit} />
                        {canDelete && (
                          <form
                            action={async () => {
                              "use server";
                              await deleteUnitAction(unit.id);
                            }}
                          >
                            <ConfirmSubmitButton
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              confirmMessage={`Excluir a unidade "${unit.name}"?`}
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
