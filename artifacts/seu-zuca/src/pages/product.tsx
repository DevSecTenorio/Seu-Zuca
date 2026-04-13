import { useParams, useLocation } from "wouter";
import { useGetProduct, useAddToCart, useAddToWishlist } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Lock, ShoppingCart, Heart, Truck, Package, Star, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function Product() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isApprovedBuyer, isAdmin, isSupplier } = useAuth();
  const canSeePrice = isApprovedBuyer || isAdmin || isSupplier;
  const { toast } = useToast();

  const { data: product, isLoading } = useGetProduct(id!);
  const addToCart = useAddToCart();
  const addToWishlist = useAddToWishlist();

  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-muted animate-pulse rounded-lg" />
            <div className="space-y-4">
              <div className="h-8 bg-muted animate-pulse rounded w-3/4" />
              <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
              <div className="h-12 bg-muted animate-pulse rounded w-1/3" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <Package size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">Produto não encontrado</p>
          <Link href="/catalogo">
            <Button className="mt-4">Ver catálogo</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const images = (product as { imagens?: string[]; imagemPrincipal?: string }).imagens || (product.imagemPrincipal ? [product.imagemPrincipal] : []);

  async function handleAddToCart() {
    if (!isApprovedBuyer) {
      navigate("/login");
      return;
    }
    try {
      await addToCart.mutateAsync({ data: { productId: product!.id, quantidade: qty } });
      toast({ title: `${product!.nome} adicionado ao carrinho` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao adicionar ao carrinho";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleWishlist() {
    if (!isApprovedBuyer) {
      navigate("/login");
      return;
    }
    try {
      await addToWishlist.mutateAsync({ data: { productId: product!.id } });
      toast({ title: "Adicionado aos favoritos" });
    } catch {
      toast({ title: "Erro ao adicionar favoritos", variant: "destructive" });
    }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/catalogo" className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft size={14} />
            Catálogo
          </Link>
          <span>/</span>
          <span>{product.categoryName}</span>
          <span>/</span>
          <span className="text-foreground line-clamp-1">{product.nome}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Images */}
          <div className="space-y-3">
            <div className="aspect-square bg-muted rounded-xl overflow-hidden">
              {images.length > 0 ? (
                <img
                  src={images[activeImg]}
                  alt={product.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Package size={64} />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === activeImg ? "border-primary" : "border-border"}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <Badge className="mb-3">{product.categoryName}</Badge>
            <h1 className="text-2xl font-bold mb-2">{product.nome}</h1>
            <p className="text-sm text-muted-foreground mb-1">
              Por: <span className="font-medium text-foreground">{product.supplierName}</span>
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              SKU: <span className="font-mono">{(product as { sku?: string }).sku}</span>
            </p>

            <Separator className="my-4" />

            {/* Price */}
            {canSeePrice ? (
              <div className="mb-6">
                <p className="text-3xl font-bold text-primary">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.preco || 0)}
                </p>
                <p className="text-sm text-muted-foreground">por {product.unidadeMedida}</p>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-4 mb-6 flex items-center gap-3">
                <Lock size={20} className="text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">Preço exclusivo para clientes B2B</p>
                  <p className="text-xs text-muted-foreground">Faça login ou crie sua conta para ver os preços</p>
                </div>
                <Link href="/login">
                  <Button size="sm" variant="outline" className="ml-auto shrink-0">Entrar</Button>
                </Link>
              </div>
            )}

            {/* Stock */}
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={product.disponivel ? "default" : "destructive"}>
                {product.disponivel ? "Em estoque" : "Sem estoque"}
              </Badge>
              {product.disponivel && (
                <span className="text-xs text-muted-foreground">
                  {product.estoque} {product.unidadeMedida}s disponíveis
                </span>
              )}
            </div>

            {/* Minimum rule */}
            {(product as { quantidadeMinima?: number }).quantidadeMinima && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                Quantidade mínima: {(product as { quantidadeMinima?: number }).quantidadeMinima} {product.unidadeMedida}(s)
                {(product as { multiplo?: number }).multiplo && (product as { multiplo?: number }).multiplo! > 1 && (
                  <span> — múltiplos de {(product as { multiplo?: number }).multiplo}</span>
                )}
              </div>
            )}

            {/* Add to cart */}
            {isApprovedBuyer && product.disponivel && (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center border border-border rounded-md">
                  <button
                    className="px-3 py-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                  >
                    -
                  </button>
                  <Input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                    className="w-16 text-center border-0 focus-visible:ring-0 p-0"
                    min={1}
                  />
                  <button
                    className="px-3 py-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setQty(q => q + 1)}
                  >
                    +
                  </button>
                </div>
                <Button onClick={handleAddToCart} disabled={addToCart.isPending} className="flex-1">
                  <ShoppingCart size={16} className="mr-2" />
                  Adicionar ao carrinho
                </Button>
                <Button variant="outline" onClick={handleWishlist} size="icon">
                  <Heart size={16} />
                </Button>
              </div>
            )}

            {/* Shipping info */}
            <Card className="border-border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Truck size={16} className="text-muted-foreground" />
                  <span>Prazo de entrega: {(product as { prazoFrete?: number }).prazoFrete || 7} dias úteis</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package size={16} className="text-muted-foreground" />
                  <span>Unidade de venda: {product.unidadeMedida}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Description */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">Descrição do Produto</h2>
          <p className="text-muted-foreground leading-relaxed">{product.descricao}</p>
        </div>

        {/* Reviews */}
        {(product as { reviews?: unknown[] }).reviews && (product as { reviews: unknown[] }).reviews.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Avaliações</h2>
            <div className="space-y-4">
              {((product as { reviews?: Array<{
                id: number;
                buyerName: string;
                nota: number;
                titulo: string;
                comentario: string;
                createdAt: string;
              }> }).reviews || []).map((review) => (
                <div key={review.id} className="border-b border-border pb-4 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} className={i < review.nota ? "text-amber-400 fill-amber-400" : "text-muted-foreground"} />
                      ))}
                    </div>
                    <span className="font-medium text-sm">{review.titulo}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{review.comentario}</p>
                  <p className="text-xs text-muted-foreground mt-2">por {review.buyerName}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
