import { useGetCart, useUpdateCartItem, useRemoveFromCart, useClearCart } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Trash2, Package, AlertCircle, ArrowRight } from "lucide-react";
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
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <ShoppingCart size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Acesso restrito</p>
          <p className="text-muted-foreground mb-6">Faça login para ver seu carrinho</p>
          <Link href="/login"><Button>Entrar</Button></Link>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-32 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  const items = cart?.items || [];
  const total = cart?.total || 0;

  if (items.length === 0) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <ShoppingCart size={64} className="mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h1>
          <p className="text-muted-foreground mb-6">Adicione produtos do catálogo para começar</p>
          <Link href="/catalogo"><Button>Explorar catálogo</Button></Link>
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

  async function handleClear() {
    await clearCart.mutateAsync({});
    refetch();
    toast({ title: "Carrinho limpo" });
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Carrinho de Compras</h1>
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-destructive">
            <Trash2 size={14} className="mr-1" />
            Limpar carrinho
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-muted rounded-lg shrink-0 overflow-hidden">
                      {(item as { imagemPrincipal?: string }).imagemPrincipal ? (
                        <img src={(item as { imagemPrincipal?: string }).imagemPrincipal} alt={item.productNome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Package size={24} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/produto/${item.productId}`}>
                        <h3 className="font-semibold text-sm hover:text-primary cursor-pointer line-clamp-2">{item.productNome}</h3>
                      </Link>
                      <p className="text-xs text-muted-foreground mt-1">{item.supplierNome}</p>
                      <p className="text-sm font-bold text-primary mt-2">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.preco || 0)} / {item.unidadeMedida}
                      </p>
                    </div>
                  </div>

                  {(item as { minQtyError?: string }).minQtyError && (
                    <div className="flex items-center gap-2 mt-2 text-amber-600 text-xs bg-amber-50 p-2 rounded">
                      <AlertCircle size={12} />
                      {(item as { minQtyError?: string }).minQtyError}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-border rounded-md">
                      <button
                        className="px-3 py-1.5 text-muted-foreground hover:text-foreground text-sm"
                        onClick={() => handleQtyChange(item.id, item.quantidade - 1)}
                      >
                        -
                      </button>
                      <span className="px-3 py-1.5 text-sm border-x border-border min-w-12 text-center">{item.quantidade}</span>
                      <button
                        className="px-3 py-1.5 text-muted-foreground hover:text-foreground text-sm"
                        onClick={() => handleQtyChange(item.id, item.quantidade + 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((item.preco || 0) * item.quantidade)}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(item.id)} className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary */}
          <div>
            <Card className="border-border sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Resumo do pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({items.length} {items.length === 1 ? "item" : "itens"})</span>
                  <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete</span>
                  <span className="text-green-600">A calcular</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</span>
                </div>
                <Button className="w-full mt-4" size="lg" onClick={() => navigate("/checkout")}>
                  Finalizar pedido
                  <ArrowRight size={16} className="ml-2" />
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Pagamento seguro via Stripe
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
