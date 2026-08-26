"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteCoverageAreaAction, toggleCoverageAreaActiveAction } from "@/server/actions/logistics-actions";
import { CoverageFormDialog, type CoverageAreaData } from "./coverage-form-dialog";
import { CepImportDialog } from "./cep-import-dialog";
import { FreightForm, type FreightRuleData } from "./freight-form";

type Option = { id: string; name: string };

type CoverageAreaWithRelations = CoverageAreaData & {
  active: boolean;
  product: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
};

const KIND_LABELS = { cep: "CEP", municipio: "Município", raio: "Raio" };

function scopeLabel(area: CoverageAreaWithRelations): string {
  if (area.scope === "produto") return `Produto: ${area.product?.name ?? "—"}`;
  if (area.scope === "categoria") return `Categoria: ${area.category?.name ?? "—"}`;
  return "Padrão do fornecedor";
}

function summaryFor(area: CoverageAreaWithRelations): string {
  if (area.kind === "cep") return `${area.ceps.length} faixa${area.ceps.length === 1 ? "" : "s"} de CEP`;
  if (area.kind === "municipio") return `${area.municipios.length} município${area.municipios.length === 1 ? "" : "s"}`;
  return `${area.radiusKm ?? "?"} km`;
}

export function LogisticsTab({
  areas,
  products,
  categories,
  freightConfig,
}: {
  areas: CoverageAreaWithRelations[];
  products: Option[];
  categories: Option[];
  freightConfig: FreightRuleData | null;
}) {
  return (
    <div className="mt-6 space-y-6">
      <FreightForm config={freightConfig} />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Cobertura de entrega</CardTitle>
            <CardDescription>
              Sem regras, você entrega em qualquer lugar. Regras de produto ou categoria substituem a regra padrão para aquele
              item; exclusões sempre valem, mesmo dentro de uma cobertura mais ampla.
            </CardDescription>
          </div>
          <CoverageFormDialog mode="create" products={products} categories={categories} />
        </CardHeader>
        <CardContent>
          {areas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma regra de cobertura cadastrada — seus produtos aparecem para compradores de qualquer endereço.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aplica-se a</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((area) => (
                  <TableRow key={area.id}>
                    <TableCell className="font-medium text-foreground">{scopeLabel(area)}</TableCell>
                    <TableCell>{KIND_LABELS[area.kind]}</TableCell>
                    <TableCell>
                      <Badge variant={area.mode === "exclusao" ? "destructive" : "default"}>
                        {area.mode === "exclusao" ? "Exclusão" : "Cobertura"}
                      </Badge>
                    </TableCell>
                    <TableCell>{summaryFor(area)}</TableCell>
                    <TableCell>
                      <Badge variant={area.active ? "default" : "secondary"}>{area.active ? "Ativa" : "Inativa"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {area.kind === "cep" && <CepImportDialog areaId={area.id} />}
                        <CoverageFormDialog mode="edit" area={area} products={products} categories={categories} />
                        <form action={toggleCoverageAreaActiveAction.bind(null, area.id, !area.active)}>
                          <Button type="submit" variant="ghost" size="sm">
                            {area.active ? "Desativar" : "Ativar"}
                          </Button>
                        </form>
                        <form action={deleteCoverageAreaAction.bind(null, area.id)}>
                          <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            Excluir
                          </Button>
                        </form>
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
