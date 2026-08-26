"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveFreightRuleAction } from "@/server/actions/freight-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";
import { parseBRL } from "@/lib/validation/catalog";
import type { FreightSurchargeType } from "@/lib/freight";

type ChargeType = "fixo" | "por_km" | "por_kg" | "por_km_kg";

const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  fixo: "Valor fixo",
  por_km: "R$ por km",
  por_kg: "R$ por kg",
  por_km_kg: "R$ por km × kg",
};

const VALUE_LABELS: Record<ChargeType, string> = {
  fixo: "Valor da faixa (R$)",
  por_km: "Taxa (R$/km)",
  por_kg: "Taxa (R$/kg)",
  por_km_kg: "Taxa (R$/km×kg)",
};

const SURCHARGE_TYPES: { type: FreightSurchargeType; label: string }[] = [
  { type: "descarga", label: "Descarga" },
  { type: "munck", label: "Munck" },
  { type: "ajudante", label: "Ajudante" },
  { type: "andar", label: "Andar (sem elevador)" },
  { type: "fim_de_semana", label: "Entrega em fim de semana" },
  { type: "dificil_acesso", label: "Difícil acesso" },
  { type: "pedagio", label: "Pedágio" },
];

type RangeRow = {
  distanceFromKm: string;
  distanceToKm: string;
  weightFromKg: string;
  weightToKg: string;
  valueReais: string;
};

type SurchargeRow = { type: FreightSurchargeType; active: boolean; valueReais: string };

export type FreightRuleData = {
  chargeType: ChargeType;
  cubicFactorKgPerM3: number;
  minFreightCents: number;
  freeShippingMinSubtotalCents: number | null;
  freeShippingMaxWeightKg: number | null;
  ranges: { distanceFromKm: number | null; distanceToKm: number | null; weightFromKg: number | null; weightToKg: number | null; valueCents: number }[];
  surcharges: { type: FreightSurchargeType; active: boolean; valueCents: number }[];
};

function centsToReaisText(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function toReaisText(value: number | null): string {
  return value === null ? "" : centsToReaisText(value);
}

function emptyRange(): RangeRow {
  return { distanceFromKm: "", distanceToKm: "", weightFromKg: "", weightToKg: "", valueReais: "" };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar configuração de frete"}
    </Button>
  );
}

