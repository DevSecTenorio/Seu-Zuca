"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StarRatingInput } from "@/components/star-rating-input";
import { submitReviewAction } from "@/server/actions/review-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando..." : "Enviar avaliação"}
    </Button>
  );
}

export function ReviewDialog({ orderId, productId, productName }: { orderId: string; productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const action = submitReviewAction.bind(null, orderId, productId);
  const [state, formAction] = useActionState<FormState, FormData>(action, INITIAL_FORM_STATE);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Avaliar
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avaliar &ldquo;{productName}&rdquo;</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label>Nota</Label>
            <StarRatingInput name="rating" />
            {state.fieldErrors?.rating && <p className="text-sm text-destructive">{state.fieldErrors.rating[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment">Comentário (opcional)</Label>
            <Textarea id="comment" name="comment" rows={4} placeholder="Conte como foi sua experiência com o produto..." />
          </div>
          {state.status === "error" && state.message && <p className="text-sm text-destructive">{state.message}</p>}
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
