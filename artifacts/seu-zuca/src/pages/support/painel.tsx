import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Package, ShoppingBag, Star, ChevronLeft,
  Search, Building2, Phone, Mail, Hash, AlertCircle,
  CheckCircle, Clock, XCircle, ChevronRight, Headphones, LayoutDashboard,
  UserCheck, Calendar, MessageSquare
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Supplier = {
  id: number; nome: string; email: string; nomeFantasia?: string | null;
  razaoSocial?: string | null; cnpj?: string | null; telefone?: string | null;
  ramo?: string | null; status: string; createdAt: string;
};
type Buyer = {
  id: number; nome: string; email: string; cnpj?: string | null;
  razaoSocial?: string | null; nomeFantasia?: string | null;
  telefone?: string | null; status: string; createdAt: string; ultimoAcesso?: string | null;
};
type Summary = {
  produtos: number; pedidos: number;
  avaliacoes: number; notaMedia: number | null;
};
type BuyerSummary = { total: number };
type Product = { id: number; nome: string; sku?: string; estoque?: number; ativo?: boolean };
type Order = { id: number; status: string; createdAt: string };
type Review = { id: number; nota: number; comentario?: string | null; aprovado: boolean; createdAt: string };
type Overview = {
  compradores: { total: number; pendentes: number; aprovados: number };
  fornecedores: { total: number; ativos: number };
  pedidos: { total: number; pendentes: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", approved: "Aprovado", rejected: "Recusado", suspended: "Suspenso",
  pendente: "Pendente", confirmado: "Confirmado", enviado: "Enviado",
  entregue: "Entregue", cancelado: "Cancelado",
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock size={12} className="text-amber-500" />,
  approved: <CheckCircle size={12} className="text-green-500" />,
  rejected: <XCircle size={12} className="text-destructive" />,
  suspended: <AlertCircle size={12} className="text-gray-400" />,
  pendente: <Clock size={12} className="text-amber-500" />,
  confirmado: <CheckCircle size={12} className="text-blue-500" />,
  enviado: <Package size={12} className="text-violet-500" />,
  entregue: <CheckCircle size={12} className="text-green-500" />,
  cancelado: <XCircle size={12} className="text-destructive" />,
};

function formatCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
function fDate(d: string) { return new Date(d).toLocaleDateString("pt-BR"); }
function fDateTime(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Shared mini-components ───────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <Card className="shadow-none border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoPill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {icon}{children}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-12 text-center text-sm text-muted-foreground">{message}</div>;
}

// ─── Supplier detail ───────────────────────────────────────────────────────────
function SupplierDetail({ supplier, onBack }: { supplier: Supplier; onBack: () => void }) {
  const [tab, setTab] = useState<"resumo" | "produtos" | "pedidos" | "avaliacoes">("resumo");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (t: typeof tab) => {
    setLoading(true);
    try {
      const base = `/api/support/suppliers/${supplier.id}`;
      if (t === "resumo" && !summary) {
        const r = await fetch(`${base}/summary`, { credentials: "include" });
        if (r.ok) setSummary(await r.json());
      } else if (t === "produtos" && products.length === 0) {
        const r = await fetch(`${base}/products`, { credentials: "include" });
        if (r.ok) { const d = await r.json(); setProducts(d.products || []); }
      } else if (t === "pedidos" && orders.length === 0) {
        const r = await fetch(`${base}/orders`, { credentials: "include" });
        if (r.ok) { const d = await r.json(); setOrders(d.orders || []); }
      } else if (t === "avaliacoes" && reviews.length === 0) {
        const r = await fetch(`${base}/reviews`, { credentials: "include" });
        if (r.ok) { const d = await r.json(); setReviews(d.reviews || []); }
      }
    } finally { setLoading(false); }
  }, [supplier.id, summary, products.length, orders.length, reviews.length]);

  useEffect(() => { load("resumo"); }, []);
  function switchTab(t: typeof tab) { setTab(t); load(t); }

  const tabs = [
    { id: "resumo" as const, label: "Resumo" },
    { id: "produtos" as const, label: `Produtos${summary ? ` (${summary.produtos})` : ""}` },
    { id: "pedidos" as const, label: `Pedidos${summary ? ` (${summary.pedidos})` : ""}` },
    { id: "avaliacoes" as const, label: `Avaliações${summary ? ` (${summary.avaliacoes})` : ""}` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
          <ChevronLeft size={16} /> Voltar
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{supplier.nomeFantasia || supplier.nome}</h2>
          {supplier.razaoSocial && supplier.razaoSocial !== supplier.nome && (
            <p className="text-xs text-muted-foreground truncate">{supplier.razaoSocial}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {STATUS_ICON[supplier.status]}
          <Badge variant={supplier.status === "approved" ? "default" : "secondary"} className="text-xs">
            {STATUS_LABEL[supplier.status] || supplier.status}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
        {supplier.cnpj && <InfoPill icon={<Hash size={11} />}>{formatCnpj(supplier.cnpj)}</InfoPill>}
        <InfoPill icon={<Mail size={11} />}>{supplier.email}</InfoPill>
        {supplier.telefone && <InfoPill icon={<Phone size={11} />}>{supplier.telefone}</InfoPill>}
        {supplier.ramo && <InfoPill icon={<Building2 size={11} />}>{supplier.ramo}</InfoPill>}
        <InfoPill icon={<Clock size={11} />}>Desde {fDate(supplier.createdAt)}</InfoPill>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto max-w-full">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => switchTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>}

      {/* Resumo — sem valores financeiros */}
      {!loading && tab === "resumo" && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Package size={18} className="text-blue-600" />} label="Produtos cadastrados" value={summary.produtos} color="bg-blue-50" />
          <StatCard icon={<ShoppingBag size={18} className="text-violet-600" />} label="Pedidos recebidos" value={summary.pedidos} color="bg-violet-50" />
          <StatCard
            icon={<Star size={18} className="text-yellow-500" />}
            label="Avaliações"
            value={summary.avaliacoes}
            sub={summary.notaMedia ? `Média: ${summary.notaMedia}/5` : undefined}
            color="bg-yellow-50"
          />
        </div>
      )}

      {/* Produtos — sem coluna de preço */}
      {!loading && tab === "produtos" && (
        products.length === 0 ? <EmptyState message="Nenhum produto cadastrado" /> : (
          <Card className="shadow-none border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Produto</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">SKU</th>
                    <th className="text-right px-4 py-3">Estoque</th>
                    <th className="text-center px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium">{p.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">{p.sku || "-"}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{p.estoque ?? "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={p.ativo ? "default" : "secondary"} className="text-xs">{p.ativo ? "Ativo" : "Inativo"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* Pedidos — sem coluna de total */}
      {!loading && tab === "pedidos" && (
        orders.length === 0 ? <EmptyState message="Nenhum pedido encontrado" /> : (
          <Card className="shadow-none border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">ID</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{o.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">{STATUS_ICON[o.status]}<span>{STATUS_LABEL[o.status] || o.status}</span></div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">{fDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* Avaliações */}
      {!loading && tab === "avaliacoes" && (
        reviews.length === 0 ? <EmptyState message="Nenhuma avaliação encontrada" /> : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id} className="shadow-none border">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex gap-0.5 shrink-0 pt-0.5">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} size={14} className={s <= r.nota ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"} />
                    ))}
                  </div>
                  <div className="flex-1">
                    {r.comentario && <p className="text-sm text-gray-700">{r.comentario}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{fDate(r.createdAt)}</span>
                      <Badge variant={r.aprovado ? "default" : "secondary"} className="text-xs">{r.aprovado ? "Aprovada" : "Pendente"}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ─── Buyer detail ──────────────────────────────────────────────────────────────
function BuyerDetail({ buyer, onBack }: { buyer: Buyer; onBack: () => void }) {
  const [tab, setTab] = useState<"resumo" | "pedidos">("resumo");
  const [summary, setSummary] = useState<BuyerSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (t: typeof tab) => {
    setLoading(true);
    try {
      const base = `/api/support/buyers/${buyer.id}`;
      if (t === "resumo" && !summary) {
        const r = await fetch(`${base}/orders`, { credentials: "include" });
        if (r.ok) { const d = await r.json(); setSummary({ total: d.total }); setOrders(d.orders || []); }
      } else if (t === "pedidos" && orders.length === 0) {
        const r = await fetch(`${base}/orders`, { credentials: "include" });
        if (r.ok) { const d = await r.json(); setOrders(d.orders || []); if (!summary) setSummary({ total: d.total }); }
      }
    } finally { setLoading(false); }
  }, [buyer.id, summary, orders.length]);

  useEffect(() => { load("resumo"); }, []);
  function switchTab(t: typeof tab) { setTab(t); load(t); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
          <ChevronLeft size={16} /> Voltar
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{buyer.nomeFantasia || buyer.razaoSocial || buyer.nome}</h2>
          <p className="text-xs text-muted-foreground truncate">{buyer.email}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {STATUS_ICON[buyer.status]}
          <Badge variant={buyer.status === "approved" ? "default" : "secondary"} className="text-xs">
            {STATUS_LABEL[buyer.status] || buyer.status}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
        {buyer.cnpj && <InfoPill icon={<Hash size={11} />}>{formatCnpj(buyer.cnpj)}</InfoPill>}
        <InfoPill icon={<Mail size={11} />}>{buyer.email}</InfoPill>
        {buyer.telefone && <InfoPill icon={<Phone size={11} />}>{buyer.telefone}</InfoPill>}
        <InfoPill icon={<Calendar size={11} />}>Cadastro: {fDate(buyer.createdAt)}</InfoPill>
        {buyer.ultimoAcesso && (
          <InfoPill icon={<Clock size={11} />}>Último acesso: {fDateTime(buyer.ultimoAcesso)}</InfoPill>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
        {[
          { id: "resumo" as const, label: "Resumo" },
          { id: "pedidos" as const, label: `Pedidos${summary ? ` (${summary.total})` : ""}` },
        ].map((t) => (
          <button key={t.id} onClick={() => switchTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>}

      {/* Resumo — apenas contagens, sem valores */}
      {!loading && tab === "resumo" && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={<ShoppingBag size={18} className="text-violet-600" />} label="Pedidos realizados" value={summary?.total ?? 0} color="bg-violet-50" />
        </div>
      )}

      {/* Pedidos — sem coluna de total */}
      {!loading && tab === "pedidos" && (
        orders.length === 0 ? <EmptyState message="Nenhum pedido encontrado" /> : (
          <Card className="shadow-none border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">ID</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{o.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">{STATUS_ICON[o.status]}<span>{STATUS_LABEL[o.status] || o.status}</span></div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">{fDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

    </div>
  );
}

// ─── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/support/overview", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Compradores</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard icon={<Users size={18} className="text-blue-600" />} label="Total cadastrados" value={data.compradores.total} color="bg-blue-50" />
          <StatCard icon={<UserCheck size={18} className="text-green-600" />} label="Aprovados" value={data.compradores.aprovados} color="bg-green-50" />
          <StatCard
            icon={<Clock size={18} className="text-amber-600" />}
            label="Aguardando aprovação"
            value={data.compradores.pendentes}
            sub={data.compradores.pendentes > 0 ? "Necessita atenção" : undefined}
            color={data.compradores.pendentes > 0 ? "bg-amber-50" : "bg-gray-50"}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fornecedores</h3>
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={<Building2 size={18} className="text-violet-600" />} label="Total cadastrados" value={data.fornecedores.total} color="bg-violet-50" />
          <StatCard icon={<CheckCircle size={18} className="text-emerald-600" />} label="Ativos" value={data.fornecedores.ativos} color="bg-emerald-50" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pedidos</h3>
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={<ShoppingBag size={18} className="text-indigo-600" />} label="Total de pedidos" value={data.pedidos.total} color="bg-indigo-50" />
          <StatCard
            icon={<Clock size={18} className="text-amber-600" />}
            label="Pedidos pendentes"
            value={data.pedidos.pendentes}
            sub={data.pedidos.pendentes > 0 ? "Aguardando ação" : undefined}
            color={data.pedidos.pendentes > 0 ? "bg-amber-50" : "bg-gray-50"}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Suppliers list tab ────────────────────────────────────────────────────────
function SuppliersTab({ onSelect }: { onSelect: (s: Supplier) => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/support/suppliers", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setSuppliers)
      .finally(() => setLoading(false));
  }, []);

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return !q || s.nome.toLowerCase().includes(q) || (s.nomeFantasia || "").toLowerCase().includes(q)
      || (s.razaoSocial || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q)
      || (s.cnpj || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""));
  });

  return (
    <Card className="shadow-none border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 size={16} className="text-[#C0181A]" />
            Fornecedores ({filtered.length})
          </CardTitle>
          <div className="relative w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Nome, CNPJ ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm h-9" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState message={search ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-t text-xs text-muted-foreground bg-gray-50/50">
                <tr>
                  <th className="text-left px-4 py-3">Fornecedor</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">CNPJ</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Ramo</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Desde</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => onSelect(s)}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{s.nomeFantasia || s.nome}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                      {s.razaoSocial && s.razaoSocial !== s.nome && <p className="text-xs text-muted-foreground">{s.razaoSocial}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-muted-foreground">{s.cnpj ? formatCnpj(s.cnpj) : "-"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{s.ramo || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        {STATUS_ICON[s.status]}
                        <Badge variant={s.status === "approved" ? "default" : "secondary"} className="text-xs">{STATUS_LABEL[s.status] || s.status}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-xs text-muted-foreground">{fDate(s.createdAt)}</td>
                    <td className="px-4 py-3 text-right"><ChevronRight size={16} className="text-gray-300 inline-block" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Buyers list tab ───────────────────────────────────────────────────────────
function BuyersTab({ onSelect }: { onSelect: (b: Buyer) => void }) {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  async function loadBuyers(q?: string, status?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status && status !== "all") params.set("status", status);
      const url = `/api/support/buyers${params.toString() ? "?" + params : ""}`;
      const r = await fetch(url, { credentials: "include" });
      if (r.ok) setBuyers(await r.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { loadBuyers(); }, []);

  function handleSearch(q: string) { setSearch(q); loadBuyers(q, statusFilter); }
  function handleStatus(s: string) { setStatusFilter(s); loadBuyers(search, s); }

  return (
    <Card className="shadow-none border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users size={16} className="text-[#C0181A]" />
            Compradores ({buyers.length})
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative w-60">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Nome, CNPJ ou e-mail..." value={search} onChange={e => handleSearch(e.target.value)} className="pl-9 text-sm h-9" />
            </div>
            <div className="flex gap-1">
              {[
                { v: "all", l: "Todos" },
                { v: "pending", l: "Pendentes" },
                { v: "approved", l: "Aprovados" },
                { v: "suspended", l: "Suspensos" },
              ].map(f => (
                <button key={f.v} onClick={() => handleStatus(f.v)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${statusFilter === f.v ? "bg-[#C0181A] text-white border-[#C0181A]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : buyers.length === 0 ? (
          <EmptyState message={search || statusFilter !== "all" ? "Nenhum comprador encontrado" : "Nenhum comprador cadastrado"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-t text-xs text-muted-foreground bg-gray-50/50">
                <tr>
                  <th className="text-left px-4 py-3">Comprador</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">CNPJ</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Último acesso</th>
                  <th className="text-right px-4 py-3 hidden lg:table-cell">Cadastro</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {buyers.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => onSelect(b)}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{b.nomeFantasia || b.razaoSocial || b.nome}</p>
                      <p className="text-xs text-muted-foreground">{b.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-muted-foreground">{b.cnpj ? formatCnpj(b.cnpj) : "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        {STATUS_ICON[b.status]}
                        <Badge variant={b.status === "approved" ? "default" : b.status === "pending" ? "secondary" : "destructive"} className="text-xs">
                          {STATUS_LABEL[b.status] || b.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-xs text-muted-foreground">
                      {b.ultimoAcesso ? fDateTime(b.ultimoAcesso) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-xs text-muted-foreground">{fDate(b.createdAt)}</td>
                    <td className="px-4 py-3 text-right"><ChevronRight size={16} className="text-gray-300 inline-block" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main support panel ────────────────────────────────────────────────────────
type MainTab = "overview" | "fornecedores" | "compradores";
type DetailView =
  | { type: "supplier"; data: Supplier }
  | { type: "buyer"; data: Buyer }
  | null;

export default function SupportPanel() {
  const { isAdminOrSupport } = useAuth();
  const [tab, setTab] = useState<MainTab>("overview");
  const [detail, setDetail] = useState<DetailView>(null);

  if (!isAdminOrSupport) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Acesso restrito a administradores e suporte</p>
        </div>
      </Layout>
    );
  }

  const navTabs: { id: MainTab; label: string; icon: React.ElementType }[] = [
    { id: "overview",     label: "Visão Geral",  icon: LayoutDashboard },
    { id: "fornecedores", label: "Fornecedores", icon: Building2 },
    { id: "compradores",  label: "Compradores",  icon: Users },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
            <Headphones size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel de Suporte</h1>
            <p className="text-sm text-muted-foreground">Consulte compradores e fornecedores para prestar suporte</p>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6 overflow-x-auto">
          {navTabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setDetail(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab />}

        {tab === "fornecedores" && !detail && (
          <SuppliersTab onSelect={s => setDetail({ type: "supplier", data: s })} />
        )}
        {tab === "fornecedores" && detail?.type === "supplier" && (
          <SupplierDetail supplier={detail.data} onBack={() => setDetail(null)} />
        )}

        {tab === "compradores" && !detail && (
          <BuyersTab onSelect={b => setDetail({ type: "buyer", data: b })} />
        )}
        {tab === "compradores" && detail?.type === "buyer" && (
          <BuyerDetail buyer={detail.data} onBack={() => setDetail(null)} />
        )}

      </div>
    </Layout>
  );
}
