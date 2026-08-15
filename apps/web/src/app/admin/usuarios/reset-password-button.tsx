"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordRevealBox } from "@/components/password-reveal-box";
import { adminResetPasswordAction } from "@/server/actions/user-management-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "Gerando..." : "Redefinir senha"}
    </Button>
  );
}

export function ResetPasswordButton({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [open, setOpen] = useState(false);
  const action = adminResetPasswordAction.bind(null, userId);
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <form action={formAction} onSubmit={() => setOpen(true)}>
        <SubmitButton />
      </form>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova senha para {userEmail}</DialogTitle>
        </DialogHeader>
        {state.generatedPassword ? (
          <PasswordRevealBox password={state.generatedPassword} />
        ) : (
          <p className="text-sm text-muted-foreground">Gerando nova senha...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
