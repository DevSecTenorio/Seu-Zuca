import { useState, useEffect } from "react";
import {
  useGetSupplierStats, getGetSupplierStatsQueryKey, useListSupplierProducts, getListSupplierProductsQueryKey, useDeleteProduct,
  useListSupplierOrders, getListSupplierOrdersQueryKey, useUpdateOrderStatus, UpdateOrderStatusBodyStatus,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import ReportTab from "@/components/ReportTab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp, ShoppingBag, DollarSign, Plus, Edit, Trash2, ClipboardList, BarChart2, AlertTriangle, Star, Clock, Truck, CheckCircle, XCircle, RotateCcw, Eye, Tag } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

type Tab = "produtos" | "pedidos" | "analytics" | "relatorios";

type AnalyticsData = {
  receitaMensal: { mes: string; receita: number; pedidos: number }[];
  topProdutos: { id: number; nome: string; imagemPrincipal?: string; totalVendido: number; receita: number }[];
};

export default function SupplierDashboard() {
  const { isSupplier } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("produtos");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<"7d" | "30d" | "3m" | "6m">("30d");

  const { data: dashboard } = useGetSupplierStats({ query: { queryKey: getGetSupplierStatsQueryKey(), enabled: isSupplier } });
  const { data: products, isLoading: loadingProducts, refetch: refetchProducts } = useListSupplierProducts({ query: { queryKey: getListSupplierProductsQueryKey(), enabled: isSupplier } });
  const { data: orders, isLoading: loadingOrders, refetch: refetchOrders } = useListSupplierOrders({ query: { queryKey: getListSupplierOrdersQueryKey(), enabled: isSupplier } });
  const deleteMutation = useDeleteProduct();
  const updateOrderStatus = useUpdateOrderStatus();

  useEffect(() => {
    if (tab === "analytics" && !analytics) {
      setLoadingAnalytics(true);
      fetch("/api/supplier/analytics", { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setAnalytics(d); })
        .finally(() => setLoadingAnalytics(false));
    }
  }, [tab]);

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
    await deleteMutation.mutateAsync({ id });
    refetchProducts();
    toast({ title: "Produto excluído" });
  }

  async function handleOrderStatus(orderId: number, status: string) {
    try {
      await updateOrderStatus.mutateAsync({ id: orderId, data: { status: status as UpdateOrderStatusBodyStatus } });
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
    { key: "produtos",    label: "Produtos",    icon: Package },
    { key: "pedidos",     label: "Pedidos",     icon: ClipboardList },
    { key: "analytics",   label: "Analytics",   icon: BarChart2 },
    { key: "relatorios",  label: "Relatórios",  icon: TrendingUp },
  ];

  const productList = (products as Array<{
    id: number; nome: string; sku?: string; imagemPrincipal?: string; categoryName?: string;
    preco?: number; estoque?: number; alertaEstoque?: number; disponivel?: boolean;
    status?: "aguardando_aprovacao" | "aprovado" | "rejeitado"; motivoRejeicao?: string | null;
  }>) || [];
  const lowStockCount = productList.filter(p => (p.estoque ?? 0) <= (p.alertaEstoque ?? 10) && (p.estoque ?? 0) > 0).length;
  const pendingCount = productList.filter(p => p.status === "aguardando_aprovacao").length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Painel do Fornecedor</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie seus produtos e pedidos</p>
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
                        status?: "aguardando_aprovacao" | "aprovado" | "rejeitado"; motivoRejeicao?: string | null;
                        alertaEstoque?: number;
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
                            <div className="flex flex-col items-center gap-1">
                              {product.status === "aguardando_aprovacao" && (
                                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200">Aguard. aprovação</Badge>
                              )}
                              {product.status === "rejeitado" && (
                                <>
                                  <Badge variant="destructive" className="text-xs">Rejeitado</Badge>
                                  {product.motivoRejeicao && (
                                    <p className="text-[10px] text-muted-foreground max-w-[140px] text-center line-clamp-2" title={product.motivoRejeicao}>
                                      {product.motivoRejeicao}
                                    </p>
                                  )}
                                </>
                              )}
                              {(product.estoque ?? 0) <= (product.alertaEstoque ?? 10) && (product.estoque ?? 0) > 0 && (
                                <Badge variant="destructive" className="text-xs">Estoque baixo</Badge>
                              )}
                              {product.status === "aprovado" && (product.estoque ?? 0) > (product.alertaEstoque ?? 10) && (
                                <Badge variant={product.disponivel ? "default" : "secondary"} className="text-xs">
                                  {product.disponivel ? "Ativo" : "Inativo"}
                                </Badge>
                              )}
                            </div>
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

        {/* Relatórios */}
        {tab === "relatorios" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Relatórios de Vendas</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Filtre seus pedidos por período e exporte em PDF, Excel ou CSV.</p>
            </div>
            <ReportTab
              title="Relatório de Pedidos"
              endpoint="supplier/report"
              filenamePrefix="fornecedor_pedidos"
              columns={[
                { key: "id", label: "Pedido", format: (v) => `#${String(v).padStart(6, "0")}` },
                { key: "data", label: "Data" },
                { key: "comprador", label: "Comprador" },
                { key: "cnpj_comprador", label: "CNPJ" },
                { key: "total", label: "Valor Bruto", format: (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v)), align: "right" },
                { key: "comissao", label: "Comissão", format: (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v)), align: "right" },
                { key: "valor_liquido", label: "Valor Líquido", format: (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v)), align: "right" },
                { key: "status", label: "Status" },
              ]}
              summaryItems={[
                { key: "total", label: "Pedidos no período", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
                { key: "gmv", label: "Faturamento bruto", format: (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v)), color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
                { key: "receita", label: "Receita líquida", format: (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v)), color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
              ]}
            />
          </div>
        )}

        {/* Analytics */}
        {tab === "analytics" && (
          <div className="space-y-6">

            {/* Period selector + metric cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Visão geral</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Dados financeiros do período selecionado</p>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {(["7d", "30d", "3m", "6m"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setAnalyticsPeriod(p)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        analyticsPeriod === p
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-muted-foreground hover:text-gray-700"
                      }`}
                    >
                      {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : p === "3m" ? "3 meses" : "6 meses"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Receita total", value: "--", icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Ticket médio", value: "--", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Pedidos no período", value: "0", icon: ShoppingBag, color: "text-purple-600", bg: "bg-purple-50" },
                  { label: "Margem estimada", value: "--", icon: Tag, color: "text-amber-600", bg: "bg-amber-50" },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <Card key={label} className="border shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                          <p className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{value}</p>
                        </div>
                        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                          <Icon size={16} className={color} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Revenue chart */}
            <Card className="border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#C0181A]" />
                  Evolução da receita
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={[
                      { mes: "Nov/24", receita: 0 },
                      { mes: "Dez/24", receita: 0 },
                      { mes: "Jan/25", receita: 0 },
                      { mes: "Fev/25", receita: 0 },
                      { mes: "Mar/25", receita: 0 },
                      { mes: "Abr/25", receita: 0 },
                    ]}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={48} />
                    <Tooltip formatter={(v: number) => BRL(v)} labelFormatter={l => `Mês: ${l}`} />
                    <Bar dataKey="receita" fill="#C0181A" radius={[4, 4, 0, 0]} name="Receita" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top products + Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top products */}
              <Card className="border shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package size={16} className="text-[#C0181A]" />
                    Produtos mais vendidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum dado disponível</p>
                  </div>
                </CardContent>
              </Card>

              {/* Alerts */}
              <Card className="border shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle size={16} className="text-[#C0181A]" />
                    Alertas e ações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { label: "Produtos sem estoque", icon: XCircle, color: "text-red-500", count: 0 },
                      { label: "Pedidos aguardando envio", icon: Truck, color: "text-amber-500", count: 0 },
                      { label: "Devoluções em aberto", icon: RotateCcw, color: "text-amber-500", count: 0 },
                      { label: "Pagamento a receber", icon: DollarSign, color: "text-green-600", count: 0 },
                    ].map(({ label, icon: Icon, color, count }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2.5">
                          <Icon size={15} className={color} />
                          <span className="text-sm text-gray-700">{label}</span>
                        </div>
                        <span className={`text-sm font-semibold ${count > 0 ? color : "text-muted-foreground"}`}>
                          {count > 0 ? count : "—"}
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground text-center pt-2">Nenhum alerta no momento</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quality + Catalog */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Quality & reputation */}
              <Card className="border shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star size={16} className="text-[#C0181A]" />
                    Qualidade e reputação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0 divide-y">
                    {[
                      { label: "Avaliação média", icon: Star },
                      { label: "Taxa de devolução", icon: RotateCcw },
                      { label: "Tempo médio de envio", icon: Clock },
                      { label: "Taxa de cancelamento", icon: XCircle },
                      { label: "Reclamações abertas", icon: AlertTriangle },
                    ].map(({ label, icon: Icon }) => (
                      <div key={label} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Icon size={13} className="text-muted-foreground shrink-0" />
                          {label}
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">--</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Catalog & visibility */}
              <Card className="border shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye size={16} className="text-[#C0181A]" />
                    Catálogo e visibilidade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0 divide-y">
                    {[
                      { label: "Produtos ativos", icon: CheckCircle },
                      { label: "Estoque crítico (< 5 un.)", icon: AlertTriangle },
                      { label: "Sem venda nos últimos 30 dias", icon: Package },
                      { label: "Taxa de conversão média", icon: TrendingUp },
                      { label: "Anúncios com desconto ativo", icon: Tag },
                    ].map(({ label, icon: Icon }) => (
                      <div key={label} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Icon size={13} className="text-muted-foreground shrink-0" />
                          {label}
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">--</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        )}
      </div>
    </Layout>
  );
}
