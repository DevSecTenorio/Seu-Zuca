"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordRevealBox } from "@/components/password-reveal-box";
import { createSupplierAction } from "@/server/actions/user-management-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Criando..." : "Criar fornecedor"}
    </Button>
  );
}

export function CreateSupplierForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createSupplierAction, INITIAL_FORM_STATE);

  if (state.generatedPassword) {
    return (
      <div className="max-w-md space-y-4">
        <p className="text-sm text-muted-foreground">Fornecedor criado e já aprovado. Credenciais iniciais:</p>
        <PasswordRevealBox password={state.generatedPassword} />
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-md space-y-4" noValidate>
      <Alert>
        <AlertTriangle className="size-4" />
        <AlertDescription>
          A senha inicial é gerada automaticamente e exibida uma única vez após a criação — ela
          não poderá ser recuperada depois.
        </AlertDescription>
      </Alert>

      {state.status === "error" && state.message && <p className="text-sm text-destructive">{state.message}</p>}

      <div className="space-y-2">
        <Label htmlFor="razaoSocial">Razão social</Label>
        <Input id="razaoSocial" name="razaoSocial" required />
        {state.fieldErrors?.razaoSocial && <p className="text-sm text-destructive">{state.fieldErrors.razaoSocial[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="nomeFantasia">Nome fantasia</Label>
        <Input id="nomeFantasia" name="nomeFantasia" required />
        {state.fieldErrors?.nomeFantasia && <p className="text-sm text-destructive">{state.fieldErrors.nomeFantasia[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="cnpj">CNPJ</Label>
        <Input id="cnpj" name="cnpj" required />
        {state.fieldErrors?.cnpj && <p className="text-sm text-destructive">{state.fieldErrors.cnpj[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required />
        {state.fieldErrors?.email && <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="telefone">Telefone</Label>
        <Input id="telefone" name="telefone" required />
        {state.fieldErrors?.telefone && <p className="text-sm text-destructive">{state.fieldErrors.telefone[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="ramoAtividade">Ramo de atividade</Label>
        <Input id="ramoAtividade" name="ramoAtividade" required />
        {state.fieldErrors?.ramoAtividade && <p className="text-sm text-destructive">{state.fieldErrors.ramoAtividade[0]}</p>}
      </div>

      <SubmitButton />
    </form>
  );
}
