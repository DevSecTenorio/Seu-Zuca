import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogoutUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Heart, User, Menu, X, Package, BarChart2, Users, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isAdmin, isSupplier, isApprovedBuyer } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogoutUser();

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-[hsl(220,35%,14%)] text-white border-b border-[hsl(220,30%,20%)] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <div className="w-8 h-8 bg-[hsl(25,95%,53%)] rounded-sm flex items-center justify-center">
                <Package size={18} />
              </div>
              <span className="text-white">Seu Zuca</span>
              <Badge variant="secondary" className="text-xs bg-[hsl(25,95%,53%)] text-white border-0 ml-1">B2B</Badge>
            </Link>

            {/* Nav - desktop */}
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/catalogo" className="text-[hsl(210,20%,80%)] hover:text-white transition-colors">
                Catálogo
              </Link>
              <Link href="/categorias" className="text-[hsl(210,20%,80%)] hover:text-white transition-colors">
                Categorias
              </Link>
              {isAuthenticated && (
                <Link href="/cotacoes" className="text-[hsl(210,20%,80%)] hover:text-white transition-colors">
                  Cotações
                </Link>
              )}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  {isApprovedBuyer && (
                    <>
                      <Link href="/favoritos">
                        <Button variant="ghost" size="sm" className="text-[hsl(210,20%,80%)] hover:text-white hover:bg-[hsl(220,30%,20%)]">
                          <Heart size={18} />
                        </Button>
                      </Link>
                      <Link href="/carrinho">
                        <Button variant="ghost" size="sm" className="text-[hsl(210,20%,80%)] hover:text-white hover:bg-[hsl(220,30%,20%)]">
                          <ShoppingCart size={18} />
                        </Button>
                      </Link>
                    </>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-[hsl(210,20%,80%)] hover:text-white hover:bg-[hsl(220,30%,20%)] gap-2">
                        <User size={18} />
                        <span className="hidden sm:inline text-sm">{user?.nomeFantasia || user?.nome}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium">{user?.nomeFantasia || user?.nome}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                      <DropdownMenuSeparator />
                      {isAdmin && (
                        <DropdownMenuItem onClick={() => navigate("/admin")}>
                          <BarChart2 size={16} className="mr-2" />
                          Painel Admin
                        </DropdownMenuItem>
                      )}
                      {isSupplier && (
                        <DropdownMenuItem onClick={() => navigate("/fornecedor/painel")}>
                          <Package size={16} className="mr-2" />
                          Painel Fornecedor
                        </DropdownMenuItem>
                      )}
                      {isApprovedBuyer && (
                        <>
                          <DropdownMenuItem onClick={() => navigate("/painel")}>
                            <BarChart2 size={16} className="mr-2" />
                            Meu Painel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/pedidos")}>
                            <Package size={16} className="mr-2" />
                            Meus Pedidos
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onClick={() => navigate("/perfil")}>
                        <User size={16} className="mr-2" />
                        Minha Conta
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                        <LogOut size={16} className="mr-2" />
                        Sair
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="text-[hsl(210,20%,80%)] hover:text-white hover:bg-[hsl(220,30%,20%)]">
                      Entrar
                    </Button>
                  </Link>
                  <Link href="/cadastro">
                    <Button size="sm" className="bg-[hsl(25,95%,53%)] hover:bg-[hsl(25,95%,45%)] text-white border-0">
                      Cadastrar
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile menu toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden text-[hsl(210,20%,80%)] hover:text-white hover:bg-[hsl(220,30%,20%)]"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden bg-[hsl(220,35%,12%)] border-t border-[hsl(220,30%,20%)] px-4 py-4 space-y-2">
            <Link href="/catalogo" onClick={() => setMobileOpen(false)} className="block py-2 text-[hsl(210,20%,80%)] hover:text-white">
              Catálogo
            </Link>
            <Link href="/categorias" onClick={() => setMobileOpen(false)} className="block py-2 text-[hsl(210,20%,80%)] hover:text-white">
              Categorias
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-[hsl(220,35%,10%)] text-[hsl(210,20%,60%)] py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[hsl(25,95%,53%)] rounded-sm flex items-center justify-center">
                <Package size={14} className="text-white" />
              </div>
              <span className="font-bold text-white">Seu Zuca</span>
              <span className="text-xs">— Marketplace B2B de Materiais de Construção</span>
            </div>
            <p className="text-sm">
              Exclusivo para Pessoas Jurídicas
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
