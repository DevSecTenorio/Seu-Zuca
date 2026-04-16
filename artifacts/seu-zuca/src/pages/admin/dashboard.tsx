import { useState } from "react";
import { useGetDashboardStats, useAdminListUsers, useAdminApproveUser, useAdminSuspendUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Package, ShoppingBag, TrendingUp, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const roleLabel: Record<string, string> = { admin: "Admin", buyer: "Comprador", supplier: "Fornecedor" };
const statusLabel: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado", suspended: "Suspenso" };
const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  suspended: "outline",
};

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const { data: dashboard } = useGetDashboardStats({ query: { enabled: isAdmin } });
  const { data: users, isLoading, refetch } = useAdminListUsers({ query: { enabled: isAdmin } });
  const approveMutation = useAdminApproveUser();
  const suspendMutation = useAdminSuspendUser();

  const [statusFilter, setStatusFilter] = useState("all");

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Acesso restrito a administradores</p>
        </div>
      </Layout>
    );
  }

  async function handleApprove(userId: number) {
    await approveMutation.mutateAsync({ id: String(userId) });
    refetch();
    toast({ title: "Usuário aprovado com sucesso" });
  }

  async function handleSuspend(userId: number) {
    await suspendMutation.mutateAsync({ id: String(userId) });
    refetch();
    toast({ title: "Usuário suspenso" });
  }

  type UserType = {
    id?: number;
    nome?: string;
    email?: string;
    cnpj?: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    role?: string;
    status?: string;
    createdAt?: string;
  };

  const usersData = users as { users?: UserType[] } | UserType[] | undefined;
  const allUsers: UserType[] = Array.isArray(usersData)
    ? usersData
    : (usersData as { users?: UserType[] })?.users || [];
  const filteredUsers = allUsers.filter((u) => {
    if (statusFilter === "all") return true;
    return u.status === statusFilter;
  });

  const pendingCount = allUsers.filter((u) => u.status === "pending").length;

  const dash = dashboard as {
    gmvTotal?: number;
    totalPedidos?: number;
    ticketMedio?: number;
    fornecedoresAtivos?: number;
    compradoresAprovados?: number;
    pedidosPendentes?: number;
    comissoesTotais?: number;
    cotacoesPendentes?: number;
  } | undefined;

  const stats = [
    {
      icon: Users,
      label: "Compradores Aprovados",
      value: dash?.compradoresAprovados ?? allUsers.filter(u => u.role === "buyer" && u.status === "approved").length,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Package,
      label: "Fornecedores Ativos",
      value: dash?.fornecedoresAtivos ?? allUsers.filter(u => u.role === "supplier").length,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: ShoppingBag,
      label: "Pedidos",
      value: dash?.totalPedidos ?? 0,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      icon: TrendingUp,
      label: "GMV Total",
      value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(dash?.gmvTotal ?? 0),
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Painel Administrativo</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-amber-600 mt-1">
              {pendingCount} {pendingCount === 1 ? "usuário aguardando" : "usuários aguardando"} aprovação
            </p>
          )}
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
            <CardTitle className="text-lg">Gerenciamento de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="pending" className="gap-1">
                  Pendentes
                  {pendingCount > 0 && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4 ml-1">{pendingCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="approved">Aprovados</TabsTrigger>
                <TabsTrigger value="suspended">Suspensos</TabsTrigger>
              </TabsList>
            </Tabs>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 text-muted-foreground font-medium">Empresa</th>
                      <th className="text-left py-3 text-muted-foreground font-medium">CNPJ</th>
                      <th className="text-left py-3 text-muted-foreground font-medium">Tipo</th>
                      <th className="text-left py-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-left py-3 text-muted-foreground font-medium">Cadastro</th>
                      <th className="text-right py-3 text-muted-foreground font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="py-3">
                          <p className="font-medium">{user.nomeFantasia || user.razaoSocial || user.nome}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </td>
                        <td className="py-3">
                          <span className="font-mono text-xs">{user.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</span>
                        </td>
                        <td className="py-3">
                          <Badge variant="outline" className="text-xs">{roleLabel[user.role || ""] || user.role}</Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            {user.status === "pending" && <Clock size={12} className="text-amber-500" />}
                            {user.status === "approved" && <CheckCircle size={12} className="text-green-500" />}
                            {user.status === "rejected" && <XCircle size={12} className="text-destructive" />}
                            <Badge variant={statusVariant[user.status!] || "secondary"} className="text-xs">
                              {statusLabel[user.status!] || user.status}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 text-muted-foreground text-xs">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString("pt-BR") : "-"}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            {user.status === "pending" && (
                              <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => handleApprove(user.id!)}>
                                <CheckCircle size={12} />
                                Aprovar
                              </Button>
                            )}
                            {user.status === "approved" && user.role !== "admin" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSuspend(user.id!)}>
                                Suspender
                              </Button>
                            )}
                            {user.status === "suspended" && (
                              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleApprove(user.id!)}>
                                Reativar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhum usuário neste filtro</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
