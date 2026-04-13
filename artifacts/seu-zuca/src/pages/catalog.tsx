import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HardHat, Lock, Search, SlidersHorizontal, Heart } from "lucide-react";
import { useAddToWishlist } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function Catalog() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [searchText, setSearchText] = useState(params.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState(params.get("categoryId") || "all");
  const [sortBy, setSortBy] = useState("nome");
  const [page, setPage] = useState(1);
  const { isApprovedBuyer, isAdmin, isSupplier } = useAuth();
  const { toast } = useToast();

  const canSeePrice = isApprovedBuyer || isAdmin || isSupplier;

  const { data, isLoading } = useListProducts({
    q: searchText || undefined,
    categoryId: selectedCategory !== "all" ? Number(selectedCategory) : undefined,
    orderBy: sortBy as "nome" | "preco" | "estoque" | "createdAt",
    page,
    limit: 12,
  });

  const { data: categories } = useListCategories();
  const wishlistMutation = useAddToWishlist();

  async function handleWishlist(productId: number) {
    try {
      await wishlistMutation.mutateAsync({ data: { productId } });
      toast({ title: "Produto adicionado aos favoritos" });
    } catch {
      toast({ title: "Faça login para adicionar favoritos", variant: "destructive" });
    }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-64 shrink-0">
            <div className="bg-card border border-border rounded-lg p-4 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal size={16} className="text-muted-foreground" />
                <span className="font-medium text-sm">Filtros</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                    Categoria
                  </label>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedCategory("all")}
                      className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${selectedCategory === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                    >
                      Todas as categorias
                    </button>
                    {categories?.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(String(cat.id))}
                        className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${selectedCategory === String(cat.id) ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                      >
                        {cat.nome}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="pl-9"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome">Nome (A-Z)</SelectItem>
                  <SelectItem value="createdAt">Mais recentes</SelectItem>
                  {canSeePrice && <SelectItem value="preco">Menor preço</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Count */}
            {data && (
              <p className="text-sm text-muted-foreground mb-4">
                {data.total} {data.total === 1 ? "produto encontrado" : "produtos encontrados"}
              </p>
            )}

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-muted animate-pulse rounded-lg h-72" />
                ))}
              </div>
            ) : data?.products && data.products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.products.map((product) => (
                  <Card key={product.id} className="border-border hover:shadow-md transition-all group overflow-hidden">
                    <div className="aspect-video bg-muted overflow-hidden relative">
                      {product.imagemPrincipal ? (
                        <img
                          src={product.imagemPrincipal}
                          alt={product.nome}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <HardHat size={36} />
                        </div>
                      )}
                      <button
                        onClick={() => handleWishlist(product.id)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white shadow transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Heart size={14} className="text-muted-foreground" />
                      </button>
                    </div>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">{product.categoryName}</p>
                      <Link href={`/produto/${product.slug || product.id}`}>
                        <h3 className="font-semibold text-sm line-clamp-2 mb-2 hover:text-primary cursor-pointer">
                          {product.nome}
                        </h3>
                      </Link>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.descricao}</p>

                      <div className="flex items-center justify-between mb-3">
                        <Badge variant={product.disponivel ? "default" : "secondary"} className="text-xs">
                          {product.disponivel ? "Em estoque" : "Sem estoque"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{product.unidadeMedida}</span>
                      </div>

                      {canSeePrice ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-primary">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.preco || 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">por {product.unidadeMedida}</p>
                          </div>
                          <Link href={`/produto/${product.slug || product.id}`}>
                            <Button size="sm" className="text-xs">Comprar</Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock size={10} />
                            <span>Login para ver o preço</span>
                          </div>
                          <Link href={`/produto/${product.slug || product.id}`}>
                            <Button size="sm" variant="outline" className="text-xs">Ver mais</Button>
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <HardHat size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum produto encontrado</p>
                <p className="text-sm mt-1">Tente ajustar os filtros ou fazer uma nova busca</p>
              </div>
            )}

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Anterior
                </Button>
                <span className="flex items-center px-3 text-sm text-muted-foreground">
                  Página {page} de {data.totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>
                  Próxima
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
