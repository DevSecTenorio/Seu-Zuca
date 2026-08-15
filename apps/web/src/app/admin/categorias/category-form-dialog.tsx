"use client";

/* eslint-disable react-hooks/static-components --
 * The icon preview below resolves a Lucide component from getCategoryIcon(), a stable lookup
 * into the module-level CATEGORY_ICONS map (src/lib/icons.ts) — not a component freshly defined
 * on every render. The lint rule can't see through the lookup and flags it as unsafe. */

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_ICON_NAMES, getCategoryIcon } from "@/lib/icons";
import { createCategoryAction, updateCategoryAction } from "@/server/actions/category-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

type CategoryOption = { id: string; name: string };
type UnitOption = { id: string; name: string; abbreviation: string };

type CategoryFormDialogProps = {
  mode: "create" | "edit";
  parentOptions: CategoryOption[];
  units: UnitOption[];
  category?: {
    id: string;
    name: string;
    parentId: string | null;
    defaultUnitId: string | null;
    icon: string;
    active: boolean;
  };
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function CategoryFormDialog({ mode, parentOptions, units, category }: CategoryFormDialogProps) {
  const [open, setOpen] = useState(false);
  const action = mode === "edit" && category ? updateCategoryAction.bind(null, category.id) : createCategoryAction;
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);
  const [icon, setIcon] = useState(category?.icon ?? CATEGORY_ICON_NAMES[0]);
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [defaultUnitId, setDefaultUnitId] = useState(category?.defaultUnitId ?? "");

  // Close the dialog once the action resolves successfully. Adjusted during render (React's
  // documented alternative to a useEffect for reacting to a value changing) rather than in an
  // effect, comparing against the previously-handled state so it only fires once per submission.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") setOpen(false);
  }

  const Icon = getCategoryIcon(icon);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="size-4" /> Nova categoria
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Editar categoria">
            <Pencil className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova categoria" : "Editar categoria"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={category?.name} required />
            {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentId">Categoria pai (opcional)</Label>
            <Select value={parentId || "none"} onValueChange={setParentId}>
              <SelectTrigger id="parentId" className="w-full">
                <SelectValue placeholder="Nenhuma (categoria de topo)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (categoria de topo)</SelectItem>
                {parentOptions
                  .filter((p) => p.id !== category?.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="parentId" value={parentId === "none" ? "" : parentId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultUnitId">Unidade padrão (opcional)</Label>
            <Select value={defaultUnitId || "none"} onValueChange={setDefaultUnitId}>
              <SelectTrigger id="defaultUnitId" className="w-full">
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.abbreviation})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="defaultUnitId" value={defaultUnitId === "none" ? "" : defaultUnitId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon">Ícone</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger id="icon" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ICON_NAMES.map((name) => {
                  const OptIcon = getCategoryIcon(name);
                  return (
                    <SelectItem key={name} value={name}>
                      <OptIcon className="size-4" /> {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <input type="hidden" name="icon" value={icon} />
            {state.fieldErrors?.icon && <p className="text-sm text-destructive">{state.fieldErrors.icon[0]}</p>}
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Icon className="size-4" /> Pré-visualização
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="active"
              name="active"
              type="checkbox"
              defaultChecked={category?.active ?? true}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="active" className="font-normal">
              Categoria ativa (visível na loja)
            </Label>
          </div>

          {state.status === "error" && state.message && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <DialogFooter>
            <SubmitButton label={mode === "create" ? "Criar categoria" : "Salvar alterações"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
