import { requireUser } from "@/lib/auth/require-user";
import { LogoutButton } from "@/components/logout-button";
import { AdminNav, type AdminNavItem } from "./admin-nav";

// SPEC.md §7 lists 11 sidebar sections; sections without a page yet render as disabled labels
// (AdminNav skips the Link for entries with no href) instead of 404ing, so the sidebar always
// reflects the full information architecture even mid-rollout.
const NAV_ITEMS: AdminNavItem[] = [
  { label: "Visão Geral", href: "/admin" },
  { label: "Usuários" },
  { label: "Criar Fornecedor" },
  { label: "Usuários Internos" },
  { label: "Categorias", href: "/admin/categorias" },
  { label: "Unidades", href: "/admin/unidades" },
  { label: "Produtos", href: "/admin/produtos" },
  { label: "Banners" },
  { label: "Qtd. Mínimas" },
  { label: "Avaliações" },
  { label: "Relatórios" },
  { label: "Analytics" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["admin"]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4 pb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Painel Administrativo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Logado como {user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <AdminNav items={NAV_ITEMS} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
