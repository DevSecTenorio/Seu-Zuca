"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buyerOpenDisputeAction } from "@/server/actions/order-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Enviando..." : "Abrir disputa"}
    </Button>
  );
}

export function DisputeDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const action = buyerOpenDisputeAction.bind(null, orderId);
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Abrir disputa
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir disputa</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="reason">O que houve com este pedido?</Label>
            <Textarea id="reason" name="reason" rows={4} required />
            {state.fieldErrors?.reason && <p className="text-sm text-destructive">{state.fieldErrors.reason[0]}</p>}
          </div>
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
