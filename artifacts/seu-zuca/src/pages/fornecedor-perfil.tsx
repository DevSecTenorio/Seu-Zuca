import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, Building2, Package, Star, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

const BRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type SupplierProfile = {
  id: number;
  nome: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  ramo?: string;
  createdAt: string;
  totalProdutos: number;
  mediaAvaliacao: number;
  totalAvaliacoes: number;
  products: Array<{
    id: number; nome: string; slug: string; preco: number;
    unidadeMedida: string; imagemPrincipal?: string; disponivel: boolean;
  }>;
};

export default function FornecedorPerfil() {
  const params = useParams<{ id: string }>();
  const { isApprovedBuyer, isAdmin, isSupplier } = useAuth();
  const canSeePrice = isApprovedBuyer || isAdmin || isSupplier;

  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`/api/suppliers/${params.id}/public`);
        if (r.status === 404) { setNotFound(true); return; }
        if (r.ok) setSupplier(await r.json());
      } finally { setLoading(false); }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
          <div className="h-32 bg-muted animate-pulse rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square bg-muted animate-pulse rounded-xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (notFound || !supplier) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <Building2 size={48} className="mx-auto mb-4 text-muted-foreground opacity-30" />
          <p className="text-lg font-semibold mb-1">Fornecedor não encontrado</p>
          <p className="text-sm text-muted-foreground mb-4">O perfil não existe ou não está disponível</p>
          <Link href="/catalogo"><Button variant="outline">Ver catálogo</Button></Link>
        </div>
      </Layout>
    );
  }

  const since = new Date(supplier.createdAt).getFullYear();
  const displayName = supplier.nomeFantasia || supplier.nome;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header card */}
        <div className="bg-gradient-to-r from-[#C0181A] to-[#E85D00] rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
              <Building2 size={28} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{displayName}</h1>
              {supplier.razaoSocial && supplier.razaoSocial !== displayName && (
                <p className="text-white/80 text-sm">{supplier.razaoSocial}</p>
              )}
              {supplier.ramo && (
                <Badge className="mt-1 bg-white/20 text-white border-white/30 text-xs hover:bg-white/30">
                  {supplier.ramo}
                </Badge>
              )}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-white/70 text-xs">Membro desde</p>
              <p className="text-xl font-bold">{since}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Package, label: "Produtos", value: supplier.totalProdutos, color: "text-blue-600", bg: "bg-blue-50" },
            { icon: Star, label: "Avaliação", value: supplier.mediaAvaliacao > 0 ? `${supplier.mediaAvaliacao}/5` : "Sem avaliações", color: "text-amber-600", bg: "bg-amber-50" },
            { icon: ShoppingBag, label: "Avaliações", value: supplier.totalAvaliacoes, color: "text-green-600", bg: "bg-green-50" },
          ].map(s => (
            <Card key={s.label} className="border shadow-none">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center shrink-0`}>
                  <s.icon size={18} className={s.color} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-bold text-sm">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Products */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Produtos disponíveis</h2>
          {supplier.products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>Nenhum produto disponível no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {supplier.products.map(product => (
                <Link key={product.id} href={`/produto/${product.slug || product.id}`}>
                  <div className="border rounded-xl overflow-hidden hover:border-[#E85D00] hover:shadow-md transition-all cursor-pointer group">
                    <div className="aspect-square bg-muted overflow-hidden">
                      {product.imagemPrincipal
                        ? <img src={product.imagemPrincipal} alt={product.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        : <Building2 size={36} className="m-auto text-muted-foreground opacity-30" />}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-medium line-clamp-2 mb-2">{product.nome}</h3>
                      {canSeePrice ? (
                        <p className="text-[#C0181A] font-bold text-sm">
                          {BRL(product.preco)}<span className="text-xs text-muted-foreground font-normal">/{product.unidadeMedida}</span>
                        </p>
                      ) : (
                        <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                          <Lock size={10} className="text-gray-400" />
                          <span className="text-xs text-gray-500">Login para ver</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
