"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { upsertMinQuantityRuleAction } from "@/server/actions/min-quantity-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

export function MinQuantityFormDialog({
  categoryId,
  categoryName,
  rule,
}: {
  categoryId: string;
  categoryName: string;
  rule?: { minQuantity: number; multiple: number };
}) {
  const [open, setOpen] = useState(false);
  const action = upsertMinQuantityRuleAction.bind(null, categoryId);
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {rule ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar regra de ${categoryName}`}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            Definir regra
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quantidade mínima — {categoryName}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="minQuantity">Quantidade mínima</Label>
            <Input id="minQuantity" name="minQuantity" type="number" min={1} defaultValue={rule?.minQuantity ?? 1} required />
            {state.fieldErrors?.minQuantity && <p className="text-sm text-destructive">{state.fieldErrors.minQuantity[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="multiple">Múltiplo</Label>
            <Input id="multiple" name="multiple" type="number" min={1} defaultValue={rule?.multiple ?? 1} required />
            {state.fieldErrors?.multiple && <p className="text-sm text-destructive">{state.fieldErrors.multiple[0]}</p>}
            <p className="text-xs text-muted-foreground">
              Compras válidas: mínima, mínima + múltiplo, mínima + 2×múltiplo...
            </p>
          </div>
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
