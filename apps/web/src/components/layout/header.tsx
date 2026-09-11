import Image from "next/image";
import Link from "next/link";
import { Heart, Search, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoriesMenu } from "./categories-menu";
import { AccountMenu } from "./account-menu";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_PANEL } from "@/lib/auth/roles";
import { listTopLevelActiveCategories } from "@/server/actions/category-actions";
import { getCartForBuyer } from "@/server/queries/cart";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  suporte: "Suporte",
  fornecedor: "Fornecedor",
  comprador: "Comprador",
};

export async function Header() {
  const [user, categories] = await Promise.all([getCurrentUser(), listTopLevelActiveCategories()]);
  const cartItemCount = user?.role === "comprador" ? (await getCartForBuyer(user.id)).length : 0;

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo-seuzuca.png"
            alt="Seu Zuca"
            width={819}
            height={301}
            priority
            className="h-7 w-auto sm:h-9 md:h-11"
          />
        </Link>

        <CategoriesMenu categories={categories} />

        <Button asChild variant="ghost" size="icon" className="shrink-0 sm:hidden" aria-label="Buscar produtos">
          <Link href="/catalogo">
            <Search className="size-4" />
          </Link>
        </Button>

        <form action="/catalogo" method="get" className="hidden flex-1 items-center sm:flex">
          <div className="relative w-full max-w-xl">
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search className="size-4" />
            </button>
            <Input
              type="search"
              name="busca"
              placeholder="Buscar produtos, categorias..."
              className="pl-9"
              aria-label="Buscar produtos"
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {user?.role === "comprador" && (
            <>
              <Button asChild variant="ghost" size="icon" aria-label="Favoritos">
                <Link href="/favoritos">
                  <Heart className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className="relative" aria-label="Carrinho">
                <Link href="/carrinho">
                  <ShoppingCart className="size-4" />
                  {cartItemCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {cartItemCount}
                    </span>
                  )}
                </Link>
              </Button>
            </>
          )}
          {user ? (
            <AccountMenu
              label={user.company?.nomeFantasia ?? user.email}
              roleLabel={ROLE_LABELS[user.role]}
              panelHref={ROLE_PANEL[user.role]}
            />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="sm:h-9 sm:px-4 sm:py-2">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild size="sm" className="sm:h-9 sm:px-4 sm:py-2">
                <Link href="/cadastro">
                  <span className="sm:hidden">Cadastrar</span>
                  <span className="hidden sm:inline">Criar conta B2B</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