export function FreightForm({ config }: { config: FreightRuleData | null }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveFreightRuleAction, INITIAL_FORM_STATE);
  const [chargeType, setChargeType] = useState<ChargeType>(config?.chargeType ?? "fixo");
  const [ranges, setRanges] = useState<RangeRow[]>(
    config && config.ranges.length > 0
      ? config.ranges.map((r) => ({
          distanceFromKm: r.distanceFromKm?.toString() ?? "",
          distanceToKm: r.distanceToKm?.toString() ?? "",
          weightFromKg: r.weightFromKg?.toString() ?? "",
          weightToKg: r.weightToKg?.toString() ?? "",
          valueReais: centsToReaisText(r.valueCents),
        }))
      : [emptyRange()],
  );
  const [surcharges, setSurcharges] = useState<SurchargeRow[]>(
    SURCHARGE_TYPES.map(({ type }) => {
      const existing = config?.surcharges.find((s) => s.type === type);
      return { type, active: existing?.active ?? false, valueReais: existing ? centsToReaisText(existing.valueCents) : "" };
    }),
  );

  const needsDistance = chargeType === "por_km" || chargeType === "por_km_kg";

  function updateRange(index: number, patch: Partial<RangeRow>) {
    setRanges((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRange(index: number) {
    setRanges((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSurcharge(index: number, patch: Partial<SurchargeRow>) {
    setSurcharges((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  const rangesJson = JSON.stringify(
    ranges
      .filter((r) => r.valueReais.trim() !== "")
      .map((r) => ({
        distanceFromKm: r.distanceFromKm.trim() === "" ? null : parseInt(r.distanceFromKm, 10),
        distanceToKm: r.distanceToKm.trim() === "" ? null : parseInt(r.distanceToKm, 10),
        weightFromKg: r.weightFromKg.trim() === "" ? null : parseBRL(r.weightFromKg),
        weightToKg: r.weightToKg.trim() === "" ? null : parseBRL(r.weightToKg),
        valueCents: Math.round(parseBRL(r.valueReais) * 100),
      })),
  );

  const surchargesJson = JSON.stringify(
    surcharges
      .filter((s) => s.active)
      .map((s) => ({ type: s.type, active: true, valueCents: Math.round((parseBRL(s.valueReais) || 0) * 100) })),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Motor de frete</CardTitle>
        <CardDescription>
          Faixas por distância e peso, peso cubado (maior entre real e volumétrico) e adicionais que o comprador escolhe no
          checkout. Frete por distância usa a distância real de rota entre o endereço da sua empresa e o do comprador; se algum
          dos dois ainda não tiver sido geocodificado, o piso mínimo garante que o frete nunca fique zerado indevidamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="chargeType">Tipo de cobrança</Label>
              <Select value={chargeType} onValueChange={(v) => setChargeType(v as ChargeType)}>
                <SelectTrigger id="chargeType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHARGE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="chargeType" value={chargeType} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cubicFactorKgPerM3">Fator de cubagem (kg/m³)</Label>
              <Input
                id="cubicFactorKgPerM3"
                name="cubicFactorKgPerM3"
                type="number"
                min={1}
                defaultValue={config?.cubicFactorKgPerM3 ?? 300}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minFreightReais">Piso mínimo (R$)</Label>
              <Input
                id="minFreightReais"
                name="minFreightReais"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={toReaisText(config?.minFreightCents ?? 0)}
                required
              />
              {state.fieldErrors?.minFreightReais && (
                <p className="text-sm text-destructive">{state.fieldErrors.minFreightReais[0]}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="freeShippingMinSubtotalReais">Frete grátis a partir de (R$, opcional)</Label>
              <Input
                id="freeShippingMinSubtotalReais"
                name="freeShippingMinSubtotalReais"
                inputMode="decimal"
                placeholder="Sem mínimo"
                defaultValue={toReaisText(config?.freeShippingMinSubtotalCents ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="freeShippingMaxWeightKg">Frete grátis até (kg, opcional)</Label>
              <Input
                id="freeShippingMaxWeightKg"
                name="freeShippingMaxWeightKg"
                type="number"
                step="0.01"
                min={0}
                placeholder="Sem máximo"
                defaultValue={config?.freeShippingMaxWeightKg ?? undefined}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Faixas de {needsDistance ? "distância e peso" : "peso"}</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setRanges((prev) => [...prev, emptyRange()])}>
                <Plus className="size-4" /> Nova faixa
              </Button>
            </div>
            <div className="space-y-2">
              {ranges.map((range, index) => (
                <div key={index} className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-6 sm:items-end">
                  {needsDistance && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">De (km)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={range.distanceFromKm}
                          onChange={(e) => updateRange(index, { distanceFromKm: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Até (km)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={range.distanceToKm}
                          onChange={(e) => updateRange(index, { distanceToKm: e.target.value })}
                          placeholder="Sem limite"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Peso de (kg)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={range.weightFromKg}
                      onChange={(e) => updateRange(index, { weightFromKg: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Peso até (kg)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={range.weightToKg}
                      onChange={(e) => updateRange(index, { weightToKg: e.target.value })}
                      placeholder="Sem limite"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{VALUE_LABELS[chargeType]}</Label>
                    <Input
                      inputMode="decimal"
                      value={range.valueReais}
                      onChange={(e) => updateRange(index, { valueReais: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remover faixa"
                    onClick={() => removeRange(index)}
                    disabled={ranges.length === 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <input type="hidden" name="rangesJson" value={rangesJson} readOnly />
          </div>

          <div className="space-y-3">
            <Label>Adicionais (o comprador escolhe no checkout)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {surcharges.map((row, index) => (
                <label key={row.type} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) => updateSurcharge(index, { active: e.target.checked })}
                  />
                  <span className="flex-1">{SURCHARGE_TYPES[index].label}</span>
                  <Input
                    inputMode="decimal"
                    className="w-24"
                    placeholder="R$"
                    value={row.valueReais}
                    onChange={(e) => updateSurcharge(index, { valueReais: e.target.value })}
                    disabled={!row.active}
                  />
                </label>
              ))}
            </div>
            <input type="hidden" name="surchargesJson" value={surchargesJson} readOnly />
          </div>

          {state.status === "error" && state.message && <p className="text-sm text-destructive">{state.message}</p>}
          {state.status === "success" && state.message && <p className="text-sm text-success-foreground">{state.message}</p>}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
