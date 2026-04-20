import { useState } from "react";
import {
  useGetSupplierStats, useListSupplierProducts, useDeleteProduct,
  useListSupplierOrders, useUpdateOrderStatus,
  useListSupplierQuotes,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp, ShoppingBag, DollarSign, Plus, Edit, Trash2, FileText, ClipboardList } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const BRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const ORDER_STATUS: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente:     { label: "Pendente",     color: "secondary" },
  em_separacao: { label: "Em Separação", color: "default" },
  enviado:      { label: "Enviado",      color: "default" },
  entregue:     { label: "Entregue",     color: "outline" },
  cancelado:    { label: "Cancelado",    color: "destructive" },
};

const ORDER_FLOW: Record<string, Array<{ next: string; label: string }>> = {
  pendente:     [{ next: "em_separacao", label: "Confirmar" }, { next: "cancelado", label: "Cancelar" }],
  em_separacao: [{ next: "enviado", label: "Enviar" }],
  enviado:      [{ next: "entregue", label: "Confirmar entrega" }],
};

const QUOTE_STATUS: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente:   { label: "Pendente",   color: "secondary" },
  respondida: { label: "Respondida", color: "default" },
  aceita:     { label: "Aceita",     color: "outline" },
  encerrada:  { label: "Encerrada",  color: "secondary" },
  cancelada:  { label: "Cancelada",  color: "destructive" },
};

type Tab = "produtos" | "pedidos" | "cotacoes";

