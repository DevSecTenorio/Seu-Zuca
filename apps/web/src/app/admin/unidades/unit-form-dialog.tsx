"use client";

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
import { createUnitAction, updateUnitAction } from "@/server/actions/unit-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function UnitFormDialog({
  mode,
  unit,
}: {
  mode: "create" | "edit";
  unit?: { id: string; name: string; abbreviation: string };
}) {
  const [open, setOpen] = useState(false);
  const action = mode === "edit" && unit ? updateUnitAction.bind(null, unit.id) : createUnitAction;
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);

  // See category-form-dialog.tsx for why this is a render-time adjustment rather than an effect.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="size-4" /> Nova unidade
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Editar unidade">
            <Pencil className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova unidade" : "Editar unidade"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={unit?.name} placeholder="Ex.: Saco" required />
            {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="abbreviation">Abreviação</Label>
            <Input
              id="abbreviation"
              name="abbreviation"
              defaultValue={unit?.abbreviation}
              placeholder="Ex.: sc"
              required
            />
            {state.fieldErrors?.abbreviation && (
              <p className="text-sm text-destructive">{state.fieldErrors.abbreviation[0]}</p>
            )}
          </div>
          {state.status === "error" && state.message && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <SubmitButton label={mode === "create" ? "Criar unidade" : "Salvar alterações"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
