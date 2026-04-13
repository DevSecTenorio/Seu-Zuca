import { useGetWishlist, useRemoveFromWishlist as useRemoveWishlist } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Trash2, Package, ShoppingCart } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Wishlist() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wishlist, isLoading, refetch } = useGetWishlist({ query: { enabled: isAuthenticated } });
  const removeMutation = useRemoveWishlist();

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Heart size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Faça login para ver seus favoritos</p>
          <Link href="/login"><Button>Entrar</Button></Link>
        </div>
      </Layout>
    );
  }

  async function handleRemove(productId: number) {
    await removeMutation.mutateAsync({ productId });
    refetch();
    toast({ title: "Removido dos favoritos" });
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Heart size={22} className="text-primary" />
          <h1 className="text-2xl font-bold">Meus Favoritos</h1>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : wishlist && wishlist.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wishlist.map((item) => (
              <Card key={item.productId} className="border-border overflow-hidden group">
                <div className="aspect-video bg-muted overflow-hidden">
                  {(item as { imagemPrincipal?: string }).imagemPrincipal ? (
                    <img
                      src={(item as { imagemPrincipal?: string }).imagemPrincipal}
                      alt={item.productNome}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Package size={32} />
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <Link href={`/produto/${item.productId}`}>
                    <h3 className="font-semibold text-sm line-clamp-2 hover:text-primary cursor-pointer mb-2">
                      {item.productNome}
                    </h3>
                  </Link>
                  {(item as { preco?: number }).preco && (
                    <p className="text-primary font-bold text-base mb-3">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((item as { preco?: number }).preco!)}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate(`/produto/${item.productId}`)}
                    >
                      <ShoppingCart size={14} className="mr-1" />
                      Ver produto
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive px-2"
                      onClick={() => handleRemove(item.productId)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Heart size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum favorito ainda</p>
            <p className="text-sm mt-1 mb-6">Adicione produtos que você gostou para ver depois</p>
            <Link href="/catalogo">
              <Button>Explorar catálogo</Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
