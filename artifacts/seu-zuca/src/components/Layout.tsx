import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogoutUser, useListCategories } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, User, Search, Menu, X, ChevronDown, LayoutGrid, LogOut, Package, BarChart2, ChevronRight } from "lucide-react";
import { useState, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Category = {
  id: number;
  nome: string;
  slug: string;
  parent_id?: number | null;
  children?: Category[];
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isAdmin, isSupplier, isApprovedBuyer } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpandedCat, setMobileExpandedCat] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredCat, setHoveredCat] = useState<number | null>(null);
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogoutUser();
  const { data: categories } = useListCategories();
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const allCats = (categories as unknown as Category[]) || [];
  const rootCats = allCats.filter((c) => !c.parent_id);
  const childrenOf = (id: number) => allCats.filter((c) => c.parent_id === id);
  const navRoots = rootCats.slice(0, 8);

  function onCatEnter(id: number) {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoveredCat(id);
  }
  function onCatLeave() {
    hoverTimeout.current = setTimeout(() => setHoveredCat(null), 120);
  }
  function onDropdownEnter() {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }

  const params = new URLSearchParams(location.split("?")[1] || "");
  const activeCatId = params.get("categoryId") ? Number(params.get("categoryId")) : null;

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
              <div className="flex w-full rounded-md overflow-hidden border border-gray-300 focus-within:border-[#E85D00] transition-colors">
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

              {/* Mobile menu toggle */}
              <button
                className="md:hidden text-gray-700 p-1"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Orange category navigation bar ── */}
        <div className="bg-[#E85D00] hidden md:block relative">
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="flex items-stretch h-[42px]">

              {/* "Todas as Categorias" mega dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 bg-[#C0181A] hover:bg-[#a01418] text-white px-4 h-full text-sm font-bold transition-colors shrink-0 mr-2">
                    <LayoutGrid size={16} />
                    Todas as Categorias
                    <ChevronDown size={13} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 mt-0 p-0 rounded-none shadow-xl border-0" sideOffset={0}>
                  {rootCats.map((cat) => {
                    const subs = childrenOf(cat.id);
                    return (
                      <div key={cat.id} className="group relative">
                        <DropdownMenuItem
                          onClick={() => navigate(`/catalogo?categoryId=${cat.id}`)}
                          className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-orange-50 hover:text-[#C0181A] font-medium text-sm rounded-none"
                        >
                          <span>{cat.nome}</span>
                          {subs.length > 0 && <ChevronRight size={14} className="text-gray-400" />}
                        </DropdownMenuItem>
                        {subs.length > 0 && (
                          <div className="absolute left-full top-0 hidden group-hover:block bg-white shadow-xl border border-gray-100 w-56 z-50">
                            {subs.map((sub) => (
                              <DropdownMenuItem
                                key={sub.id}
                                onClick={() => navigate(`/catalogo?categoryId=${sub.id}`)}
                                className="px-4 py-2 text-sm cursor-pointer hover:bg-orange-50 hover:text-[#C0181A] rounded-none"
                              >
                                {sub.nome}
                              </DropdownMenuItem>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => navigate("/catalogo")}
                    className="px-4 py-2 text-sm font-semibold text-[#E85D00] cursor-pointer rounded-none"
                  >
                    Ver todos os produtos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Quick-link tabs with hover mega-menu */}
              <nav className="flex items-stretch overflow-x-auto no-scrollbar flex-1">
                {navRoots.map((cat) => {
                  const subs = childrenOf(cat.id);
                  const isActive = activeCatId === cat.id || subs.some((s) => s.id === activeCatId);
                  return (
                    <div
                      key={cat.id}
                      className="relative flex items-stretch"
                      onMouseEnter={() => onCatEnter(cat.id)}
                      onMouseLeave={onCatLeave}
                    >
                      <button
                        onClick={() => navigate(`/catalogo?categoryId=${cat.id}`)}
                        className={`flex items-center gap-1 px-4 h-full text-sm font-semibold whitespace-nowrap transition-colors border-b-2
                          ${isActive
                            ? "text-white border-white bg-white/10"
                            : "text-white/90 border-transparent hover:text-white hover:bg-white/10 hover:border-white/50"
                          }`}
                      >
                        {cat.nome}
                        {subs.length > 0 && <ChevronDown size={12} className="opacity-70" />}
                      </button>

                      {/* Sub-category dropdown on hover */}
                      {subs.length > 0 && hoveredCat === cat.id && (
                        <div
                          className="absolute top-full left-0 bg-white shadow-2xl border border-gray-100 rounded-b-lg z-50 min-w-[200px] py-2"
                          onMouseEnter={onDropdownEnter}
                          onMouseLeave={onCatLeave}
                        >
                          <div className="px-3 py-1.5 border-b border-gray-100 mb-1">
                            <span className="text-xs font-bold text-[#E85D00] uppercase tracking-wide">{cat.nome}</span>
                          </div>
                          {subs.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => { navigate(`/catalogo?categoryId=${sub.id}`); setHoveredCat(null); }}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors
                                ${activeCatId === sub.id
                                  ? "text-[#C0181A] font-semibold bg-orange-50"
                                  : "text-gray-700 hover:bg-orange-50 hover:text-[#C0181A]"
                                }`}
                            >
                              {sub.nome}
                            </button>
                          ))}
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            <button
                              onClick={() => { navigate(`/catalogo?categoryId=${cat.id}`); setHoveredCat(null); }}
                              className="w-full text-left px-4 py-2 text-xs font-semibold text-[#E85D00] hover:underline"
                            >
                              Ver tudo em {cat.nome}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* ── Mobile nav ── */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 px-4 py-3 space-y-1 max-h-[70vh] overflow-y-auto">
            {/* Categories accordion */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide pt-1 pb-2">Categorias</p>
            {rootCats.map((cat) => {
              const subs = childrenOf(cat.id);
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => { navigate(`/catalogo?categoryId=${cat.id}`); setMobileOpen(false); }}
                      className="flex-1 text-left py-2 text-sm font-medium text-gray-800"
                    >
                      {cat.nome}
                    </button>
                    {subs.length > 0 && (
                      <button
                        onClick={() => setMobileExpandedCat(mobileExpandedCat === cat.id ? null : cat.id)}
                        className="p-1 text-gray-400"
                      >
                        <ChevronDown size={16} className={`transition-transform ${mobileExpandedCat === cat.id ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                  {subs.length > 0 && mobileExpandedCat === cat.id && (
                    <div className="pl-3 border-l-2 border-orange-200 ml-2 mb-1">
                      {subs.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => { navigate(`/catalogo?categoryId=${sub.id}`); setMobileOpen(false); }}
                          className="block w-full text-left py-1.5 text-sm text-gray-600 hover:text-[#C0181A]"
                        >
                          {sub.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="border-t border-gray-100 pt-3 mt-2 space-y-1">
              {isAuthenticated && (
                <>
                  <Link href="/pedidos" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700 text-sm">Meus Pedidos</Link>
                  <Link href="/favoritos" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700 text-sm">Favoritos</Link>
                  <Link href="/cotacoes" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700 text-sm">Cotações</Link>
                  {isAdmin && <Link href="/admin" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700 text-sm">Painel Admin</Link>}
                  {isSupplier && <Link href="/fornecedor/painel" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700 text-sm">Painel Fornecedor</Link>}
                  <button onClick={handleLogout} className="block py-2 text-red-600 font-medium text-left w-full text-sm">Sair</button>
                </>
              )}
              {!isAuthenticated && (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="block py-2 text-gray-700 font-medium text-sm">Entrar</Link>
                  <Link href="/cadastro" onClick={() => setMobileOpen(false)} className="block py-2 text-[#C0181A] font-semibold text-sm">Cadastrar conta B2B</Link>
                </>
              )}
            </div>
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
              <div className="bg-white rounded-lg px-3 py-1.5 inline-block mb-4">
                <img
                  src="/logo-seuzuca.png"
                  alt="Seu Zuca"
                  className="h-[40px] w-auto object-contain"
                />
              </div>
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
