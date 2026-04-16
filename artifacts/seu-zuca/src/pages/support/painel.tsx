import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Package, ShoppingBag, Star, MessageSquare, ChevronLeft,
  Search, TrendingUp, Building2, Phone, Mail, Hash, AlertCircle,
  CheckCircle, Clock, XCircle, FileText, ChevronRight, Headphones
} from "lucide-react";

type Supplier = {
  id: number;
  nome: string;
  email: string;
  nomeFantasia?: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  ramo?: string | null;
  status: string;
  createdAt: string;
};

type Summary = {
  produtos: number;
  pedidos: number;
  gmv: number;
  cotacoes: number;
  avaliacoes: number;
  notaMedia: number | null;
};

type Product = { id: number; nome: string; sku?: string; preco?: number; estoque?: number; ativo?: boolean; createdAt: string };
type Order = { id: number; status: string; total: number; createdAt: string; buyerId?: number };
type Quote = { id: number; status: string; createdAt: string; buyerId?: number };
type Review = { id: number; nota: number; comentario?: string | null; aprovado: boolean; createdAt: string };

const STATUS_LABEL: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado", suspended: "Suspenso" };
const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock size={12} className="text-amber-500" />,
  approved: <CheckCircle size={12} className="text-green-500" />,
  rejected: <XCircle size={12} className="text-destructive" />,
  suspended: <AlertCircle size={12} className="text-gray-400" />,
};

function formatCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function SummaryCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) {
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

function SupplierDetail({ supplier, onBack }: { supplier: Supplier; onBack: () => void }) {
  const [tab, setTab] = useState<"resumo" | "produtos" | "pedidos" | "cotacoes" | "avaliacoes">("resumo");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
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
      } else if (t === "cotacoes" && quotes.length === 0) {
        const r = await fetch(`${base}/quotes`, { credentials: "include" });
        if (r.ok) { const d = await r.json(); setQuotes(d.quotes || []); }
      } else if (t === "avaliacoes" && reviews.length === 0) {
        const r = await fetch(`${base}/reviews`, { credentials: "include" });
        if (r.ok) { const d = await r.json(); setReviews(d.reviews || []); }
      }
    } finally { setLoading(false); }
  }, [supplier.id, summary, products.length, orders.length, quotes.length, reviews.length]);

  useEffect(() => { load("resumo"); }, []);

  function switchTab(t: typeof tab) { setTab(t); load(t); }

  const tabs = [
    { id: "resumo" as const, label: "Resumo" },
    { id: "produtos" as const, label: `Produtos (${summary?.produtos ?? "..."})` },
    { id: "pedidos" as const, label: `Pedidos (${summary?.pedidos ?? "..."})` },
    { id: "cotacoes" as const, label: `Cotações (${summary?.cotacoes ?? "..."})` },
    { id: "avaliacoes" as const, label: `Avaliações (${summary?.avaliacoes ?? "..."})` },
  ];

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
          <ChevronLeft size={16} /> Voltar
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">{supplier.nomeFantasia || supplier.nome}</h2>
          {supplier.razaoSocial && supplier.razaoSocial !== supplier.nome && (
            <p className="text-xs text-muted-foreground">{supplier.razaoSocial}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_ICON[supplier.status]}
          <Badge variant={supplier.status === "approved" ? "default" : "secondary"} className="text-xs">
            {STATUS_LABEL[supplier.status] || supplier.status}
          </Badge>
        </div>
      </div>

      {/* Info pills */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
        {supplier.cnpj && <span className="flex items-center gap-1"><Hash size={11} /> {formatCnpj(supplier.cnpj)}</span>}
        <span className="flex items-center gap-1"><Mail size={11} /> {supplier.email}</span>
        {supplier.telefone && <span className="flex items-center gap-1"><Phone size={11} /> {supplier.telefone}</span>}
        {supplier.ramo && <span className="flex items-center gap-1"><Building2 size={11} /> {supplier.ramo}</span>}
        <span className="flex items-center gap-1"><Clock size={11} /> Desde {formatDate(supplier.createdAt)}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>}

      {/* ── Resumo ── */}
      {!loading && tab === "resumo" && summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard icon={<Package size={18} className="text-blue-600" />} label="Produtos cadastrados" value={summary.produtos} color="bg-blue-50" />
          <SummaryCard icon={<ShoppingBag size={18} className="text-violet-600" />} label="Pedidos recebidos" value={summary.pedidos} color="bg-violet-50" />
          <SummaryCard icon={<TrendingUp size={18} className="text-emerald-600" />} label="GMV total" value={formatCurrency(summary.gmv)} color="bg-emerald-50" />
          <SummaryCard icon={<FileText size={18} className="text-amber-600" />} label="Cotações recebidas" value={summary.cotacoes} color="bg-amber-50" />
          <SummaryCard
            icon={<Star size={18} className="text-yellow-500" />}
            label="Avaliações"
            value={summary.avaliacoes}
            sub={summary.notaMedia ? `Média: ${summary.notaMedia}/5` : undefined}
            color="bg-yellow-50"
          />
        </div>
      )}

      {/* ── Produtos ── */}
      {!loading && tab === "produtos" && (
        products.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Nenhum produto cadastrado</div>
        ) : (
          <Card className="shadow-none border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Produto</th>
                    <th className="text-left px-4 py-3">SKU</th>
                    <th className="text-right px-4 py-3">Preço</th>
                    <th className="text-right px-4 py-3">Estoque</th>
                    <th className="text-center px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium">{p.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.sku || "-"}</td>
                      <td className="px-4 py-3 text-right">{p.preco ? formatCurrency(p.preco) : "-"}</td>
                      <td className="px-4 py-3 text-right">{p.estoque ?? "-"}</td>
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

      {/* ── Pedidos ── */}
      {!loading && tab === "pedidos" && (
        orders.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Nenhum pedido encontrado</div>
        ) : (
          <Card className="shadow-none border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">ID</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{o.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {STATUS_ICON[o.status] || null}
                          <span>{STATUS_LABEL[o.status] || o.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(o.total)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* ── Cotações ── */}
      {!loading && tab === "cotacoes" && (
        quotes.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma cotação encontrada</div>
        ) : (
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
                <tbody className="divide-y divide-gray-50">
                  {quotes.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{q.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {STATUS_ICON[q.status] || null}
                          <span>{STATUS_LABEL[q.status] || q.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">{formatDate(q.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* ── Avaliações ── */}
      {!loading && tab === "avaliacoes" && (
        reviews.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma avaliação encontrada</div>
        ) : (
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
                      <span>{formatDate(r.createdAt)}</span>
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

export default function SupportPanel() {
  const { isAdminOrSupport } = useAuth();
  const [, navigate] = useLocation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Supplier | null>(null);

  useEffect(() => {
    if (!isAdminOrSupport) return;
    fetch("/api/support/suppliers", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then(setSuppliers)
      .finally(() => setLoading(false));
  }, [isAdminOrSupport]);

  if (!isAdminOrSupport) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Acesso restrito a administradores e suporte</p>
        </div>
      </Layout>
    );
  }

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.nome.toLowerCase().includes(q) || (s.nomeFantasia || "").toLowerCase().includes(q)
      || (s.razaoSocial || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q)
      || (s.cnpj || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""));
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Headphones size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel de Suporte</h1>
            <p className="text-sm text-muted-foreground">Analise a base de fornecedores para dar suporte</p>
          </div>
        </div>

        {selected ? (
          <SupplierDetail supplier={selected} onBack={() => setSelected(null)} />
        ) : (
          <Card className="shadow-none border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users size={16} className="text-[#C0181A]" />
                  Fornecedores ({filtered.length})
                </CardTitle>
                <div className="relative w-72">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome, CNPJ ou e-mail..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-sm h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Carregando fornecedores...</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {search ? "Nenhum fornecedor encontrado para esta busca" : "Nenhum fornecedor cadastrado"}
                </div>
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
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setSelected(s)}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-900">{s.nomeFantasia || s.nome}</p>
                            <p className="text-xs text-muted-foreground">{s.email}</p>
                            {s.razaoSocial && s.razaoSocial !== s.nome && (
                              <p className="text-xs text-muted-foreground">{s.razaoSocial}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-muted-foreground">
                            {s.cnpj ? formatCnpj(s.cnpj) : "-"}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                            {s.ramo || "-"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center gap-1.5 justify-center">
                              {STATUS_ICON[s.status]}
                              <Badge variant={s.status === "approved" ? "default" : "secondary"} className="text-xs">
                                {STATUS_LABEL[s.status] || s.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell text-xs text-muted-foreground">
                            {formatDate(s.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ChevronRight size={16} className="text-gray-300 inline-block" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
