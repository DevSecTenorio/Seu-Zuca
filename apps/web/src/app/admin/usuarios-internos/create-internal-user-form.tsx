"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PasswordRevealBox } from "@/components/password-reveal-box";
import { createInternalUserAction } from "@/server/actions/user-management-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Criando..." : "Criar conta"}
    </Button>
  );
}

export function CreateInternalUserForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(createInternalUserAction, INITIAL_FORM_STATE);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nova conta interna
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta interna</DialogTitle>
        </DialogHeader>
        {state.generatedPassword ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Conta criada. Credenciais iniciais:</p>
            <PasswordRevealBox password={state.generatedPassword} />
          </div>
        ) : (
          <form action={formAction} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail corporativo</Label>
              <Input id="email" name="email" type="email" required />
              {state.fieldErrors?.email && <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Papel</Label>
              <Select name="role" defaultValue="suporte">
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suporte">Suporte — consulta dados, somente leitura</SelectItem>
                  <SelectItem value="admin">Admin — acesso total à plataforma</SelectItem>
                </SelectContent>
              </Select>
              {state.fieldErrors?.role && <p className="text-sm text-destructive">{state.fieldErrors.role[0]}</p>}
            </div>
            {state.status === "error" && state.message && <p className="text-sm text-destructive">{state.message}</p>}
            <DialogFooter>
              <SubmitButton />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
