"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCheckoutAction } from "@/server/actions/checkout-actions";
import { createDeliveryAddressAction } from "@/server/actions/address-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";
import { BRAZILIAN_STATES } from "@/lib/validation/register";

type Address = {
  id: string;
  label: string | null;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  isDefault: boolean;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Processando..." : label}
    </Button>
  );
}

function AddAddressForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createDeliveryAddressAction, INITIAL_FORM_STATE);
  return (
    <details className="mt-4 rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium text-primary">Adicionar novo endereço</summary>
      <form action={formAction} className="mt-4 space-y-3" noValidate>
        {state.status === "error" && state.message && <p className="text-sm text-destructive">{state.message}</p>}
        {state.status === "success" && state.message && <p className="text-sm text-success-foreground">{state.message}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="addr-label">Identificação (opcional)</Label>
          <Input id="addr-label" name="label" placeholder="Ex.: Depósito, Obra Zona Sul..." />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="addr-cep">CEP</Label>
            <Input id="addr-cep" name="cep" required />
            {state.fieldErrors?.cep && <p className="text-xs text-destructive">{state.fieldErrors.cep[0]}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="addr-logradouro">Logradouro</Label>
            <Input id="addr-logradouro" name="logradouro" required />
            {state.fieldErrors?.logradouro && <p className="text-xs text-destructive">{state.fieldErrors.logradouro[0]}</p>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="addr-numero">Número</Label>
            <Input id="addr-numero" name="numero" required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="addr-complemento">Complemento</Label>
            <Input id="addr-complemento" name="complemento" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="addr-bairro">Bairro</Label>
            <Input id="addr-bairro" name="bairro" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-cidade">Cidade</Label>
            <Input id="addr-cidade" name="cidade" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-estado">Estado</Label>
            <Select name="estado">
              <SelectTrigger id="addr-estado" className="w-full">
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
          </div>
        </div>
        <Button type="submit" variant="outline">
          Salvar endereço
        </Button>
      </form>
    </details>
  );
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX", description: "Aprovação instantânea" },
  { value: "boleto", label: "Boleto bancário", description: "Compensação em até 3 dias úteis" },
  { value: "cartao", label: "Cartão de crédito", description: "Via checkout seguro do Mercado Pago" },
] as const;

export function CheckoutForm({ addresses }: { addresses: Address[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(createCheckoutAction, INITIAL_FORM_STATE);
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];

  return (
    <form id="checkout-form" action={formAction} className="space-y-8" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <section>
        <h2 className="text-lg font-semibold text-foreground">Endereço de entrega</h2>
        <div className="mt-3 space-y-2">
          {addresses.map((address) => (
            <label
              key={address.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="addressId"
                value={address.id}
                defaultChecked={address.id === defaultAddress?.id}
                className="mt-1"
                required
              />
              <div className="text-sm">
                {address.label && <p className="font-medium text-foreground">{address.label}</p>}
                <p className="text-muted-foreground">
                  {address.logradouro}, {address.numero} — {address.bairro}, {address.cidade}/{address.estado}
                </p>
                {address.isDefault && <p className="text-xs text-muted-foreground">Endereço padrão da empresa</p>}
              </div>
            </label>
          ))}
        </div>
        <AddAddressForm />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Forma de pagamento</h2>
        <div className="mt-3 space-y-2">
          {PAYMENT_METHODS.map((method) => (
            <label
              key={method.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="radio" name="method" value={method.value} defaultChecked={method.value === "pix"} className="mt-1" required />
              <div className="text-sm">
                <p className="font-medium text-foreground">{method.label}</p>
                <p className="text-muted-foreground">{method.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <SubmitButton label="Finalizar pedido" />
    </form>
  );
}
