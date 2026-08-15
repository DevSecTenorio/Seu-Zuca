import Link from "next/link";
import { LayoutGrid, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentUser } from "@/lib/auth/session";
import { logoutAction } from "@/server/actions/auth-actions";
import { ROLE_HOME } from "@/lib/auth/roles";
import { listTopLevelActiveCategories } from "@/server/actions/category-actions";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  suporte: "Suporte",
  fornecedor: "Fornecedor",
  comprador: "Comprador",
};

export async function Header() {
  const [user, categories] = await Promise.all([getCurrentUser(), listTopLevelActiveCategories()]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground">
            SZ
          </span>
          <span className="hidden text-lg font-semibold text-foreground sm:inline">Seu Zuca</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="hidden shrink-0 md:inline-flex">
              <LayoutGrid className="size-4" />
              Todas as categorias
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/catalogo">Todos os produtos</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/catalogo?ordenar=recentes">Lançamentos</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              {/* No promotions data model in the MVP (SPEC backlog) — points at the full
                  catalog rather than faking a filter that doesn't exist yet. */}
              <Link href="/catalogo">Promoções</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/catalogo?ordenar=mais-vendidos">Mais vendidos</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {categories.map((category) => (
              <DropdownMenuItem key={category.slug} asChild>
                <Link href={`/catalogo?categoria=${category.slug}`}>{category.name}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/seja-fornecedor">Vender no Seu Zuca</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <form action="/catalogo" method="get" className="hidden flex-1 items-center sm:flex">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              placeholder="Buscar produtos, categorias..."
              className="pl-9"
              aria-label="Buscar produtos"
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <User className="size-4" />
                  <span className="hidden sm:inline">{user.company?.nomeFantasia ?? user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate font-medium">{user.company?.nomeFantasia ?? user.email}</p>
                  <p className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[user.role]}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={ROLE_HOME[user.role]}>Meu painel</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action={logoutAction} className="w-full">
                    <button type="submit" className="w-full text-left">
                      Sair
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild>
                <Link href="/cadastro">Criar conta B2B</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
