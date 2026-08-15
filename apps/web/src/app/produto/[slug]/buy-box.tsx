"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { addToCartAction } from "@/server/actions/cart-actions";
import { toggleWishlistAction } from "@/server/actions/wishlist-actions";
import { INITIAL_FORM_STATE, type FormState } from "@/server/actions/form-state";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  suporte: "Suporte",
  fornecedor: "Fornecedor",
};

function AddToCartButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="flex-1" disabled={disabled || pending}>
      <ShoppingCart className="size-4" />
      {disabled ? "Indisponível" : pending ? "Adicionando..." : "Adicionar ao carrinho"}
    </Button>
  );
}

function WishlistButton({ isWishlisted }: { isWishlisted: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="icon"
      disabled={pending}
      aria-pressed={isWishlisted}
      aria-label={isWishlisted ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      <Heart className={cn("size-4", isWishlisted && "fill-destructive text-destructive")} />
    </Button>
  );
}

export function BuyBox({
  user,
  productId,
  minQuantity,
  multiple,
  inStock,
  isWishlisted,
}: {
  user: AuthenticatedUser | null;
  productId: string;
  minQuantity: number;
  multiple: number;
  inStock: boolean;
  isWishlisted: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(addToCartAction, INITIAL_FORM_STATE);

  if (!user) {
    return (
      <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">Entre com sua conta B2B para comprar este produto.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href="/login">Entrar para comprar</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/cadastro">Criar conta B2B</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (user.role !== "comprador") {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Contas de {ROLE_LABELS[user.role] ?? user.role} não possuem carrinho de compras.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="quantity">Quantidade</Label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min={minQuantity}
          step={multiple}
          defaultValue={minQuantity}
          disabled={!inStock}
          form="add-to-cart-form"
          className="max-w-32"
        />
        {(minQuantity > 1 || multiple > 1) && (
          <p className="text-xs text-muted-foreground">
            Pedido mínimo de {minQuantity}, em múltiplos de {multiple}.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <form id="add-to-cart-form" action={formAction} className="flex flex-1">
          <input type="hidden" name="productId" value={productId} />
          <AddToCartButton disabled={!inStock} />
        </form>
        <form action={toggleWishlistAction.bind(null, productId)}>
          <WishlistButton isWishlisted={isWishlisted} />
        </form>
      </div>
      {state.status === "error" && state.message && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "success" && state.message && (
        <p className="text-sm text-success-foreground">
          {state.message}{" "}
          <Link href="/carrinho" className="underline">
            Ver carrinho
          </Link>
        </p>
      )}
    </div>
  );
}
