import { useState } from "react";
import { useGetDashboardStats, useAdminListUsers, useAdminApproveUser, useAdminSuspendUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users, Package, ShoppingBag, TrendingUp, CheckCircle, XCircle,
  Clock, UserPlus, LayoutDashboard, AlertCircle, Eye, EyeOff, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const roleLabel: Record<string, string> = { admin: "Admin", buyer: "Comprador", supplier: "Fornecedor" };
const statusLabel: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado", suspended: "Suspenso" };
const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  suspended: "outline",
};

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

function formatCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─── Aba: Criar Fornecedor ────────────────────────────────────────────────────
function CreateSupplierTab({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [success, setSuccess] = useState<{ nome: string; email: string; senha: string } | null>(null);
  const [form, setForm] = useState({
    nome: "",
    razaoSocial: "",
    nomeFantasia: "",
    email: "",
    password: "",
    cnpj: "",
    telefone: "",
    ramo: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: "" }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Nome é obrigatório";
    if (!form.email.trim()) e.email = "E-mail é obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "E-mail inválido";
    if (!form.password.trim()) e.password = "Senha é obrigatória";
    else if (form.password.length < 6) e.password = "Mínimo 6 caracteres";
    if (!form.cnpj.trim()) e.cnpj = "CNPJ é obrigatório";
    else if (form.cnpj.replace(/\D/g, "").length !== 14) e.cnpj = "CNPJ deve ter 14 dígitos";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/create-supplier", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cnpj: form.cnpj.replace(/\D/g, ""),
          razaoSocial: form.razaoSocial || form.nome,
          nomeFantasia: form.nomeFantasia || form.nome,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao criar fornecedor");
      }

      setSuccess({ nome: form.nomeFantasia || form.nome, email: form.email, senha: form.password });
      setForm({ nome: "", razaoSocial: "", nomeFantasia: "", email: "", password: "", cnpj: "", telefone: "", ramo: "" });
      onCreated();
      toast({ title: "Fornecedor criado com sucesso!" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar fornecedor";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
          <h3 className="text-lg font-bold text-green-800 mb-1">Fornecedor criado com sucesso!</h3>
          <p className="text-green-700 text-sm mb-4">Envie as credenciais ao fornecedor para que ele possa acessar a plataforma.</p>
          <div className="bg-white border border-green-200 rounded-lg p-4 text-left text-sm space-y-2 mb-5">
            <p><span className="font-semibold text-gray-600">Empresa:</span> <span className="font-bold">{success.nome}</span></p>
            <p><span className="font-semibold text-gray-600">E-mail:</span> <span className="font-mono">{success.email}</span></p>
            <p><span className="font-semibold text-gray-600">Senha:</span> <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{success.senha}</span></p>
          </div>
          <Button onClick={() => setSuccess(null)} className="bg-[#C0181A] hover:bg-[#a01416]">
            Criar outro fornecedor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 mb-6">
        Crie um acesso de fornecedor já aprovado. O fornecedor poderá cadastrar seus produtos imediatamente após o primeiro login.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Dados da empresa</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Nome do responsável <span className="text-red-500">*</span></Label>
              <Input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: João Silva" className={errors.nome ? "border-red-400" : ""} />
              {errors.nome && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.nome}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Razão Social</Label>
              <Input value={form.razaoSocial} onChange={e => set("razaoSocial", e.target.value)} placeholder="Ex: Empresa LTDA" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome Fantasia</Label>
              <Input value={form.nomeFantasia} onChange={e => set("nomeFantasia", e.target.value)} placeholder="Como aparecerá na plataforma" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">CNPJ <span className="text-red-500">*</span></Label>
              <Input
                value={form.cnpj}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 14);
                  const fmt = raw
                    .replace(/(\d{2})(\d)/, "$1.$2")
                    .replace(/(\d{3})(\d)/, "$1.$2")
                    .replace(/(\d{3})(\d)/, "$1/$2")
                    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
                  set("cnpj", fmt);
                }}
                placeholder="00.000.000/0000-00"
                className={`font-mono ${errors.cnpj ? "border-red-400" : ""}`}
              />
              {errors.cnpj && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.cnpj}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Telefone</Label>
              <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(11) 99999-9999" />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Ramo de atividade</Label>
              <Input value={form.ramo} onChange={e => set("ramo", e.target.value)} placeholder="Ex: Materiais de construção, tintas, etc." />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Credenciais de acesso</h3>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">E-mail <span className="text-red-500">*</span></Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              placeholder="fornecedor@empresa.com.br"
              className={errors.email ? "border-red-400" : ""}
            />
            {errors.email && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Senha inicial <span className="text-red-500">*</span></Label>
              <button
                type="button"
                onClick={() => set("password", generatePassword())}
                className="flex items-center gap-1 text-xs text-[#C0181A] hover:underline font-medium"
              >
                <RefreshCw size={12} />
                Gerar senha segura
              </button>
            </div>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={`pr-10 font-mono ${errors.password ? "border-red-400" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.password}</p>}
            <p className="text-xs text-gray-400">Anote a senha — ela não poderá ser recuperada por aqui depois.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="bg-[#C0181A] hover:bg-[#a01416] flex items-center gap-2">
            <UserPlus size={16} />
            {loading ? "Criando fornecedor..." : "Criar fornecedor"}
          </Button>
          <Button type="button" variant="outline" onClick={() => {
            setForm({ nome: "", razaoSocial: "", nomeFantasia: "", email: "", password: "", cnpj: "", telefone: "", ramo: "" });
            setErrors({});
          }}>
            Limpar
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "create-supplier">("overview");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: dashboard } = useGetDashboardStats({ query: { enabled: isAdmin } });
  const { data: users, isLoading, refetch } = useAdminListUsers({ query: { enabled: isAdmin } });
  const approveMutation = useAdminApproveUser();
  const suspendMutation = useAdminSuspendUser();

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

  const usersData = users as { users?: UserType[] } | UserType[] | undefined;
  const allUsers: UserType[] = Array.isArray(usersData)
    ? usersData
    : (usersData as { users?: UserType[] })?.users || [];

  const filteredUsers = allUsers.filter((u) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "supplier") return u.role === "supplier";
    if (statusFilter === "buyer") return u.role === "buyer";
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
      label: "Compradores aprovados",
      value: dash?.compradoresAprovados ?? allUsers.filter(u => u.role === "buyer" && u.status === "approved").length,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Package,
      label: "Fornecedores ativos",
      value: dash?.fornecedoresAtivos ?? allUsers.filter(u => u.role === "supplier" && u.status === "approved").length,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: ShoppingBag,
      label: "Total de pedidos",
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

  const navTabs = [
    { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
    {
      id: "users",
      label: "Usuários",
      icon: Users,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    { id: "create-supplier", label: "Criar Fornecedor", icon: UserPlus },
  ] as const;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
            {pendingCount > 0 && (
              <p className="text-sm text-amber-600 mt-0.5 flex items-center gap-1">
                <Clock size={13} />
                {pendingCount} {pendingCount === 1 ? "usuário aguardando" : "usuários aguardando"} aprovação
              </p>
            )}
          </div>
        </div>

        {/* Nav tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {navTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
              {"badge" in tab && tab.badge && (
                <span className="bg-[#C0181A] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Aba: Visão Geral ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <Card key={stat.label} className="border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center shrink-0`}>
                        <stat.icon size={18} className={stat.color} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground leading-tight">{stat.label}</p>
                        <p className="text-xl font-bold">{stat.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Extra info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">Pedidos pendentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black text-amber-500">{dash?.pedidosPendentes ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">Cotações pendentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black text-violet-500">{dash?.cotacoesPendentes ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">Comissões geradas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black text-emerald-500">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dash?.comissoesTotais ?? 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick actions */}
            {pendingCount > 0 && (
              <Card className="border-amber-200 bg-amber-50 shadow-none">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={20} className="text-amber-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-800 text-sm">
                        {pendingCount} {pendingCount === 1 ? "comprador aguarda" : "compradores aguardam"} aprovação
                      </p>
                      <p className="text-xs text-amber-700">Acesse a aba Usuários para aprovar ou recusar</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => { setActiveTab("users"); setStatusFilter("pending"); }}
                    className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                  >
                    Ver pendentes
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Aba: Usuários ────────────────────────────────────────────────── */}
        {activeTab === "users" && (
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Gerenciamento de Usuários</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => { setActiveTab("create-supplier"); }}
                >
                  <UserPlus size={13} />
                  Novo fornecedor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { v: "all", label: "Todos" },
                  { v: "pending", label: "Pendentes", highlight: pendingCount > 0 },
                  { v: "approved", label: "Aprovados" },
                  { v: "supplier", label: "Fornecedores" },
                  { v: "buyer", label: "Compradores" },
                  { v: "suspended", label: "Suspensos" },
                ].map(f => (
                  <button
                    key={f.v}
                    onClick={() => setStatusFilter(f.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      statusFilter === f.v
                        ? "bg-[#C0181A] text-white border-[#C0181A]"
                        : f.highlight
                        ? "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {f.label}
                    {f.highlight && pendingCount > 0 && (
                      <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5">{pendingCount}</span>
                    )}
                  </button>
                ))}
              </div>

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
                            <span className="font-mono text-xs">{user.cnpj ? formatCnpj(user.cnpj) : "-"}</span>
                          </td>
                          <td className="py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs ${user.role === "supplier" ? "border-emerald-300 text-emerald-700" : user.role === "buyer" ? "border-blue-300 text-blue-700" : ""}`}
                            >
                              {roleLabel[user.role || ""] || user.role}
                            </Badge>
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
                                <>
                                  <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(user.id!)}>
                                    <CheckCircle size={11} />
                                    Aprovar
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleSuspend(user.id!)}>
                                    Recusar
                                  </Button>
                                </>
                              )}
                              {user.status === "approved" && user.role !== "admin" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSuspend(user.id!)}>
                                  Suspender
                                </Button>
                              )}
                              {user.status === "suspended" && (
                                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(user.id!)}>
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
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Nenhum usuário neste filtro</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Aba: Criar Fornecedor ────────────────────────────────────────── */}
        {activeTab === "create-supplier" && (
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={20} className="text-[#C0181A]" />
                <CardTitle className="text-lg">Criar Acesso de Fornecedor</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CreateSupplierTab onCreated={() => refetch()} />
            </CardContent>
          </Card>
        )}

      </div>
    </Layout>
  );
}
