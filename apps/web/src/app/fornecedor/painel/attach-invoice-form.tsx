"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supplierAttachInvoiceAction } from "@/server/actions/order-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function SubmitButton({ hasInvoice }: { hasInvoice: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={hasInvoice ? "outline" : "default"} disabled={pending}>
      {pending ? "..." : hasInvoice ? "Substituir NF" : "Anexar NF"}
    </Button>
  );
}

export function AttachInvoiceForm({ orderId, hasInvoice }: { orderId: string; hasInvoice: boolean }) {
  const action = supplierAttachInvoiceAction.bind(null, orderId);
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
      <Input name="invoiceFile" type="file" accept="application/pdf" required className="h-8 w-48 text-xs" />
      <SubmitButton hasInvoice={hasInvoice} />
      {state.status === "error" && (state.message || state.fieldErrors?.invoiceFile) && (
        <p className="text-xs text-destructive">{state.message ?? state.fieldErrors?.invoiceFile?.[0]}</p>
      )}
      {state.status === "success" && <p className="text-xs text-muted-foreground">Nota fiscal enviada.</p>}
    </form>
  );
}
