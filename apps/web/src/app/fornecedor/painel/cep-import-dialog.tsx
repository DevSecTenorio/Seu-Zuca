"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { applyCepImportAction, simulateCepImportAction, type CepSimulationState } from "@/server/actions/logistics-actions";

const INITIAL_STATE: CepSimulationState = { status: "idle" };

function SimulateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Lendo planilha..." : "Simular"}
    </Button>
  );
}

export function CepImportDialog({ areaId }: { areaId: string }) {
  const [open, setOpen] = useState(false);
  const simulateAction = simulateCepImportAction.bind(null, areaId);
  const [state, formAction] = useActionState<CepSimulationState, FormData>(simulateAction, INITIAL_STATE);
  const [applying, startApplying] = useTransition();
  const [applyResult, setApplyResult] = useState<{ status: "error" | "success"; message: string } | null>(null);

  function handleApply() {
    if (state.status !== "success") return;
    startApplying(async () => {
      const result = await applyCepImportAction(areaId, state.payload);
      setApplyResult({ status: result.status === "success" ? "success" : "error", message: result.message ?? "" });
      if (result.status === "success") setTimeout(() => setOpen(false), 1200);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setApplyResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="size-4" /> Importar planilha de CEPs
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar malha de CEPs</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="file">Planilha (.xlsx ou .csv)</Label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".xlsx,.csv"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs file:mr-2 file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Uma coluna &quot;cep&quot;, ou duas colunas &quot;cep_inicial&quot; e &quot;cep_final&quot; para faixas.
            </p>
          </div>
          {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
          <DialogFooter>
            <SimulateButton />
          </DialogFooter>
        </form>

        {state.status === "success" && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <p className="text-sm font-medium text-foreground">Simulação — antes de aplicar</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>{state.diff.totalParsed} faixas de CEP reconhecidas na planilha.</li>
                <li className="text-emerald-600 dark:text-emerald-500">+{state.diff.added} novas faixas serão adicionadas.</li>
                <li className="text-destructive">-{state.diff.removed} faixas atuais serão removidas.</li>
                <li>{state.diff.unchanged} faixas continuam iguais.</li>
              </ul>
            </div>
            {applyResult?.status === "error" && <p className="text-sm text-destructive">{applyResult.message}</p>}
            {applyResult?.status === "success" && <p className="text-sm text-emerald-600 dark:text-emerald-500">{applyResult.message}</p>}
            <Button onClick={handleApply} disabled={applying}>
              {applying ? "Aplicando..." : "Aplicar esta malha de CEPs"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
