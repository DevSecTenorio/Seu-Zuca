import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthenticatedUser } from "@/lib/auth/session";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  suporte: "Suporte",
  fornecedor: "Fornecedor",
};

export function BuyBox({
  user,
  minQuantity,
  multiple,
  inStock,
}: {
  user: AuthenticatedUser | null;
  minQuantity: number;
  multiple: number;
  inStock: boolean;
}) {
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
          type="number"
          min={minQuantity}
          step={multiple}
          defaultValue={minQuantity}
          disabled={!inStock}
          className="max-w-32"
        />
        {(minQuantity > 1 || multiple > 1) && (
          <p className="text-xs text-muted-foreground">
            Pedido mínimo de {minQuantity}, em múltiplos de {multiple}.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled title="Carrinho disponível na próxima etapa do projeto">
          <ShoppingCart className="size-4" />
          {inStock ? "Adicionar ao carrinho" : "Indisponível"}
        </Button>
        <Button variant="outline" size="icon" disabled title="Favoritos disponíveis na próxima etapa do projeto">
          <Heart className="size-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O carrinho de compras é liberado na próxima etapa do projeto (checkout e pagamentos).
      </p>
    </div>
  );
}
