"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rejectUserAction } from "@/server/actions/user-management-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Rejeitando..." : "Rejeitar cadastro"}
    </Button>
  );
}

export function RejectUserDialog({ userId, companyName }: { userId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const action = rejectUserAction.bind(null, userId);
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setOpen(true)}>
        Rejeitar
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rejeitar cadastro de &ldquo;{companyName}&rdquo;</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da rejeição</Label>
            <Textarea id="reason" name="reason" rows={4} required placeholder="Explique o que precisa ser corrigido..." />
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
