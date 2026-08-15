"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BRAZILIAN_STATES } from "@/lib/validation/register";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";
import { cn } from "@/lib/utils";

type RegisterAction = (prevState: FormState, formData: FormData) => Promise<FormState>;

function validateContainer(container: HTMLElement | null): boolean {
  if (!container) return true;
  const passwordInput = container.querySelector<HTMLInputElement>('input[name="password"]');
  const confirmInput = container.querySelector<HTMLInputElement>('input[name="confirmPassword"]');
  if (passwordInput && confirmInput) {
    confirmInput.setCustomValidity(
      confirmInput.value && passwordInput.value !== confirmInput.value ? "As senhas não coincidem" : "",
    );
  }

  const fields = container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input, select, textarea",
  );
  for (const field of fields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  const steps = [
    { number: 1, label: "Dados da empresa" },
    { number: 2, label: "Documentos" },
  ];
  return (
    <ol className="mb-8 flex items-center gap-4">
      {steps.map((s, index) => (
        <li key={s.number} className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                step === s.number
                  ? "border-primary bg-primary text-primary-foreground"
                  : step > s.number
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
              )}
            >
              {step > s.number ? <Check className="size-4" /> : s.number}
            </span>
            <span
              className={cn(
                "text-sm",
                step === s.number ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </div>
          {index < steps.length - 1 && <div className="h-px w-8 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando cadastro..." : "Concluir cadastro"}
    </Button>
  );
}

export function CompanyRegisterWizard({ action }: { action: RegisterAction }) {
  const [state, formAction] = useActionState(action, INITIAL_FORM_STATE);
  const [step, setStep] = useState<1 | 2>(1);
  const step1Ref = useRef<HTMLDivElement>(null);

  return (
    <form action={formAction} noValidate>
      <StepIndicator step={step} />

      {state.status === "error" && state.message && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div ref={step1Ref} hidden={step !== 1} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="razaoSocial">Razão social</Label>
            <Input id="razaoSocial" name="razaoSocial" required />
            <FieldError errors={state.fieldErrors?.razaoSocial} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nomeFantasia">Nome fantasia</Label>
            <Input id="nomeFantasia" name="nomeFantasia" required />
            <FieldError errors={state.fieldErrors?.nomeFantasia} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" required />
            <FieldError errors={state.fieldErrors?.cnpj} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" name="telefone" placeholder="(00) 00000-0000" required />
            <FieldError errors={state.fieldErrors?.telefone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail corporativo</Label>
            <Input id="email" name="email" type="email" required />
            <FieldError errors={state.fieldErrors?.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ramoAtividade">Ramo de atividade</Label>
            <Input id="ramoAtividade" name="ramoAtividade" placeholder="Ex.: Construção civil" required />
            <FieldError errors={state.fieldErrors?.ramoAtividade} />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-foreground">Endereço da empresa</h3>
          <div className="grid gap-4 sm:grid-cols-6">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" name="cep" placeholder="00000-000" required />
              <FieldError errors={state.fieldErrors?.cep} />
            </div>
            <div className="space-y-2 sm:col-span-4">
              <Label htmlFor="logradouro">Logradouro</Label>
              <Input id="logradouro" name="logradouro" required />
              <FieldError errors={state.fieldErrors?.logradouro} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="numero">Número</Label>
              <Input id="numero" name="numero" required />
              <FieldError errors={state.fieldErrors?.numero} />
            </div>
            <div className="space-y-2 sm:col-span-4">
              <Label htmlFor="complemento">Complemento (opcional)</Label>
              <Input id="complemento" name="complemento" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" name="bairro" required />
              <FieldError errors={state.fieldErrors?.bairro} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" name="cidade" required />
              <FieldError errors={state.fieldErrors?.cidade} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="estado">Estado</Label>
              <Select name="estado" required>
                <SelectTrigger id="estado" className="w-full">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={state.fieldErrors?.estado} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-foreground">Senha de acesso</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required />
              <FieldError errors={state.fieldErrors?.password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
              <FieldError errors={state.fieldErrors?.confirmPassword} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => {
              if (validateContainer(step1Ref.current)) setStep(2);
            }}
          >
            Avançar
          </Button>
        </div>
      </div>

      <div hidden={step !== 2} className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Envie a documentação da empresa para análise. Aceitamos PDF, PNG, JPG ou WEBP (até 10MB por
          arquivo).
        </p>

        <div className="space-y-2">
          <Label htmlFor="cartaoCnpjFile">Cartão CNPJ</Label>
          <Input id="cartaoCnpjFile" name="cartaoCnpjFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" />
          <FieldError errors={state.fieldErrors?.cartaoCnpjFile} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contratoSocialFile">Contrato social</Label>
          <Input
            id="contratoSocialFile"
            name="contratoSocialFile"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
          />
          <FieldError errors={state.fieldErrors?.contratoSocialFile} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="outrosFiles">Outros documentos (opcional)</Label>
          <Input id="outrosFiles" name="outrosFiles" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple />
          <FieldError errors={state.fieldErrors?.outrosFiles} />
        </div>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            Voltar
          </Button>
          <SubmitButton />
        </div>
      </div>
    </form>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}
