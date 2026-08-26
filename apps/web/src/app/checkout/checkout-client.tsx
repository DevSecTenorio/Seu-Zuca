"use client";

import { useState } from "react";
import { CheckoutForm } from "./checkout-form";
import { OrderSummary, type CheckoutSupplierGroup } from "./order-summary";

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

/** Holds which delivery address is selected, shared between CheckoutForm (the radio buttons) and
 * OrderSummary (which needs to know the address to pick the right precomputed route distance for
 * distance-based freight — SPEC.md §10, LOG-03). */
export function CheckoutClient({ addresses, groups }: { addresses: Address[]; groups: CheckoutSupplierGroup[] }) {
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(defaultAddress?.id);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <CheckoutForm addresses={addresses} onAddressChange={setSelectedAddressId} />
      <OrderSummary groups={groups} formId="checkout-form" selectedAddressId={selectedAddressId} />
    </div>
  );
}
