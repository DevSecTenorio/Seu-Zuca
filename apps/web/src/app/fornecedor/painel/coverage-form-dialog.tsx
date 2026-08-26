"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCoverageAreaAction, updateCoverageAreaAction } from "@/server/actions/logistics-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

type Option = { id: string; name: string };

export type CoverageAreaData = {
  id: string;
  scope: "fornecedor" | "produto" | "categoria";
  kind: "cep" | "municipio" | "raio";
  mode: "cobertura" | "exclusao";
  radiusKm: number | null;
  productId: string | null;
  categoryId: string | null;
  ceps: { cepStart: string; cepEnd: string }[];
  municipios: { cidade: string; estado: string }[];
};

const SCOPE_LABELS = { fornecedor: "Padrão do fornecedor (todos os produtos)", produto: "Um produto específico", categoria: "Uma categoria específica" };
const KIND_LABELS = { cep: "Faixa de CEP", municipio: "Município (cidade + UF)", raio: "Raio (km) a partir da minha origem" };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function CoverageFormDialog({
  mode,
  area,
  products,
  categories,
}: {
  mode: "create" | "edit";
  area?: CoverageAreaData;
  products: Option[];
  categories: Option[];
}) {
  const [open, setOpen] = useState(false);
  const action = mode === "edit" && area ? updateCoverageAreaAction.bind(null, area.id) : createCoverageAreaAction;
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);

  const [scope, setScope] = useState<CoverageAreaData["scope"]>(area?.scope ?? "fornecedor");
  const [kind, setKind] = useState<CoverageAreaData["kind"]>(area?.kind ?? "cep");
  const [ruleMode, setRuleMode] = useState<CoverageAreaData["mode"]>(area?.mode ?? "cobertura");
  const [productId, setProductId] = useState(area?.productId ?? "");
  const [categoryId, setCategoryId] = useState(area?.categoryId ?? "");

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") setOpen(false);
  }

  const cepsDefaultText =
    area?.ceps.map((r) => (r.cepStart === r.cepEnd ? r.cepStart : `${r.cepStart},${r.cepEnd}`)).join("\n") ?? "";
  const municipiosDefaultText = area?.municipios.map((m) => `${m.cidade},${m.estado}`).join("\n") ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="size-4" /> Nova regra
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Editar regra">
            <Pencil className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova regra de cobertura" : "Editar regra de cobertura"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          {mode === "create" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="scope">Aplica-se a</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as CoverageAreaData["scope"])}>
                  <SelectTrigger id="scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="scope" value={scope} />
              </div>

              {scope === "produto" && (
                <div className="space-y-2">
                  <Label htmlFor="productId">Produto</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger id="productId" className="w-full">
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="productId" value={productId} />
                  {state.fieldErrors?.productId && <p className="text-sm text-destructive">{state.fieldErrors.productId[0]}</p>}
                </div>
              )}

              {scope === "categoria" && (
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger id="categoryId" className="w-full">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="categoryId" value={categoryId} />
                  {state.fieldErrors?.categoryId && <p className="text-sm text-destructive">{state.fieldErrors.categoryId[0]}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="kind">Tipo de área</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as CoverageAreaData["kind"])}>
                  <SelectTrigger id="kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(KIND_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="kind" value={kind} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tipo: <span className="font-medium text-foreground">{KIND_LABELS[area!.kind]}</span> — escopo e tipo não podem ser
              alterados; exclua e crie uma nova regra se precisar mudar isso.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="mode">Modo</Label>
            <Select value={ruleMode} onValueChange={(v) => setRuleMode(v as CoverageAreaData["mode"])}>
              <SelectTrigger id="mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cobertura">Cobertura (entrego nessa área)</SelectItem>
                <SelectItem value="exclusao">Exclusão (não entrego, mesmo dentro de uma cobertura mais ampla)</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="mode" value={ruleMode} />
          </div>

          {kind === "cep" && (
            <div className="space-y-2">
              <Label htmlFor="cepsText">CEPs</Label>
              <Textarea
                id="cepsText"
                name="cepsText"
                rows={5}
                defaultValue={cepsDefaultText}
                placeholder={"Um CEP por linha, ou uma faixa: 01310-100\n01000-000,01999-999"}
              />
              {state.fieldErrors?.cepsText && <p className="text-sm text-destructive">{state.fieldErrors.cepsText[0]}</p>}
            </div>
          )}

          {kind === "municipio" && (
            <div className="space-y-2">
              <Label htmlFor="municipiosText">Municípios</Label>
              <Textarea
                id="municipiosText"
                name="municipiosText"
                rows={5}
                defaultValue={municipiosDefaultText}
                placeholder={"Um por linha: Cidade,UF\nSão Carlos,SP"}
              />
              {state.fieldErrors?.municipiosText && (
                <p className="text-sm text-destructive">{state.fieldErrors.municipiosText[0]}</p>
              )}
            </div>
          )}

          {kind === "raio" && (
            <div className="space-y-2">
              <Label htmlFor="radiusKm">Raio (km)</Label>
              <input
                id="radiusKm"
                name="radiusKm"
                type="number"
                min={1}
                defaultValue={area?.radiusKm ?? ""}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              />
              {state.fieldErrors?.radiusKm && <p className="text-sm text-destructive">{state.fieldErrors.radiusKm[0]}</p>}
              <p className="text-xs text-muted-foreground">
                A distância é calculada a partir do endereço da sua empresa e do endereço do comprador. Se algum dos dois ainda
                não tiver sido geocodificado, esta regra não restringe ninguém em vez de bloquear por engano.
              </p>
            </div>
          )}

          {state.status === "error" && state.message && <p className="text-sm text-destructive">{state.message}</p>}

          <DialogFooter>
            <SubmitButton label={mode === "create" ? "Criar regra" : "Salvar alterações"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
