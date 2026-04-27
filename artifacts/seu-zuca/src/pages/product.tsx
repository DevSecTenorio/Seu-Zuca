import { useParams, useLocation } from "wouter";
import { useGetProduct, useAddToCart, useAddToWishlist } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lock, ShoppingCart, Heart, Truck, Package, Star, ChevronLeft,
  Shield, BadgePercent, ChevronRight, X, ZoomIn,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const images = (product as { imagens?: string[]; imagemPrincipal?: string } | undefined)?.imagens
    || (product?.imagemPrincipal ? [product.imagemPrincipal] : []);

  const goNext = useCallback(() => {
    if (images.length > 1) setActiveImg((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    if (images.length > 1) setActiveImg((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") setLightboxOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, goNext, goPrev]);

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-[1280px] mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-gray-100 animate-pulse rounded-xl" />
            <div className="space-y-4">
              <div className="h-8 bg-gray-100 animate-pulse rounded w-3/4" />
              <div className="h-4 bg-gray-100 animate-pulse rounded w-1/2" />
              <div className="h-12 bg-gray-100 animate-pulse rounded w-1/3" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="max-w-[1280px] mx-auto px-4 py-16 text-center">
          <Package size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-600">Produto não encontrado</p>
          <Link href="/catalogo">
            <Button className="mt-4 bg-[#C0181A] hover:bg-[#a01416]">Ver catálogo</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  async function handleAddToCart() {
    if (!isApprovedBuyer) { navigate("/login"); return; }
    try {
      await addToCart.mutateAsync({ data: { productId: product!.id, quantidade: qty } });
      toast({ title: `${product!.nome} adicionado ao carrinho` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao adicionar ao carrinho";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleWishlist() {
    if (!isApprovedBuyer) { navigate("/login"); return; }
    try {
      await addToWishlist.mutateAsync({ data: { productId: product!.id } });
      toast({ title: "Adicionado aos favoritos" });
    } catch {
      toast({ title: "Erro ao adicionar favoritos", variant: "destructive" });
    }
  }

  const p = product as {
    imagens?: string[];
    imagemPrincipal?: string;
    sku?: string;
    quantidadeMinima?: number;
    multiplo?: number;
    prazoFrete?: number;
    reviews?: Array<{ id: number; buyerName: string; nota: number; titulo: string; comentario: string; createdAt: string }>;
  } & typeof product;

  return (
    <Layout>
      {/* ── Lightbox ── */}
      {lightboxOpen && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 rounded-full p-2 transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={22} />
          </button>

          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 rounded-full p-3 transition-colors"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 rounded-full p-3 transition-colors"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <img
            src={images[activeImg]}
            alt={product.nome}
            className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setActiveImg(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${i === activeImg ? "bg-white scale-125" : "bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="max-w-[1280px] mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/catalogo" className="hover:text-[#C0181A] flex items-center gap-1 transition-colors">
            <ChevronLeft size={14} />
            Catálogo
          </Link>
          <span>/</span>
          <span>{product.categoryName}</span>
          <span>/</span>
          <span className="text-gray-800 font-medium line-clamp-1">{product.nome}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* ── Images ── */}
          <div className="space-y-3">
            {/* Main image */}
            <div className="relative aspect-square bg-white border border-gray-100 rounded-xl overflow-hidden group">
              {images.length > 0 ? (
                <>
                  <img
                    key={activeImg}
                    src={images[activeImg]}
                    alt={product.nome}
                    className="w-full h-full object-cover transition-opacity duration-200"
                  />

                  {/* Zoom hint */}
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="absolute top-3 right-3 bg-white/80 hover:bg-white text-gray-600 rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="Ampliar"
                  >
                    <ZoomIn size={16} />
                  </button>

                  {/* Counter */}
                  {images.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      {activeImg + 1}/{images.length}
                    </div>
                  )}

                  {/* Prev / Next arrows */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={goPrev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={goNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-200">
                  <Package size={80} />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      i === activeImg
                        ? "border-[#C0181A] ring-1 ring-[#C0181A]/30"
                        : "border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Info ── */}
          <div>
            <div className="flex items-start gap-3 mb-2">
              <Badge className="bg-[#C0181A] text-white border-0 shrink-0">{product.categoryName}</Badge>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.nome}</h1>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className="text-[#FFC107] fill-[#FFC107]" />
                ))}
              </div>
              <span className="text-gray-500 text-sm">SKU: <span className="font-mono">{p.sku}</span></span>
            </div>

            <p className="text-sm text-gray-600 mb-1">
              Fornecedor: <span className="font-semibold text-gray-800">{product.supplierName}</span>
            </p>

            <div className="border-t border-b border-gray-100 py-4 my-4">
              {canSeePrice ? (
                <div>
                  <p className="text-4xl font-black text-[#C0181A] leading-tight">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.preco || 0)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">por {product.unidadeMedida}</p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#C0181A]/10 rounded-full flex items-center justify-center">
                    <Lock size={18} className="text-[#C0181A]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">Preço exclusivo para clientes B2B</p>
                    <p className="text-xs text-gray-500">Faça login ou cadastre sua empresa para ver os preços</p>
                  </div>
                  <Link href="/login">
                    <Button size="sm" className="bg-[#C0181A] hover:bg-[#a01416] shrink-0">Entrar</Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Stock */}
            <div className="flex items-center gap-3 mb-3">
              <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${product.disponivel ? "text-green-600" : "text-red-500"}`}>
                <span className={`w-2 h-2 rounded-full ${product.disponivel ? "bg-green-500" : "bg-red-500"}`} />
                {product.disponivel ? "Em estoque" : "Sem estoque"}
              </span>
              {product.disponivel && (
                <span className="text-sm text-gray-500">
                  {product.estoque} {product.unidadeMedida}(s) disponíveis
                </span>
              )}
            </div>

            {/* Min quantity alert */}
            {p.quantidadeMinima && p.quantidadeMinima > 1 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800 flex items-center gap-2">
                <BadgePercent size={16} className="shrink-0" />
                Quantidade mínima: <strong>{p.quantidadeMinima} {product.unidadeMedida}(s)</strong>
                {p.multiplo && p.multiplo > 1 && (
                  <span> — múltiplos de {p.multiplo}</span>
                )}
              </div>
            )}

            {/* Add to cart */}
            {isApprovedBuyer && product.disponivel && (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
                  <button
                    className="px-3 py-2.5 text-gray-500 hover:text-gray-800 hover:bg-gray-50 text-lg font-medium transition-colors"
                    onClick={() => setQty((q) => Math.max(p.quantidadeMinima || 1, q - (p.multiplo || 1)))}
                  >-</button>
                  <span className="px-4 py-2 text-sm font-bold border-x border-gray-200 min-w-[3rem] text-center">{qty}</span>
                  <button
                    className="px-3 py-2.5 text-gray-500 hover:text-gray-800 hover:bg-gray-50 text-lg font-medium transition-colors"
                    onClick={() => setQty((q) => q + (p.multiplo || 1))}
                  >+</button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={addToCart.isPending}
                  className="flex-1 bg-[#C0181A] hover:bg-[#a01416] text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <ShoppingCart size={18} />
                  {addToCart.isPending ? "Adicionando..." : "Adicionar ao carrinho"}
                </button>
                <button
                  onClick={handleWishlist}
                  className="w-12 h-12 border border-gray-200 rounded-lg flex items-center justify-center hover:border-[#C0181A] hover:text-[#C0181A] transition-colors"
                >
                  <Heart size={18} />
                </button>
              </div>
            )}

            {!isApprovedBuyer && product.disponivel && (
              <div className="flex gap-3 mb-4">
                <Link href="/login" className="flex-1">
                  <button className="w-full bg-[#C0181A] hover:bg-[#a01416] text-white font-bold py-3 rounded-lg transition-colors">
                    Entrar para comprar
                  </button>
                </Link>
                <Link href="/cadastro" className="flex-1">
                  <button className="w-full border-2 border-[#C0181A] text-[#C0181A] font-bold py-3 rounded-lg hover:bg-[#C0181A] hover:text-white transition-colors">
                    Criar conta B2B
                  </button>
                </Link>
              </div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <Truck size={20} className="mx-auto mb-1 text-[#C0181A]" />
                <p className="text-xs text-gray-600 font-medium">{p.prazoFrete || 7} dias úteis</p>
                <p className="text-xs text-gray-400">entrega</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <Shield size={20} className="mx-auto mb-1 text-[#C0181A]" />
                <p className="text-xs text-gray-600 font-medium">Compra</p>
                <p className="text-xs text-gray-400">segura</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <Package size={20} className="mx-auto mb-1 text-[#C0181A]" />
                <p className="text-xs text-gray-600 font-medium">{product.unidadeMedida}</p>
                <p className="text-xs text-gray-400">por unidade</p>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100">Descrição do Produto</h2>
          <p className="text-gray-600 leading-relaxed">{product.descricao}</p>
        </div>

        {/* Reviews */}
        {p.reviews && p.reviews.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100">Avaliações dos clientes</h2>
            <div className="space-y-4">
              {p.reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} className={i < review.nota ? "text-[#FFC107] fill-[#FFC107]" : "text-gray-200 fill-gray-200"} />
                      ))}
                    </div>
                    <span className="font-semibold text-sm">{review.titulo}</span>
                  </div>
                  <p className="text-sm text-gray-600">{review.comentario}</p>
                  <p className="text-xs text-gray-400 mt-1">por {review.buyerName}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
