"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCentsToBRL } from "@/lib/format";
import { removeCartItemAction, updateCartItemQuantityAction } from "@/server/actions/cart-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

function UpdateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "..." : "Atualizar"}
    </Button>
  );
}

export function CartItemRow({
  item,
  minQuantity,
  multiple,
}: {
  item: {
    id: string;
    quantity: number;
    product: {
      slug: string;
      name: string;
      priceCents: number;
      stock: number;
      unit: { abbreviation: string };
      images: { url: string }[];
    };
  };
  minQuantity: number;
  multiple: number;
}) {
  const updateAction = updateCartItemQuantityAction.bind(null, item.id);
  const [state, formAction] = useActionState<FormState, FormData>(updateAction, INITIAL_FORM_STATE);
  const image = item.product.images[0];

  return (
    <div className="flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-center">
      <Link href={`/produto/${item.product.slug}`} className="relative size-16 shrink-0 overflow-hidden rounded-md border bg-muted">
        {image ? (
          <Image src={image.url} alt={item.product.name} fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="size-6 text-muted-foreground/40" />
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/produto/${item.product.slug}`} className="font-medium text-foreground hover:underline">
          {item.product.name}
        </Link>
        <p className="text-sm text-muted-foreground">
          {formatCentsToBRL(item.product.priceCents)} por {item.product.unit.abbreviation}
        </p>
        {state.status === "error" && state.message && <p className="mt-1 text-sm text-destructive">{state.message}</p>}
      </div>

      <form action={formAction} className="flex items-center gap-2">
        <Input
          type="number"
          name="quantity"
          min={minQuantity}
          step={multiple}
          defaultValue={item.quantity}
          className="w-20"
          aria-label={`Quantidade de ${item.product.name}`}
        />
        <UpdateButton />
      </form>

      <p className="w-28 shrink-0 text-right font-medium text-foreground">
        {formatCentsToBRL(item.product.priceCents * item.quantity)}
      </p>

      <form action={removeCartItemAction.bind(null, item.id)}>
        <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Remover ${item.product.name}`}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </form>
    </div>
  );
}
