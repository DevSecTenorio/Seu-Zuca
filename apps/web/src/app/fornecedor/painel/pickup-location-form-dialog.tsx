"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPickupLocationAction, updatePickupLocationAction } from "@/server/actions/pickup-location-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";
import { BRAZILIAN_STATES } from "@/lib/validation/register";

export type PickupLocationData = {
  id: string;
  label: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  horarioFuncionamento: string;
  prazoDisponibilizacaoDias: number;
  documentoExigido: string;
  active: boolean;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function PickupLocationFormDialog({ mode, location }: { mode: "create" | "edit"; location?: PickupLocationData }) {
  const [open, setOpen] = useState(false);
  const action = mode === "edit" && location ? updatePickupLocationAction.bind(null, location.id) : createPickupLocationAction;
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);
  const [estado, setEstado] = useState(location?.estado ?? "");

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
            <Plus className="size-4" /> Novo local
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Editar local de retirada">
            <Pencil className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo local de retirada" : "Editar local de retirada"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="pl-label">Nome do local</Label>
            <Input id="pl-label" name="label" placeholder="Ex.: Depósito Central" defaultValue={location?.label} required />
            {state.fieldErrors?.label && <p className="text-sm text-destructive">{state.fieldErrors.label[0]}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="pl-cep">CEP</Label>
              <Input id="pl-cep" name="cep" defaultValue={location?.cep} required />
              {state.fieldErrors?.cep && <p className="text-xs text-destructive">{state.fieldErrors.cep[0]}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pl-logradouro">Logradouro</Label>
              <Input id="pl-logradouro" name="logradouro" defaultValue={location?.logradouro} required />
              {state.fieldErrors?.logradouro && <p className="text-xs text-destructive">{state.fieldErrors.logradouro[0]}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pl-numero">Número</Label>
              <Input id="pl-numero" name="numero" defaultValue={location?.numero} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pl-complemento">Complemento</Label>
              <Input id="pl-complemento" name="complemento" defaultValue={location?.complemento ?? ""} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pl-bairro">Bairro</Label>
              <Input id="pl-bairro" name="bairro" defaultValue={location?.bairro} required />
              {state.fieldErrors?.bairro && <p className="text-xs text-destructive">{state.fieldErrors.bairro[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-cidade">Cidade</Label>
              <Input id="pl-cidade" name="cidade" defaultValue={location?.cidade} required />
              {state.fieldErrors?.cidade && <p className="text-xs text-destructive">{state.fieldErrors.cidade[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-estado">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger id="pl-estado" className="w-full">
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
              <input type="hidden" name="estado" value={estado} readOnly />
              {state.fieldErrors?.estado && <p className="text-xs text-destructive">{state.fieldErrors.estado[0]}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pl-horario">Horário de funcionamento</Label>
            <Input
              id="pl-horario"
              name="horarioFuncionamento"
              placeholder="Ex.: Seg-Sex 8h-18h, Sáb 8h-12h"
              defaultValue={location?.horarioFuncionamento}
              required
            />
            {state.fieldErrors?.horarioFuncionamento && (
              <p className="text-sm text-destructive">{state.fieldErrors.horarioFuncionamento[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pl-prazo">Prazo de disponibilização (dias)</Label>
            <Input
              id="pl-prazo"
              name="prazoDisponibilizacaoDias"
              type="number"
              min={0}
              className="max-w-40"
              defaultValue={location?.prazoDisponibilizacaoDias ?? 1}
              required
            />
            <p className="text-xs text-muted-foreground">Quantos dias após o pagamento o pedido fica pronto para retirada.</p>
            {state.fieldErrors?.prazoDisponibilizacaoDias && (
              <p className="text-sm text-destructive">{state.fieldErrors.prazoDisponibilizacaoDias[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pl-documento">Documento exigido na retirada</Label>
            <Textarea
              id="pl-documento"
              name="documentoExigido"
              rows={2}
              placeholder="Ex.: RG e CNPJ ou documento com foto do responsável pela retirada"
              defaultValue={location?.documentoExigido}
              required
            />
            {state.fieldErrors?.documentoExigido && (
              <p className="text-sm text-destructive">{state.fieldErrors.documentoExigido[0]}</p>
            )}
          </div>

          {state.status === "error" && state.message && <p className="text-sm text-destructive">{state.message}</p>}

          <DialogFooter>
            <SubmitButton label={mode === "create" ? "Criar local" : "Salvar alterações"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
