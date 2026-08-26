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
  } | null;
};

export function OrderSummary({ groups, formId }: { groups: CheckoutSupplierGroup[]; formId: string }) {
  const [selected, setSelected] = useState<Record<string, FreightSurchargeType[]>>({});

  function toggleSurcharge(supplierId: string, type: FreightSurchargeType, checked: boolean) {
    setSelected((prev) => {
      const current = prev[supplierId] ?? [];
      const next = checked ? [...current, type] : current.filter((t) => t !== type);
      return { ...prev, [supplierId]: next };
    });
  }

  const rows = groups.map((group) => {
    const selectedTypes = selected[group.supplierId] ?? [];

    if (!group.freight) {
      const shippingCents = calculateShippingCents(group.subtotalCents);
      return { group, shippingCents, lines: [{ label: "Frete", valueCents: shippingCents }], selectedTypes };
    }

    const selectedSurcharges = group.freight.availableSurcharges.filter((s) => selectedTypes.includes(s.type));
    const breakdown = calculateFreightCents({
      rule: group.freight.rule,
      ranges: group.freight.ranges,
      selectedSurcharges,
      realWeightKg: group.freight.realWeightKg,
      volumeM3: group.freight.volumeM3,
      distanceKm: null,
      subtotalCents: group.subtotalCents,
    });
    return { group, shippingCents: breakdown.totalCents, lines: breakdown.lines, selectedTypes };
  });
  const grandTotalCents = rows.reduce((sum, r) => sum + r.group.subtotalCents + r.shippingCents, 0);

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle className="text-base">Resumo do pedido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(({ group, lines, selectedTypes }) => (
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

            {group.freight && group.freight.availableSurcharges.length > 0 && (
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
        ))}
        <div className="flex justify-between text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatCentsToBRL(grandTotalCents)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
