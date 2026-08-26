"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCentsToBRL } from "@/lib/format";
import { calculateShippingCents } from "@/lib/shipping";
import {
  calculateFreightCents,
  surchargeLabel,
  type FreightRangeInput,
  type FreightRuleInput,
  type FreightSurchargeType,
} from "@/lib/freight";

export type CheckoutPickupLocation = {
  id: string;
  label: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  horarioFuncionamento: string;
  prazoDisponibilizacaoDias: number;
  documentoExigido: string;
};

export type DeliveryModality = "entrega" | "retirada" | "transportadora";

export type CheckoutSupplierGroup = {
  supplierId: string;
  supplierName: string;
  items: { id: string; name: string; quantity: number; priceCents: number }[];
  subtotalCents: number;
  freight: {
    rule: FreightRuleInput;
    ranges: FreightRangeInput[];
    availableSurcharges: { type: FreightSurchargeType; valueCents: number }[];
    realWeightKg: number;
    volumeM3: number;
    /** Precomputed server-side for every address on file (SPEC.md §10, LOG-03) — null for an
     * address where either end isn't geocoded yet, same as if LOG-03 hadn't shipped. */
    distanceKmByAddressId: Record<string, number | null>;
  } | null;
  /** SPEC.md §10, LOG-05 — empty means this supplier doesn't offer "retirada" at all. */
  pickupLocations: CheckoutPickupLocation[];
};

const MODALITY_LABELS: Record<DeliveryModality, string> = {
  entrega: "Entrega pelo fornecedor",
  retirada: "Retirada em centro de distribuição",
  transportadora: "Transportadora contratada por mim",
};

