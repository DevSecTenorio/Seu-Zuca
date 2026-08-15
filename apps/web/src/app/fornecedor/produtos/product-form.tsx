"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProductAction, updateProductAction } from "@/server/actions/product-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";
import { formatCentsToBRL } from "@/lib/format";

type CategoryOption = { id: string; name: string; parentId: string | null };
type UnitOption = { id: string; name: string; abbreviation: string };
type ExistingImage = { id: string; url: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

function categoryLabel(category: CategoryOption, byId: Map<string, CategoryOption>): string {
  const parent = category.parentId ? byId.get(category.parentId) : null;
  return parent ? `${parent.name} > ${category.name}` : category.name;
}

export function ProductForm({
  mode,
  categories,
  units,
  product,
}: {
  mode: "create" | "edit";
  categories: CategoryOption[];
  units: UnitOption[];
  product?: {
    id: string;
    name: string;
    categoryId: string;
    unitId: string;
    sku: string;
    description: string;
    priceCents: number;
    stock: number;
    leadTimeDays: number;
    rejectionReason: string | null;
    images: ExistingImage[];
  };
}) {
  const action = mode === "edit" && product ? updateProductAction.bind(null, product.id) : createProductAction;
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);
  const [removedImageIds, setRemovedImageIds] = useState<Set<string>>(new Set());
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <form action={formAction} className="max-w-2xl space-y-6" noValidate>
      {product?.rejectionReason && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            <strong>Este produto foi rejeitado:</strong> {product.rejectionReason}. Corrija e reenvie para
            nova análise.
          </AlertDescription>
        </Alert>
      )}

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nome do produto</Label>
        <Input id="name" name="name" defaultValue={product?.name} required />
        {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Categoria</Label>
          <Select name="categoryId" defaultValue={product?.categoryId}>
            <SelectTrigger id="categoryId" className="w-full">
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {categoryLabel(c, categoryById)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.fieldErrors?.categoryId && (
            <p className="text-sm text-destructive">{state.fieldErrors.categoryId[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="unitId">Unidade de venda</Label>
          <Select name="unitId" defaultValue={product?.unitId}>
            <SelectTrigger id="unitId" className="w-full">
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} ({u.abbreviation})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.fieldErrors?.unitId && <p className="text-sm text-destructive">{state.fieldErrors.unitId[0]}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" defaultValue={product?.sku} required />
          {state.fieldErrors?.sku && <p className="text-sm text-destructive">{state.fieldErrors.sku[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceReais">Preço (R$)</Label>
          <Input
            id="priceReais"
            name="priceReais"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={product ? (product.priceCents / 100).toFixed(2).replace(".", ",") : undefined}
            required
          />
          {state.fieldErrors?.priceReais && (
            <p className="text-sm text-destructive">{state.fieldErrors.priceReais[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">Estoque</Label>
          <Input id="stock" name="stock" type="number" min={0} defaultValue={product?.stock ?? 0} required />
          {state.fieldErrors?.stock && <p className="text-sm text-destructive">{state.fieldErrors.stock[0]}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="leadTimeDays">Prazo de entrega (dias úteis)</Label>
        <Input
          id="leadTimeDays"
          name="leadTimeDays"
          type="number"
          min={1}
          className="max-w-40"
          defaultValue={product?.leadTimeDays ?? 1}
          required
        />
        {state.fieldErrors?.leadTimeDays && (
          <p className="text-sm text-destructive">{state.fieldErrors.leadTimeDays[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" name="description" rows={6} defaultValue={product?.description} required />
        <p className="text-xs text-muted-foreground">
          Regras comerciais como pedido mínimo e frete grátis podem ser mencionadas aqui.
        </p>
        {state.fieldErrors?.description && (
          <p className="text-sm text-destructive">{state.fieldErrors.description[0]}</p>
        )}
      </div>

      {product && product.images.length > 0 && (
        <div className="space-y-2">
          <Label>Imagens atuais</Label>
          <div className="flex flex-wrap gap-3">
            {product.images.map((image) => {
              const marked = removedImageIds.has(image.id);
              return (
                <label key={image.id} className="relative">
                  <Image
                    src={image.url}
                    alt=""
                    width={96}
                    height={96}
                    className={`size-24 rounded-md border object-cover ${marked ? "opacity-30" : ""}`}
                  />
                  <input
                    type="checkbox"
                    name="removeImage"
                    value={image.id}
                    className="absolute top-1 right-1 size-4"
                    onChange={(e) => {
                      const next = new Set(removedImageIds);
                      if (e.target.checked) next.add(image.id);
                      else next.delete(image.id);
                      setRemovedImageIds(next);
                    }}
                  />
                  <span className="absolute inset-x-0 bottom-0 rounded-b-md bg-background/80 py-0.5 text-center text-[10px]">
                    {marked ? "Remover" : "Manter"}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="images">{product ? "Adicionar novas imagens" : "Imagens"}</Label>
        <Input id="images" name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple />
      </div>

      {product && (
        <p className="text-sm text-muted-foreground">
          Preço atual: {formatCentsToBRL(product.priceCents)}. Qualquer alteração salva aqui envia o produto
          de volta para a fila de moderação do admin.
        </p>
      )}

      <SubmitButton label={mode === "create" ? "Enviar para moderação" : "Salvar e reenviar para moderação"} />
    </form>
  );
}
