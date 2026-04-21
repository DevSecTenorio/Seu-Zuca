import { useMemo } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Star, SlidersHorizontal, Building2, Heart } from "lucide-react";
import { useAddToWishlist } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Catalog() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { isApprovedBuyer, isAdmin, isSupplier } = useAuth();
  const { toast } = useToast();
  const canSeePrice = isApprovedBuyer || isAdmin || isSupplier;

  /* Derive filter state from URL — stays in sync with nav bar clicks */
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const selectedCategory = params.get("categoryId") || "all";
  const urlSearch = params.get("search") || params.get("q") || "";

  const [sortBy, setSortBy] = useState("createdAt");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListProducts({
    search: urlSearch || undefined,
    categoryId: selectedCategory !== "all" ? Number(selectedCategory) : undefined,
    orderBy: sortBy as "nome" | "preco" | "estoque" | "createdAt",
    page,
    limit: 16,
  });
  const { data: categories } = useListCategories();
  const wishlistMutation = useAddToWishlist();

  function goCategory(id: string | "all") {
    const next = new URLSearchParams(search);
    if (id === "all") {
      next.delete("categoryId");
    } else {
      next.set("categoryId", id);
    }
    next.delete("search");
    next.delete("q");
    setPage(1);
    navigate(`/catalogo?${next.toString()}`);
  }

  async function handleWishlist(e: React.MouseEvent, productId: number) {
    e.preventDefault();
    try {
      await wishlistMutation.mutateAsync({ data: { productId } });
      toast({ title: "Adicionado aos favoritos" });
    } catch {
      toast({ title: "Faça login para adicionar favoritos", variant: "destructive" });
    }
  }

  const categoryName = useMemo(() => {
    if (selectedCategory === "all") return "Todos os produtos";
    return categories?.find((c) => String(c.id) === selectedCategory)?.nome || "Categoria";
  }, [selectedCategory, categories]);

  return (
    <Layout>
      <div className="max-w-[1280px] mx-auto px-4 py-6">
        {/* Page title + sort */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{categoryName}</h1>
            {urlSearch && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Resultado para: <span className="font-semibold text-gray-800">"{urlSearch}"</span>
              </p>
            )}
          </div>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-48 bg-white border-gray-200">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Mais recentes</SelectItem>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
              {canSeePrice && <SelectItem value="preco">Menor preço</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 p-4 sticky top-[140px]">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                <SlidersHorizontal size={15} className="text-gray-500" />
                <span className="font-semibold text-sm text-gray-700">Categorias</span>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => goCategory("all")}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${selectedCategory === "all" ? "bg-[#C0181A] text-white font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  Todos os produtos
                </button>
                {categories?.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => goCategory(String(cat.id))}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${selectedCategory === String(cat.id) ? "bg-[#C0181A] text-white font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    {cat.nome}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">
            {/* Mobile categories */}
            <div className="lg:hidden flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => goCategory("all")}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedCategory === "all" ? "bg-[#C0181A] text-white border-[#C0181A]" : "bg-white border-gray-200 text-gray-600"}`}
              >
                Todos
              </button>
              {categories?.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => goCategory(String(cat.id))}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${selectedCategory === String(cat.id) ? "bg-[#C0181A] text-white border-[#C0181A]" : "bg-white border-gray-200 text-gray-600"}`}
                >
                  {cat.nome}
                </button>
              ))}
            </div>

            {data && (
              <p className="text-sm text-gray-500 mb-4">
                <span className="font-semibold text-gray-800">{data.total}</span>{" "}
                {data.total === 1 ? "produto encontrado" : "produtos encontrados"}
              </p>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-5 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : data?.products && data.products.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {data.products.map((product) => (
                  <Link key={product.id} href={`/produto/${product.slug || product.id}`}>
                    <div className="bg-white rounded-xl border border-gray-100 hover:border-[#E85D00] hover:shadow-md transition-all cursor-pointer overflow-hidden group">
                      <div className="aspect-square bg-gray-50 overflow-hidden relative">
                        {product.imagemPrincipal ? (
                          <img
                            src={product.imagemPrincipal}
                            alt={product.nome}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-200">
                            <Building2 size={48} />
                          </div>
                        )}
                        <button
                          onClick={(e) => handleWishlist(e, product.id)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#C0181A]"
                        >
                          <Heart size={13} className="text-gray-400" />
                        </button>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-gray-400 mb-1">{product.categoryName}</p>
                        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug mb-1.5">
                          {product.nome}
                        </h3>
                        <div className="flex items-center gap-0.5 mb-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={10} className="text-[#FFC107] fill-[#FFC107]" />
                          ))}
                        </div>
                        {canSeePrice ? (
                          <div>
                            <p className="text-[#C0181A] font-black text-base leading-tight">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.preco || 0)}
                            </p>
                            <p className="text-gray-400 text-xs">/{product.unidadeMedida}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-gray-50 rounded-md px-2 py-1">
                            <Lock size={10} className="text-gray-400" />
                            <span className="text-xs text-gray-500">Login para ver</span>
                          </div>
                        )}
                        <div className="mt-2">
                          <span className={`text-xs font-medium ${product.disponivel ? "text-green-600" : "text-gray-400"}`}>
                            {product.disponivel ? "Em estoque" : "Indisponível"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-400">
                <Building2 size={56} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium text-gray-600">Nenhum produto encontrado</p>
                <p className="text-sm mt-1">Tente ajustar os filtros ou termos de busca</p>
              </div>
            )}

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm hover:border-[#E85D00] disabled:opacity-40 transition-colors"
                >
                  Anterior
                </button>
                {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${p === page ? "bg-[#C0181A] text-white" : "bg-white border border-gray-200 hover:border-[#E85D00]"}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={page === data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm hover:border-[#E85D00] disabled:opacity-40 transition-colors"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
