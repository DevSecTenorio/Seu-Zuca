import { useListOrders } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Package, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const statusLabel: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  em_separacao: "Em Separação",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  confirmado: "default",
  em_separacao: "default",
  enviado: "default",
  entregue: "outline",
  cancelado: "destructive",
};

export default function Orders() {
  const { isApprovedBuyer, isSupplier, isAdmin } = useAuth();

  const { data: orders, isLoading } = useListOrders({
    query: { enabled: isApprovedBuyer || isSupplier || isAdmin }
  });

  if (!isApprovedBuyer && !isSupplier && !isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Package size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Acesso restrito</p>
          <Link href="/login"><Button>Entrar</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6">Meus Pedidos</h1>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/pedido/${order.id}`}>
                <Card className="border-border hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-sm font-medium">#{String(order.id).padStart(6, "0")}</span>
                          <Badge variant={statusVariant[order.status] || "secondary"} className="text-xs">
                            {statusLabel[order.status] || order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.createdAt!).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        {order.supplierNome && (
                          <p className="text-xs text-muted-foreground mt-0.5">Fornecedor: {order.supplierNome}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <p className="font-bold text-lg">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total || 0)}
                        </p>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum pedido encontrado</p>
            <p className="text-sm mt-1 mb-6">Você ainda não fez nenhum pedido</p>
            <Link href="/catalogo">
              <Button>Explorar catálogo</Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