export function OrderSummary({
  groups,
  formId,
  selectedAddressId,
}: {
  groups: CheckoutSupplierGroup[];
  formId: string;
  selectedAddressId: string | undefined;
}) {
  const [selected, setSelected] = useState<Record<string, FreightSurchargeType[]>>({});
  const [modality, setModality] = useState<Record<string, DeliveryModality>>({});
  const [pickupLocationId, setPickupLocationId] = useState<Record<string, string>>({});

  function toggleSurcharge(supplierId: string, type: FreightSurchargeType, checked: boolean) {
    setSelected((prev) => {
      const current = prev[supplierId] ?? [];
      const next = checked ? [...current, type] : current.filter((t) => t !== type);
      return { ...prev, [supplierId]: next };
    });
  }

  const rows = groups.map((group) => {
    const selectedTypes = selected[group.supplierId] ?? [];
    const currentModality = modality[group.supplierId] ?? "entrega";

    if (currentModality !== "entrega") {
      const label = currentModality === "retirada" ? "Retirada — sem frete" : "Transportadora contratada — sem frete cobrado na plataforma";
      return { group, shippingCents: 0, lines: [{ label, valueCents: 0 }], selectedTypes, currentModality };
    }

    if (!group.freight) {
      const shippingCents = calculateShippingCents(group.subtotalCents);
      return { group, shippingCents, lines: [{ label: "Frete", valueCents: shippingCents }], selectedTypes, currentModality };
    }

    const selectedSurcharges = group.freight.availableSurcharges.filter((s) => selectedTypes.includes(s.type));
    const distanceKm = selectedAddressId ? (group.freight.distanceKmByAddressId[selectedAddressId] ?? null) : null;
    const breakdown = calculateFreightCents({
      rule: group.freight.rule,
      ranges: group.freight.ranges,
      selectedSurcharges,
      realWeightKg: group.freight.realWeightKg,
      volumeM3: group.freight.volumeM3,
      distanceKm,
      subtotalCents: group.subtotalCents,
    });
    return { group, shippingCents: breakdown.totalCents, lines: breakdown.lines, selectedTypes, currentModality };
  });
  const grandTotalCents = rows.reduce((sum, r) => sum + r.group.subtotalCents + r.shippingCents, 0);

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle className="text-base">Resumo do pedido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(({ group, lines, selectedTypes, currentModality }) => {
          const availableModalities: DeliveryModality[] =
            group.pickupLocations.length > 0 ? ["entrega", "retirada", "transportadora"] : ["entrega", "transportadora"];
          const selectedLocation =
            group.pickupLocations.find((l) => l.id === pickupLocationId[group.supplierId]) ?? group.pickupLocations[0];

          return (
            <div key={group.supplierId} className="border-b pb-3 text-sm last:border-0">
              <p className="font-medium text-foreground">{group.supplierName}</p>
              {group.items.map((item) => (
                <div key={item.id} className="mt-1 flex justify-between text-muted-foreground">
                  <span className="truncate pr-2">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="shrink-0">{formatCentsToBRL(item.priceCents * item.quantity)}</span>
                </div>
              ))}

              <div className="mt-2 space-y-1 rounded-md border p-2">
                <p className="text-xs font-medium text-foreground">Modalidade de entrega</p>
                {availableModalities.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="radio"
                      name={`modality-radio-${group.supplierId}`}
                      checked={currentModality === m}
                      onChange={() => setModality((prev) => ({ ...prev, [group.supplierId]: m }))}
                    />
                    <span>{MODALITY_LABELS[m]}</span>
                  </label>
                ))}
                <input type="hidden" name={`modality_${group.supplierId}`} value={currentModality} form={formId} readOnly />

                {currentModality === "retirada" && selectedLocation && (
                  <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                    {group.pickupLocations.length > 1 && (
                      <select
                        className="w-full rounded-md border bg-background px-2 py-1"
                        value={selectedLocation.id}
                        onChange={(e) => setPickupLocationId((prev) => ({ ...prev, [group.supplierId]: e.target.value }))}
                      >
                        {group.pickupLocations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="font-medium text-foreground">{selectedLocation.label}</p>
                    <p>
                      {selectedLocation.logradouro}, {selectedLocation.numero}
                      {selectedLocation.complemento ? ` — ${selectedLocation.complemento}` : ""} — {selectedLocation.bairro},{" "}
                      {selectedLocation.cidade}/{selectedLocation.estado}
                    </p>
                    <p>Horário: {selectedLocation.horarioFuncionamento}</p>
                    <p>
                      Pronto para retirada em até {selectedLocation.prazoDisponibilizacaoDias} dia
                      {selectedLocation.prazoDisponibilizacaoDias === 1 ? "" : "s"}
                    </p>
                    <p>Documento exigido: {selectedLocation.documentoExigido}</p>
                    <input type="hidden" name={`pickupLocationId_${group.supplierId}`} value={selectedLocation.id} form={formId} readOnly />
                  </div>
                )}
              </div>

              {currentModality === "entrega" && group.freight && group.freight.availableSurcharges.length > 0 && (
                <div className="mt-2 space-y-1 rounded-md border p-2">
                  <p className="text-xs font-medium text-foreground">Adicionais para esta entrega</p>
                  {group.freight.availableSurcharges.map((s) => (
                    <label key={s.type} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(s.type)}
                        onChange={(e) => toggleSurcharge(group.supplierId, s.type, e.target.checked)}
                      />
                      <span className="flex-1">{surchargeLabel(s.type)}</span>
                      <span>{formatCentsToBRL(s.valueCents)}</span>
                    </label>
                  ))}
                </div>
              )}
              <input type="hidden" name={`surcharges_${group.supplierId}`} value={selectedTypes.join(",")} form={formId} readOnly />

              <div className="mt-2 space-y-0.5">
                {lines.map((line, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span>{line.label}</span>
                    <span>{line.valueCents === 0 ? "Grátis" : formatCentsToBRL(line.valueCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex justify-between text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatCentsToBRL(grandTotalCents)}</span>
        </div>
        {/* SPEC.md §10, LOG-04: shows the delivery count so the buyer sees the consolidation
            impact of a multi-supplier cart. The other LOG-04 bullet — suggesting a supplier swap
            when it would reduce that count — is deferred: the catalog has no notion of "the same
            product from a different supplier" to swap to, and inventing an equivalence heuristic
            (category, name, etc.) was explicitly left out per product decision rather than
            guessed at here. */}
        {groups.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Este pedido gera {groups.length} entregas separadas, uma por fornecedor — o frete de cada uma é calculado e
            cobrado individualmente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
