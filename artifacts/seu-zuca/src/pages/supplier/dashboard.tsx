import { useGetSupplierStats, useListSupplierProducts, useDeleteProduct } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp, ShoppingBag, DollarSign, Plus, Edit, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function SupplierDashboard() {
  const { isSupplier } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: dashboard } = useGetSupplierStats({ query: { enabled: isSupplier } });
  const { data: products, isLoading, refetch } = useListSupplierProducts({ query: { enabled: isSupplier } });
  const deleteMutation = useDeleteProduct();

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
    refetch();
    toast({ title: "Produto excluído" });
  }

  const stats = [
    { icon: Package, label: "Produtos", value: (products as unknown[])?.length ?? 0, color: "text-blue-600", bg: "bg-blue-100" },
    { icon: ShoppingBag, label: "Pedidos", value: (dashboard as { totalPedidos?: number })?.totalPedidos ?? 0, color: "text-emerald-600", bg: "bg-emerald-100" },
    { icon: TrendingUp, label: "Pedidos (mês)", value: (dashboard as { pedidosMes?: number })?.pedidosMes ?? 0, color: "text-violet-600", bg: "bg-violet-100" },
    {
      icon: DollarSign,
      label: "Faturamento",
      value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
        (dashboard as { faturamentoTotal?: number })?.faturamentoTotal ?? 0
      ),
      color: "text-amber-600",
      bg: "bg-amber-100",
    },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Painel do Fornecedor</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie seus produtos e pedidos</p>
          </div>
          <Button onClick={() => navigate("/fornecedor/produto/novo")} className="gap-2">
            <Plus size={16} />
            Novo Produto
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Meus Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : products && (products as unknown[]).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 text-muted-foreground font-medium">Produto</th>
                      <th className="text-left py-3 text-muted-foreground font-medium">Categoria</th>
                      <th className="text-right py-3 text-muted-foreground font-medium">Preço</th>
                      <th className="text-right py-3 text-muted-foreground font-medium">Estoque</th>
                      <th className="text-center py-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-right py-3 text-muted-foreground font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(products as Array<{
                      id: number;
                      nome: string;
                      sku?: string;
                      imagemPrincipal?: string;
                      categoryName?: string;
                      preco?: number;
                      estoque?: number;
                      disponivel?: boolean;
                      unidadeMedida?: string;
                    }>).map((product) => (
                      <tr key={product.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-muted rounded overflow-hidden shrink-0">
                              {product.imagemPrincipal ? (
                                <img src={product.imagemPrincipal} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package size={14} className="text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium line-clamp-1">{product.nome}</p>
                              <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-muted-foreground">{product.categoryName}</td>
                        <td className="py-3 text-right font-medium">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.preco || 0)}
                        </td>
                        <td className="py-3 text-right">
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
                <Button className="mt-4" onClick={() => navigate("/fornecedor/produto/novo")}>
                  <Plus size={16} className="mr-2" />
                  Cadastrar primeiro produto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
