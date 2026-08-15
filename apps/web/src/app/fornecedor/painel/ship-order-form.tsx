"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supplierShipOrderAction } from "@/server/actions/order-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "..." : "Marcar como enviado"}
    </Button>
  );
}

export function ShipOrderForm({ orderId }: { orderId: string }) {
  const action = supplierShipOrderAction.bind(null, orderId);
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
      <Input name="trackingCode" placeholder="Código de rastreio" className="h-8 w-40 text-xs" required />
      <SubmitButton />
      {state.status === "error" && (state.message || state.fieldErrors?.trackingCode) && (
        <p className="text-xs text-destructive">{state.message ?? state.fieldErrors?.trackingCode?.[0]}</p>
      )}
    </form>
  );
}