export default function SupplierDashboard() {
  const { isSupplier } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("produtos");

  const { data: dashboard } = useGetSupplierStats({ query: { enabled: isSupplier } });
  const { data: products, isLoading: loadingProducts, refetch: refetchProducts } = useListSupplierProducts({ query: { enabled: isSupplier } });
  const { data: orders, isLoading: loadingOrders, refetch: refetchOrders } = useListSupplierOrders({ query: { enabled: isSupplier } });
  const { data: quotes, isLoading: loadingQuotes } = useListSupplierQuotes({ query: { enabled: isSupplier } });
  const deleteMutation = useDeleteProduct();
  const updateOrderStatus = useUpdateOrderStatus();

  if (!isSupplier) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Acesso restrito a fornecedores</p>
        </div>
      </Layout>
    );
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    await deleteMutation.mutateAsync({ id: String(id) });
    refetchProducts();
    toast({ title: "Produto excluído" });
  }

  async function handleOrderStatus(orderId: number, status: string) {
    try {
      await updateOrderStatus.mutateAsync({ id: orderId, data: { status } });
      toast({ title: "Status do pedido atualizado!" });
      refetchOrders();
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  }

  const stats = [
    { icon: Package,    label: "Produtos",     value: (products as unknown[])?.length ?? 0,                                                           color: "text-blue-600",   bg: "bg-blue-100" },
    { icon: ShoppingBag, label: "Pedidos",     value: (dashboard as { totalPedidos?: number })?.totalPedidos ?? 0,                                    color: "text-emerald-600", bg: "bg-emerald-100" },
    { icon: TrendingUp,  label: "Pedidos/mês", value: (dashboard as { pedidosMes?: number })?.pedidosMes ?? 0,                                        color: "text-violet-600",  bg: "bg-violet-100" },
    { icon: DollarSign,  label: "Faturamento", value: BRL((dashboard as { faturamentoTotal?: number })?.faturamentoTotal ?? 0),                        color: "text-amber-600",   bg: "bg-amber-100" },
  ];

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "produtos",  label: "Produtos",  icon: Package },
    { key: "pedidos",   label: "Pedidos",   icon: ClipboardList },
    { key: "cotacoes",  label: "Cotações",  icon: FileText },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Painel do Fornecedor</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie seus produtos, pedidos e cotações</p>
          </div>
          {tab === "produtos" && (
            <Button onClick={() => navigate("/fornecedor/produto/novo")} className="gap-2 bg-[#C0181A] hover:bg-[#a01418]">
              <Plus size={16} />
              Novo Produto
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center shrink-0`}>
                    <stat.icon size={18} className={stat.color} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? "border-[#C0181A] text-[#C0181A]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Produtos */}
        {tab === "produtos" && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Meus Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProducts ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}
                </div>
              ) : products && (products as unknown[]).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 text-muted-foreground font-medium">Produto</th>
                        <th className="text-left py-3 text-muted-foreground font-medium hidden sm:table-cell">Categoria</th>
                        <th className="text-right py-3 text-muted-foreground font-medium">Preço</th>
                        <th className="text-right py-3 text-muted-foreground font-medium hidden md:table-cell">Estoque</th>
                        <th className="text-center py-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-right py-3 text-muted-foreground font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(products as Array<{
                        id: number; nome: string; sku?: string;
                        imagemPrincipal?: string; categoryName?: string;
                        preco?: number; estoque?: number; disponivel?: boolean;
                      }>).map((product) => (
                        <tr key={product.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-muted rounded overflow-hidden shrink-0">
                                {product.imagemPrincipal
                                  ? <img src={product.imagemPrincipal} alt="" className="w-full h-full object-cover" />
                                  : <Package size={14} className="m-auto text-muted-foreground" />}
                              </div>
                              <div>
                                <p className="font-medium line-clamp-1">{product.nome}</p>
                                <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-muted-foreground hidden sm:table-cell">{product.categoryName}</td>
                          <td className="py-3 text-right font-medium">{BRL(product.preco || 0)}</td>
                          <td className="py-3 text-right hidden md:table-cell">
                            <span className={(product.estoque ?? 0) < 50 ? "text-destructive font-medium" : ""}>{product.estoque}</span>
                          </td>
                          <td className="py-3 text-center">
                            <Badge variant={product.disponivel ? "default" : "secondary"} className="text-xs">
                              {product.disponivel ? "Ativo" : "Inativo"}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="sm" className="p-1" onClick={() => navigate(`/fornecedor/produto/${product.id}`)}>
                                <Edit size={14} />
                              </Button>
                              <Button variant="ghost" size="sm" className="p-1 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(product.id)}>
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package size={40} className="mx-auto mb-3 opacity-50" />
                  <p>Você ainda não cadastrou produtos</p>
                  <Button className="mt-4 bg-[#C0181A] hover:bg-[#a01418]" onClick={() => navigate("/fornecedor/produto/novo")}>
                    <Plus size={16} className="mr-2" />
                    Cadastrar primeiro produto
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pedidos */}
        {tab === "pedidos" && (
          <div>
            {loadingOrders ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : orders && (orders as unknown[]).length > 0 ? (
              <div className="space-y-3">
                {(orders as Array<{
                  id: number; status: string; total: number; createdAt: string;
                  buyerName?: string; items?: unknown[];
                }>).map((order) => {
                  const cfg = ORDER_STATUS[order.status] || ORDER_STATUS.pendente;
                  const actions = ORDER_FLOW[order.status] || [];
                  return (
                    <Card key={order.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm font-bold">#{String(order.id).padStart(6, "0")}</span>
                              <Badge variant={cfg.color} className="text-xs">{cfg.label}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                              {order.buyerName && ` • ${order.buyerName}`}
                            </p>
                            <p className="font-bold mt-1">{BRL(order.total)}</p>
                          </div>
                          <div className="flex flex-col sm:flex-row items-end gap-2 shrink-0">
                            {actions.map((action) => (
                              <Button
                                key={action.next}
                                size="sm"
                                variant={action.next === "cancelado" ? "outline" : "default"}
                                className={action.next === "cancelado" ? "border-red-300 text-red-700 text-xs h-7" : "bg-[#C0181A] hover:bg-[#a01418] text-xs h-7"}
                                disabled={updateOrderStatus.isPending}
                                onClick={() => handleOrderStatus(order.id, action.next)}
                              >
                                {action.label}
                              </Button>
                            ))}
                            <Link href={`/pedido/${order.id}`}>
                              <Button variant="outline" size="sm" className="text-xs h-7">Ver detalhes</Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <ClipboardList size={44} className="mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">Nenhum pedido recebido</p>
                <p className="text-sm mt-1">Quando compradores realizarem pedidos, eles aparecerão aqui</p>
              </div>
            )}
          </div>
        )}

        {/* Cotações */}
        {tab === "cotacoes" && (
          <div>
            {loadingQuotes ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : quotes && (quotes as unknown[]).length > 0 ? (
              <div className="space-y-3">
                {(quotes as Array<{
                  id: number; status: string; createdAt: string;
                  buyerName?: string; observacoes?: string;
                }>).map((quote) => {
                  const cfg = QUOTE_STATUS[quote.status] || QUOTE_STATUS.pendente;
                  const canRespond = !["aceita", "encerrada", "cancelada"].includes(quote.status);
                  return (
                    <Card key={quote.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm font-bold">Cotação #{String(quote.id).padStart(4, "0")}</span>
                              <Badge variant={cfg.color} className="text-xs">{cfg.label}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(quote.createdAt).toLocaleDateString("pt-BR")}
                              {quote.buyerName && ` • ${quote.buyerName}`}
                            </p>
                            {quote.observacoes && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{quote.observacoes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Link href={`/cotacao/${quote.id}`}>
                              <Button
                                size="sm"
                                variant={canRespond ? "default" : "outline"}
                                className={canRespond ? "bg-[#C0181A] hover:bg-[#a01418] text-xs h-7" : "text-xs h-7"}
                              >
                                {canRespond ? "Responder" : "Ver detalhes"}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <FileText size={44} className="mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">Nenhuma cotação recebida</p>
                <p className="text-sm mt-1">Solicitações de cotação dos compradores aparecerão aqui</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
