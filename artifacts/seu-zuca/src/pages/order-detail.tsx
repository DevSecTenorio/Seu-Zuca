import { useState } from "react";
import { useParams } from "wouter";
import { useGetOrder, useUpdateOrderStatus } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Package, MapPin, User, Building2, ChevronLeft, CheckCircle2, Clock, Truck, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendente:     { label: "Pendente",     color: "bg-yellow-100 text-yellow-800 border-yellow-200",  icon: Clock },
  em_separacao: { label: "Em Separação", color: "bg-blue-100 text-blue-800 border-blue-200",        icon: Package },
  enviado:      { label: "Enviado",      color: "bg-violet-100 text-violet-800 border-violet-200",  icon: Truck },
  entregue:     { label: "Entregue",     color: "bg-green-100 text-green-800 border-green-200",     icon: CheckCircle2 },
  cancelado:    { label: "Cancelado",    color: "bg-red-100 text-red-800 border-red-200",           icon: XCircle },
};

const FLOW: Record<string, { next: string; label: string }[]> = {
  pendente:     [{ next: "em_separacao", label: "Confirmar e separar" }, { next: "cancelado", label: "Cancelar pedido" }],
  em_separacao: [{ next: "enviado", label: "Marcar como enviado" }, { next: "cancelado", label: "Cancelar pedido" }],
  enviado:      [{ next: "entregue", label: "Confirmar entrega" }],
  entregue:     [],
  cancelado:    [],
};

const BRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { isSupplier, isAdmin, isApprovedBuyer } = useAuth();
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { data: order, isLoading, refetch } = useGetOrder(Number(id), {
    query: { enabled: !!id }
  });

  const updateStatus = useUpdateOrderStatus();

  async function handleStatus(status: string) {
    try {
      await updateStatus.mutateAsync({ id: Number(id), data: { status } });
      toast({ title: "Status atualizado!" });
      refetch();
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const r = await fetch(`/api/orders/${id}/cancel`, {
        method: "PUT",
        credentials: "include",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast({ title: (err as { message?: string }).message || "Erro ao cancelar pedido", variant: "destructive" });
        return;
      }
      toast({ title: "Pedido cancelado com sucesso" });
      setCancelOpen(false);
      refetch();
    } catch {
      toast({ title: "Erro ao cancelar pedido", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-muted-foreground">
          <Package size={48} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">Pedido não encontrado</p>
          <Link href="/pedidos">
            <Button variant="outline" className="mt-4">Ver meus pedidos</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pendente;
  const StatusIcon = cfg.icon;
  const nextActions = FLOW[order.status] || [];
  const items = (order as { items?: Array<{ id: number; productId: number; productName: string; quantidade: number; precoUnitario: number; subtotal: number }> }).items || [];
  const address = (order as { address?: { logradouro?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; cep?: string } }).address;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Link href="/pedidos">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ChevronLeft size={14} />
            Voltar aos pedidos
          </button>
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Pedido #{String(order.id).padStart(6, "0")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(order.createdAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${cfg.color}`}>
            <StatusIcon size={14} />
            {cfg.label}
          </span>
        </div>

        {/* Timeline de status */}
        <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-1">
          {["pendente", "em_separacao", "enviado", "entregue"].map((s, i) => {
            const done = ["pendente", "em_separacao", "enviado", "entregue"].indexOf(order.status) >= i;
            const isCurrent = order.status === s;
            return (
              <div key={s} className="flex items-center">
                <div className={`flex flex-col items-center min-w-[80px] ${done ? "opacity-100" : "opacity-40"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${isCurrent ? "border-[#E85D00] bg-[#E85D00] text-white" : done ? "border-green-500 bg-green-500 text-white" : "border-gray-300 bg-white"}`}>
                    {done && !isCurrent ? <CheckCircle2 size={14} /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </div>
                  <span className="text-[10px] text-center mt-1 leading-tight whitespace-nowrap">{STATUS_CONFIG[s]?.label}</span>
                </div>
                {i < 3 && <div className={`h-0.5 w-8 flex-shrink-0 mb-4 ${["pendente", "em_separacao", "enviado", "entregue"].indexOf(order.status) > i ? "bg-green-400" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>

        {/* Ações do fornecedor */}
        {isSupplier && nextActions.length > 0 && (
          <Card className="border-[#E85D00]/20 bg-orange-50/40 mb-4">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Ações disponíveis:</p>
              <div className="flex flex-wrap gap-2">
                {nextActions.map((action) => (
                  <Button
                    key={action.next}
                    size="sm"
                    variant={action.next === "cancelado" ? "outline" : "default"}
                    className={action.next === "cancelado" ? "border-red-300 text-red-700 hover:bg-red-50" : "bg-[#C0181A] hover:bg-[#a01418]"}
                    disabled={updateStatus.isPending}
                    onClick={() => handleStatus(action.next)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ações do comprador */}
        {isApprovedBuyer && !isSupplier && !isAdmin && order.status === "pendente" && (
          <Card className="border-red-100 bg-red-50/30 mb-4">
            <CardContent className="p-4">
              {!cancelOpen ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Precisa cancelar?</p>
                    <p className="text-xs text-muted-foreground">Cancelamento disponível enquanto o pedido está pendente.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 shrink-0"
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle size={14} className="mr-1.5" />
                    Cancelar pedido
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Confirmar cancelamento?</p>
                      <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita. O estoque será restaurado.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
                      Manter pedido
                    </Button>
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      disabled={cancelling}
                      onClick={handleCancel}
                    >
                      {cancelling ? <><Loader2 size={14} className="animate-spin mr-1.5" />Cancelando...</> : "Sim, cancelar"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Comprador */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground font-medium">
                <User size={14} /> Comprador
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="font-semibold text-sm">{(order as { buyerName?: string }).buyerName || "—"}</p>
            </CardContent>
          </Card>

          {/* Fornecedor */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground font-medium">
                <Building2 size={14} /> Fornecedor
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="font-semibold text-sm">{(order as { supplierName?: string }).supplierName || "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Endereço */}
        {address && (
          <Card className="mb-4">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground font-medium">
                <MapPin size={14} /> Endereço de entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 text-sm">
              <p>{address.logradouro}, {address.numero} — {address.bairro}</p>
              <p className="text-muted-foreground">{address.cidade} / {address.estado} — CEP {address.cep}</p>
            </CardContent>
          </Card>
        )}

        {/* Itens */}
        <Card className="mb-4">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-muted-foreground font-medium">Itens do pedido</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.quantidade}x {BRL(item.precoUnitario)}</p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">{BRL(item.subtotal)}</p>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between items-center">
              <p className="font-bold text-base">Total</p>
              <p className="font-bold text-lg text-[#C0181A]">{BRL(order.total || 0)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Observações */}
        {(order as { observacoes?: string }).observacoes && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{(order as { observacoes?: string }).observacoes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
