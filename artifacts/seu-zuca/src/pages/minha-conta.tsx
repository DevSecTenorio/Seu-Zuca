import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Package, MapPin, ShoppingBag, Heart, Phone, Building2, Mail, ChevronRight, BarChart3 } from "lucide-react";
import ReportTab from "@/components/ReportTab";
import { Link } from "wouter";

const BRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type TabKey = "perfil" | "pedidos" | "enderecos" | "favoritos" | "relatorios";

type Order = { id: number; status: string; total: number; createdAt: string; supplierId?: number };
type Address = { id: number; cep: string; logradouro: string; numero: string; bairro: string; cidade: string; estado: string; principal?: boolean };
type WishlistItem = { id: number; productId: number; productName?: string; productPrice?: number; productImage?: string };

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", em_separacao: "Em Separação", enviado: "Enviado",
  entregue: "Entregue", cancelado: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700", em_separacao: "bg-blue-100 text-blue-700",
  enviado: "bg-violet-100 text-violet-700", entregue: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export default function MinhaConta() {
  const { user, isApprovedBuyer } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("perfil");
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);

  const [profileForm, setProfileForm] = useState({
    nome: user?.nome || "", telefone: (user as Record<string, string> | null)?.telefone || "",
    nomeFantasia: (user as Record<string, string> | null)?.nomeFantasia || "",
    razaoSocial: (user as Record<string, string> | null)?.razaoSocial || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [addrForm, setAddrForm] = useState({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
  const [showAddrForm, setShowAddrForm] = useState(false);

  useEffect(() => {
    if (tab === "pedidos") loadOrders();
    if (tab === "enderecos") loadAddresses();
    if (tab === "favoritos") loadWishlist();
  }, [tab]);

  async function loadOrders() {
    setLoadingOrders(true);
    try {
      const r = await fetch("/api/orders", { credentials: "include" });
      if (r.ok) setOrders(await r.json());
    } finally { setLoadingOrders(false); }
  }

  async function loadAddresses() {
    setLoadingAddresses(true);
    try {
      const r = await fetch("/api/addresses", { credentials: "include" });
      if (r.ok) setAddresses(await r.json());
    } finally { setLoadingAddresses(false); }
  }

  async function loadWishlist() {
    setLoadingWishlist(true);
    try {
      const r = await fetch("/api/wishlist", { credentials: "include" });
      if (r.ok) setWishlist(await r.json());
    } finally { setLoadingWishlist(false); }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const r = await fetch("/api/auth/profile", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      if (r.ok) { toast({ title: "Perfil atualizado!" }); }
      else { const d = await r.json(); toast({ title: d.message || "Erro ao salvar", variant: "destructive" }); }
    } finally { setSavingProfile(false); }
  }

  async function lookupCep() {
    const cep = addrForm.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`/api/cep/${cep}`);
      if (r.ok) {
        const d = await r.json();
        setAddrForm(f => ({ ...f, logradouro: d.logradouro || "", bairro: d.bairro || "", cidade: d.cidade || "", estado: d.estado || "" }));
      }
    } catch {}
  }

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await fetch("/api/addresses", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addrForm),
      });
      if (r.ok) {
        toast({ title: "Endereço adicionado!" });
        setShowAddrForm(false);
        setAddrForm({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
        loadAddresses();
      }
    } catch { toast({ title: "Erro ao salvar endereço", variant: "destructive" }); }
  }

  async function handleDeleteAddress(id: number) {
    if (!confirm("Excluir este endereço?")) return;
    await fetch(`/api/addresses/${id}`, { method: "DELETE", credentials: "include" });
    loadAddresses();
  }

  async function handleRemoveWishlist(productId: number) {
    await fetch(`/api/wishlist/${productId}`, { method: "DELETE", credentials: "include" });
    setWishlist(w => w.filter(i => i.productId !== productId));
    toast({ title: "Removido dos favoritos" });
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <User size={48} className="mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="text-lg font-semibold mb-2">Você precisa estar logado</p>
          <Link href="/login"><Button className="bg-[#C0181A] hover:bg-[#a01418]">Entrar</Button></Link>
        </div>
      </Layout>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "perfil", label: "Meu Perfil", icon: User },
    ...(isApprovedBuyer ? [
      { key: "pedidos" as TabKey, label: "Pedidos", icon: ShoppingBag },
      { key: "favoritos" as TabKey, label: "Favoritos", icon: Heart },
      { key: "relatorios" as TabKey, label: "Relatórios", icon: BarChart3 },
    ] : []),
    { key: "enderecos", label: "Endereços", icon: MapPin },
  ];

  const u = user as Record<string, string>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#C0181A] to-[#E85D00] flex items-center justify-center text-white font-bold text-xl">
            {(u.nome || "U")[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold">{u.nome}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail size={12} />{u.email}</p>
          </div>
          <Badge variant="secondary" className="ml-auto capitalize">{u.role === "buyer" ? "Comprador" : u.role}</Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors -mb-px ${
                tab === key ? "border-[#C0181A] text-[#C0181A]" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Perfil */}
        {tab === "perfil" && (
          <Card className="border shadow-none max-w-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><User size={16} className="text-[#C0181A]" /> Dados da conta</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={profileForm.nome} onChange={e => setProfileForm(f => ({ ...f, nome: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-9" placeholder="(11) 99999-9999" value={profileForm.telefone} onChange={e => setProfileForm(f => ({ ...f, telefone: e.target.value }))} />
                    </div>
                  </div>
                  {u.cnpj && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Razão Social</Label>
                        <Input value={profileForm.razaoSocial} onChange={e => setProfileForm(f => ({ ...f, razaoSocial: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nome Fantasia</Label>
                        <Input value={profileForm.nomeFantasia} onChange={e => setProfileForm(f => ({ ...f, nomeFantasia: e.target.value }))} />
                      </div>
                    </>
                  )}
                </div>
                {u.cnpj && (
                  <div className="space-y-1.5">
                    <Label>CNPJ</Label>
                    <Input value={u.cnpj} readOnly className="bg-muted/50 text-muted-foreground" />
                  </div>
                )}
                <Button type="submit" disabled={savingProfile} className="bg-[#C0181A] hover:bg-[#a01418]">
                  {savingProfile ? "Salvando..." : "Salvar alterações"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Pedidos */}
        {tab === "pedidos" && (
          <div className="space-y-3">
            {loadingOrders ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)
            ) : orders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingBag size={44} className="mx-auto mb-4 opacity-30" />
                <p className="font-medium">Nenhum pedido realizado ainda</p>
                <Link href="/catalogo"><Button className="mt-4 bg-[#C0181A] hover:bg-[#a01418]">Ver catálogo</Button></Link>
              </div>
            ) : (
              orders.map(order => (
                <Link key={order.id} href={`/pedido/${order.id}`}>
                  <Card className="border shadow-none hover:border-[#E85D00] transition-colors cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono font-bold text-sm">#{String(order.id).padStart(6, "0")}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[order.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                      <p className="font-bold text-[#C0181A]">{BRL(order.total)}</p>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Endereços */}
        {tab === "enderecos" && (
          <div className="space-y-4 max-w-xl">
            {loadingAddresses ? (
              Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)
            ) : addresses.length === 0 && !showAddrForm ? (
              <div className="text-center py-10 text-muted-foreground">
                <MapPin size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nenhum endereço cadastrado</p>
              </div>
            ) : (
              addresses.map(addr => (
                <Card key={addr.id} className="border shadow-none">
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{addr.logradouro}, {addr.numero}</p>
                      <p className="text-xs text-muted-foreground">{addr.bairro} — {addr.cidade}/{addr.estado}</p>
                      <p className="text-xs text-muted-foreground font-mono">CEP {addr.cep}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteAddress(addr.id)}>
                      Excluir
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
            {showAddrForm ? (
              <Card className="border shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Novo Endereço</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveAddress} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>CEP</Label>
                      <Input placeholder="00000-000" value={addrForm.cep} onChange={e => setAddrForm(f => ({ ...f, cep: e.target.value }))} onBlur={lookupCep} maxLength={9} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label>Logradouro</Label>
                        <Input value={addrForm.logradouro} onChange={e => setAddrForm(f => ({ ...f, logradouro: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Número</Label>
                        <Input value={addrForm.numero} onChange={e => setAddrForm(f => ({ ...f, numero: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Bairro</Label>
                        <Input value={addrForm.bairro} onChange={e => setAddrForm(f => ({ ...f, bairro: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cidade</Label>
                        <Input value={addrForm.cidade} onChange={e => setAddrForm(f => ({ ...f, cidade: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="bg-[#C0181A] hover:bg-[#a01418]">Salvar</Button>
                      <Button type="button" variant="outline" onClick={() => setShowAddrForm(false)}>Cancelar</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Button variant="outline" onClick={() => setShowAddrForm(true)} className="gap-2">
                <MapPin size={14} />
                Adicionar endereço
              </Button>
            )}
          </div>
        )}

        {/* Relatórios */}
        {tab === "relatorios" && (
          <ReportTab
            title="Histórico de Compras"
            endpoint="buyer/report"
            filenamePrefix="meus_pedidos"
            columns={[
              { key: "id", label: "Pedido", format: (v) => `#${String(v).padStart(6, "0")}` },
              { key: "data", label: "Data" },
              { key: "fornecedor", label: "Fornecedor" },
              { key: "total", label: "Total", format: (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v)), align: "right" },
              { key: "status", label: "Status" },
            ]}
            summaryItems={[
              { key: "total", label: "Pedidos no período", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
              { key: "totalGasto", label: "Total investido", format: (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v)), color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
            ]}
          />
        )}

        {/* Favoritos */}
        {tab === "favoritos" && (
          <div>
            {loadingWishlist ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : wishlist.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Heart size={44} className="mx-auto mb-4 opacity-30" />
                <p className="font-medium">Nenhum favorito ainda</p>
                <Link href="/catalogo"><Button className="mt-4 bg-[#C0181A] hover:bg-[#a01418]">Explorar catálogo</Button></Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {wishlist.map(item => (
                  <Link key={item.id} href={`/produto/${item.productId}`}>
                    <div className="border rounded-xl overflow-hidden hover:border-[#E85D00] transition-colors group cursor-pointer">
                      <div className="aspect-square bg-muted overflow-hidden">
                        {item.productImage
                          ? <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          : <Package size={28} className="m-auto text-muted-foreground" />}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium line-clamp-2">{item.productName || "Produto"}</p>
                        {item.productPrice && (
                          <p className="text-[#C0181A] font-bold text-sm mt-1">{BRL(item.productPrice)}</p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-destructive mt-1 h-6 px-0"
                          onClick={(e) => { e.preventDefault(); handleRemoveWishlist(item.productId); }}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
