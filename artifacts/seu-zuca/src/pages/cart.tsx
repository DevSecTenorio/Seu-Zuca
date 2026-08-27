import { useGetCart, useUpdateCartItem, useRemoveFromCart, useClearCart, getGetCartQueryKey } from "@workspace/api-client-react";
import type { CartItem } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { ShoppingCart, Trash2, Package, AlertCircle, ArrowRight, ChevronLeft, Info } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

function BRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Cart() {
  const { isApprovedBuyer, isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: cart, isLoading, refetch } = useGetCart({ query: { queryKey: getGetCartQueryKey(), enabled: isApprovedBuyer } });
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveFromCart();
  const clearCart = useClearCart();

  /* ── Not logged in ── */
  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="max-w-[1280px] mx-auto px-4 py-20 text-center">
          <ShoppingCart size={64} className="mx-auto mb-4 text-gray-200" />
          <p className="text-xl font-bold text-gray-700 mb-2">Faça login para acessar seu carrinho</p>
          <p className="text-sm text-gray-400 mb-6">O carrinho é exclusivo para compradores B2B aprovados</p>
          <Link href="/login">
            <button className="mt-2 bg-[#C0181A] hover:bg-[#a01416] text-white font-bold px-8 py-3 rounded-lg transition-colors">
              Entrar
            </button>
          </Link>
        </div>
      </Layout>
    );
  }

  /* ── Logged in but not an approved buyer ── */
  if (!isApprovedBuyer) {
    const roleMsg: Record<string, string> = {
      admin: "Administradores não possuem carrinho de compras.",
      supplier: "Fornecedores não possuem carrinho de compras.",
      support: "Usuários de suporte não possuem carrinho de compras.",
      buyer: "Sua conta ainda não foi aprovada. Aguarde a aprovação do administrador.",
    };
    return (
      <Layout>
        <div className="max-w-[1280px] mx-auto px-4 py-20 text-center">
          <ShoppingCart size={64} className="mx-auto mb-4 text-gray-200" />
          <p className="text-xl font-bold text-gray-700 mb-2">Carrinho indisponível</p>
          <p className="text-sm text-gray-500 mb-6">{roleMsg[user?.role ?? ""] ?? "Acesso ao carrinho não disponível para este perfil."}</p>
          <Link href="/">
            <button className="bg-[#C0181A] hover:bg-[#a01416] text-white font-bold px-8 py-3 rounded-lg transition-colors">
              Voltar à loja
            </button>
          </Link>
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

  const items: CartItem[] = cart?.items || [];
  const total = cart?.total || 0;
  const cartValido = cart?.valido !== false;
  const erros: string[] = cart?.erros || [];

  /* ── Empty ── */
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

  async function handleQtyChange(item: CartItem, qty: number) {
    const min = item.quantidadeMinima ?? 1;
    if (qty < 1) return;
    if (qty < min) {
      toast({ title: `Quantidade mínima para este produto: ${min}`, variant: "destructive" });
      return;
    }
    try {
      await updateItem.mutateAsync({ productId: item.productId, data: { quantidade: qty } });
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao atualizar";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleRemove(item: CartItem) {
    try {
      await removeItem.mutateAsync({ productId: item.productId });
      refetch();
      toast({ title: "Item removido do carrinho" });
    } catch {
      toast({ title: "Erro ao remover item", variant: "destructive" });
    }
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

        {/* Global minimum errors banner */}
        {!cartValido && erros.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Atenção: quantidades mínimas não atendidas</p>
              <ul className="text-xs text-amber-700 space-y-0.5">
                {erros.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items list */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => {
              const product = item.product;
              const nome = product?.nome ?? `Produto #${item.productId}`;
              const imagemUrl = product?.imagemPrincipal;
              const unidade = (product as { unidadeMedida?: string })?.unidadeMedida;
              const min = item.quantidadeMinima ?? 1;
              const temErro = !!item.mensagemErro;

              return (
                <div key={item.id} className={`bg-white border rounded-xl p-4 flex gap-4 transition-colors ${temErro ? "border-amber-300 bg-amber-50/30" : "border-gray-100"}`}>
                  {/* Image */}
                  <div className="w-20 h-20 bg-gray-50 rounded-lg shrink-0 overflow-hidden">
                    {imagemUrl ? (
                      <img src={imagemUrl} alt={nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200">
                        <Package size={28} />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <Link href={`/produto/${item.productId}`}>
                      <p className="font-semibold text-sm text-gray-800 hover:text-[#C0181A] cursor-pointer line-clamp-2">{nome}</p>
                    </Link>

                    {/* Minimum info badge */}
                    {min > 1 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                        <Info size={11} />
                        <span>Mínimo: {min} {unidade ? unidade : "unidades"}</span>
                      </div>
                    )}

                    {/* Minimum violation warning */}
                    {temErro && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 font-medium">
                        <AlertCircle size={11} />
                        <span>{item.mensagemErro}</span>
                      </div>
                    )}

                    <p className="text-[#C0181A] font-bold text-base mt-1.5">
                      {BRL(item.precoUnitario ?? 0)}
                      {unidade && <span className="text-gray-400 font-normal text-xs ml-1">/{unidade}</span>}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      {/* Qty controls */}
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          className="px-3 py-1 text-gray-500 hover:bg-gray-50 text-sm font-medium disabled:opacity-40"
                          disabled={item.quantidade <= min}
                          onClick={() => handleQtyChange(item, item.quantidade - 1)}
                        >
                          -
                        </button>
                        <span className="px-3 py-1 text-sm font-bold border-x border-gray-200 min-w-[2.5rem] text-center">
                          {item.quantidade}
                        </span>
                        <button
                          className="px-3 py-1 text-gray-500 hover:bg-gray-50 text-sm font-medium"
                          onClick={() => handleQtyChange(item, item.quantidade + 1)}
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-800">
                          {BRL(item.subtotal ?? (item.precoUnitario ?? 0) * item.quantidade)}
                        </span>
                        <button onClick={() => handleRemove(item)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="text-right">
              <button
                onClick={async () => { await clearCart.mutateAsync(); refetch(); }}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors"
              >
                Limpar carrinho
              </button>
            </div>
          </div>

          {/* Order summary */}
          <div>
            <div className="bg-white border border-gray-100 rounded-xl p-5 sticky top-[140px]">
              <h2 className="font-bold text-gray-800 text-lg mb-4">Resumo do pedido</h2>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal ({items.length} {items.length === 1 ? "item" : "itens"})</span>
                  <span className="font-medium">{BRL(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Frete</span>
                  <span className="text-green-600 font-medium">A calcular</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 mb-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-[#C0181A]">{BRL(total)}</span>
                </div>
              </div>

              {!cartValido && (
                <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  Corrija as quantidades mínimas antes de finalizar o pedido.
                </div>
              )}

              <button
                onClick={() => navigate("/checkout")}
                disabled={!cartValido}
                className="w-full bg-[#C0181A] hover:bg-[#a01416] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                Finalizar pedido
                <ArrowRight size={16} />
              </button>
              <p className="text-xs text-gray-400 text-center mt-3">Pagamento seguro</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
