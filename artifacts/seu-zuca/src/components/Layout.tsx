import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogoutUser, useListCategories } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, User, Search, Menu, X, ChevronDown, LayoutGrid, LogOut, Package, BarChart2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isAdmin, isSupplier, isApprovedBuyer } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogoutUser();
  const { data: categories } = useListCategories();

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    navigate("/");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalogo?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  const navCategories = categories?.slice(0, 8) || [];

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4">
          <div className="flex items-center gap-4 h-[72px]">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <img
                src="/logo-seuzuca.png"
                alt="Seu Zuca — Pediu, Chegou"
                className="h-[64px] w-auto object-contain"
              />
            </Link>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex-1 flex">
              <div className="flex w-full rounded-md overflow-hidden border border-gray-300 focus-within:border-[#E85D00]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="O que você está procurando?"
                  className="flex-1 px-4 py-2.5 text-sm outline-none bg-white text-gray-800 placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  className="bg-[#E85D00] hover:bg-[#d05000] text-white px-5 flex items-center justify-center transition-colors"
                >
                  <Search size={20} />
                </button>
              </div>
            </form>

            {/* User + Cart */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-gray-700 hover:text-[#C0181A] transition-colors">
                      <User size={22} />
                      <div className="hidden md:block text-left">
                        <p className="text-xs text-gray-500">Olá,</p>
                        <p className="text-sm font-semibold leading-tight">{user?.nomeFantasia || user?.nome}</p>
                      </div>
                      <ChevronDown size={14} className="hidden md:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2 border-b">
                      <p className="text-sm font-semibold">{user?.nomeFantasia || user?.razaoSocial || user?.nome}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        <BarChart2 size={15} className="mr-2" />
                        Painel Admin
                      </DropdownMenuItem>
                    )}
                    {isSupplier && (
                      <DropdownMenuItem onClick={() => navigate("/fornecedor/painel")}>
                        <Package size={15} className="mr-2" />
                        Painel Fornecedor
                      </DropdownMenuItem>
                    )}
                    {isApprovedBuyer && (
                      <>
                        <DropdownMenuItem onClick={() => navigate("/pedidos")}>
                          <Package size={15} className="mr-2" />
                          Meus Pedidos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/favoritos")}>
                          Meus Favoritos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/cotacoes")}>
                          Minhas Cotações
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                      <LogOut size={15} className="mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/login">
                  <button className="flex items-center gap-2 text-gray-700 hover:text-[#C0181A] transition-colors">
                    <User size={22} />
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-semibold leading-tight">Entrar ou criar</p>
                      <p className="text-sm font-semibold leading-tight">conta</p>
                    </div>
                  </button>
                </Link>
              )}

              {/* Cart */}
              <Link href="/carrinho">
                <button className="bg-[#E85D00] hover:bg-[#d05000] text-white rounded-md p-2.5 transition-colors flex items-center gap-1">
                  <ShoppingCart size={20} />
                </button>
              </Link>

              {/* Mobile menu */}
              <button
                className="md:hidden text-gray-700 p-1"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Category navigation bar */}
        <div className="bg-white border-t border-gray-100 hidden md:block">
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="flex items-center h-10">
              {/* Categorias dropdown button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 bg-[#E85D00] text-white px-4 h-full text-sm font-semibold hover:bg-[#d05000] transition-colors shrink-0 mr-6">
                    <LayoutGrid size={16} />
                    Categorias
                    <ChevronDown size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 mt-0">
                  {navCategories.map((cat) => (
                    <DropdownMenuItem key={cat.id} onClick={() => navigate(`/catalogo?categoryId=${cat.id}`)}>
                      {cat.nome}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/catalogo")}>
                    Ver todos os produtos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Category quick links */}
              <nav className="flex items-center gap-5 overflow-x-auto no-scrollbar">
                {navCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/catalogo?categoryId=${cat.id}`}
                    className="text-sm text-gray-700 hover:text-[#C0181A] whitespace-nowrap font-medium transition-colors shrink-0"
                  >
                    {cat.nome}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 px-4 py-3 space-y-2">
            <Link href="/catalogo" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700 font-medium">Catálogo</Link>
            {isAuthenticated && (
              <>
                <Link href="/pedidos" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700">Meus Pedidos</Link>
                <Link href="/favoritos" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700">Favoritos</Link>
                <Link href="/cotacoes" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700">Cotações</Link>
                {isAdmin && <Link href="/admin" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700">Painel Admin</Link>}
                {isSupplier && <Link href="/fornecedor/painel" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700">Painel Fornecedor</Link>}
                <button onClick={handleLogout} className="block py-2 text-red-600 font-medium text-left w-full">Sair</button>
              </>
            )}
            {!isAuthenticated && (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700 font-medium">Entrar</Link>
                <Link href="/cadastro" onClick={() => setMobileOpen(false)} className="block py-2 text-[#C0181A] font-semibold">Cadastrar conta B2B</Link>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-gray-400 mt-8">
        <div className="max-w-[1280px] mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <img
                src="/logo-seuzuca.png"
                alt="Seu Zuca"
                className="h-[48px] w-auto object-contain mb-4 brightness-0 invert"
              />
              <p className="text-sm">Marketplace B2B exclusivo para Pessoas Jurídicas. Materiais de construção em grande volume.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Institucional</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/" className="hover:text-white transition-colors">Quem somos</Link></li>
                <li><Link href="/" className="hover:text-white transition-colors">Como funciona</Link></li>
                <li><Link href="/" className="hover:text-white transition-colors">Seja um fornecedor</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Minha conta</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/pedidos" className="hover:text-white transition-colors">Meus pedidos</Link></li>
                <li><Link href="/cotacoes" className="hover:text-white transition-colors">Minhas cotações</Link></li>
                <li><Link href="/favoritos" className="hover:text-white transition-colors">Favoritos</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Atendimento</h4>
              <ul className="space-y-2 text-sm">
                <li>Segunda a sexta, 8h às 18h</li>
                <li>contato@seuzuca.com.br</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-xs">
            <p>© 2026 Seu Zuca — Marketplace B2B de Materiais de Construção. Todos os direitos reservados.</p>
            <p>Exclusivo para Pessoas Jurídicas (CNPJ obrigatório)</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
