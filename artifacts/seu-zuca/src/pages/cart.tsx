import { useGetCart, useUpdateCartItem, useRemoveFromCart, useClearCart } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Package, AlertCircle, ArrowRight, ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Cart() {
  const { isApprovedBuyer } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: cart, isLoading, refetch } = useGetCart({ query: { enabled: isApprovedBuyer } });
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveFromCart();
  const clearCart = useClearCart();

  if (!isApprovedBuyer) {
    return (
      <Layout>
        <div className="max-w-[1280px] mx-auto px-4 py-20 text-center">
          <ShoppingCart size={64} className="mx-auto mb-4 text-gray-200" />
          <p className="text-xl font-bold text-gray-700 mb-2">Faça login para acessar seu carrinho</p>
          <Link href="/login"><button className="mt-4 bg-[#C0181A] hover:bg-[#a01416] text-white font-bold px-8 py-3 rounded-lg transition-colors">Entrar</button></Link>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-[1280px] mx-auto px-4 py-8 animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-48" />
          <div className="h-32 bg-gray-100 rounded" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </Layout>
    );
  }

  const items = cart?.items || [];
  const total = cart?.total || 0;

  if (items.length === 0) {
    return (
      <Layout>
        <div className="max-w-[1280px] mx-auto px-4 py-20 text-center">
          <ShoppingCart size={80} className="mx-auto mb-4 text-gray-200" />
          <h1 className="text-2xl font-bold text-gray-700 mb-2">Seu carrinho está vazio</h1>
          <p className="text-gray-500 mb-8">Adicione produtos do catálogo para começar</p>
          <Link href="/catalogo">
            <button className="bg-[#C0181A] hover:bg-[#a01416] text-white font-bold px-8 py-3 rounded-lg transition-colors">
              Explorar catálogo
            </button>
          </Link>
        </div>
      </Layout>
    );
  }

  async function handleQtyChange(itemId: number, qty: number) {
    if (qty < 1) return;
    try {
      await updateItem.mutateAsync({ id: String(itemId), data: { quantidade: qty } });
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao atualizar";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleRemove(itemId: number) {
    await removeItem.mutateAsync({ id: String(itemId) });
    refetch();
    toast({ title: "Item removido do carrinho" });
  }

  return (
    <Layout>
      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/catalogo" className="text-gray-500 hover:text-gray-700">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Carrinho de Compras</h1>
          <span className="text-gray-400 text-sm">({items.length} {items.length === 1 ? "item" : "itens"})</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 flex gap-4">
                <div className="w-20 h-20 bg-gray-50 rounded-lg shrink-0 overflow-hidden">
                  {(item as { imagemPrincipal?: string }).imagemPrincipal ? (
                    <img src={(item as { imagemPrincipal?: string }).imagemPrincipal} alt={item.productNome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200"><Package size={28} /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/produto/${item.productId}`}>
                    <p className="font-semibold text-sm text-gray-800 hover:text-[#C0181A] cursor-pointer line-clamp-2">{item.productNome}</p>
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">{item.supplierNome}</p>
                  <p className="text-[#C0181A] font-bold text-base mt-1">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.preco || 0)}
                    <span className="text-gray-400 font-normal text-xs ml-1">/{item.unidadeMedida}</span>
                  </p>

                  {(item as { minQtyError?: string }).minQtyError && (
                    <div className="flex items-center gap-1.5 mt-1 text-amber-600 text-xs">
                      <AlertCircle size={12} />
                      {(item as { minQtyError?: string }).minQtyError}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button className="px-3 py-1 text-gray-500 hover:bg-gray-50 text-sm font-medium" onClick={() => handleQtyChange(item.id, item.quantidade - 1)}>-</button>
                      <span className="px-3 py-1 text-sm font-bold border-x border-gray-200 min-w-[2.5rem] text-center">{item.quantidade}</span>
                      <button className="px-3 py-1 text-gray-500 hover:bg-gray-50 text-sm font-medium" onClick={() => handleQtyChange(item.id, item.quantidade + 1)}>+</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((item.preco || 0) * item.quantidade)}
                      </span>
                      <button onClick={() => handleRemove(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="text-right">
              <button onClick={async () => { await clearCart.mutateAsync({}); refetch(); }} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
                Limpar carrinho
              </button>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-white border border-gray-100 rounded-xl p-5 sticky top-[140px]">
              <h2 className="font-bold text-gray-800 text-lg mb-4">Resumo do pedido</h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal ({items.length} {items.length === 1 ? "item" : "itens"})</span>
                  <span className="font-medium">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Frete</span>
                  <span className="text-green-600 font-medium">A calcular</span>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 mb-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-[#C0181A]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</span>
                </div>
              </div>
              <button
                onClick={() => navigate("/checkout")}
                className="w-full bg-[#C0181A] hover:bg-[#a01416] text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                Finalizar pedido
                <ArrowRight size={16} />
              </button>
              <p className="text-xs text-gray-400 text-center mt-3">Pagamento seguro — Stripe</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
