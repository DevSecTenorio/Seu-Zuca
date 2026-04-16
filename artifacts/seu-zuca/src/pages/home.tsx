import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useListCategories, useListProducts } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Lock, ChevronLeft, ChevronRight, Star, Truck, Shield, BadgePercent, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ApiBanner = {
  id: number;
  titulo: string;
  subtitulo?: string | null;
  destaque?: string | null;
  tag?: string | null;
  imagemUrl?: string | null;
  linkUrl?: string | null;
  corFundo: string;
  ativo: boolean;
  ordem: number;
};

const FALLBACK_BANNERS: ApiBanner[] = [
  {
    id: 0, titulo: "MATERIAIS DE QUALIDADE", subtitulo: "em produtos selecionados",
    destaque: "até 30% OFF", tag: "Feirão da Construção",
    imagemUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80",
    corFundo: "from-[#C0181A] to-[#E85D00]", ativo: true, ordem: 1,
  },
];

function HeroBanner() {
  const [active, setActive] = useState(0);
  const [banners, setBanners] = useState<ApiBanner[]>(FALLBACK_BANNERS);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/banners", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: ApiBanner[] | null) => { if (data && data.length > 0) setBanners(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setActive((a) => (a + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  const b = banners[active] ?? banners[0];
  if (!b) return null;

  return (
    <div className={`relative bg-gradient-to-r ${b.corFundo} overflow-hidden`} style={{ minHeight: 320 }}>
      <div className="max-w-[1280px] mx-auto px-4 py-10 flex items-center justify-between gap-8">
        {/* Text */}
        <div className="text-white z-10 flex-1">
          {b.tag && (
            <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
              {b.tag}
            </span>
          )}
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-3 whitespace-pre-line">
            {b.titulo}
          </h1>
          {b.destaque && (
            <div className="inline-flex items-center bg-[#FFD700] text-[#1a1a1a] font-black text-xl px-5 py-2 rounded-full mb-2">
              {b.destaque}
            </div>
          )}
          {b.subtitulo && <p className="text-white/80 text-sm mt-2">{b.subtitulo}</p>}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => navigate(b.linkUrl || "/catalogo")}
              className="bg-white text-[#C0181A] font-bold px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Ver ofertas
            </button>
            <button
              onClick={() => navigate("/cadastro")}
              className="bg-transparent border-2 border-white text-white font-bold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors text-sm"
            >
              Criar conta B2B
            </button>
          </div>
        </div>

        {/* Image */}
        {b.imagemUrl && (
          <div className="hidden md:block flex-shrink-0 w-72 h-56 rounded-2xl overflow-hidden shadow-2xl">
            <img src={b.imagemUrl} alt={b.titulo} className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Nav arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => setActive((a) => (a - 1 + banners.length) % banners.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setActive((a) => (a + 1) % banners.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === active ? "bg-white scale-125" : "bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { data: categories } = useListCategories();
  const { data: productsData } = useListProducts({ limit: 8 });
  const { isApprovedBuyer, isAdmin, isSupplier } = useAuth();
  const canSeePrice = isApprovedBuyer || isAdmin || isSupplier;
  const [, navigate] = useLocation();

  return (
    <Layout>
      {/* Hero */}
      <HeroBanner />

      {/* Benefit bar */}
      <div className="bg-[#C0181A] text-white">
        <div className="max-w-[1280px] mx-auto px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Truck, text: "Entrega em todo o Brasil" },
              { icon: BadgePercent, text: "Preços exclusivos PJ" },
              { icon: Shield, text: "Compra 100% segura" },
              { icon: Building2, text: "Exclusivo Pessoa Jurídica" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm font-medium">
                <Icon size={18} className="shrink-0 opacity-90" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="py-8 px-4">
          <div className="max-w-[1280px] mx-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-800">Categorias</h2>
              <Link href="/catalogo" className="text-[#C0181A] text-sm font-medium hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {categories.slice(0, 8).map((cat) => (
                <Link key={cat.id} href={`/catalogo?categoryId=${cat.id}`}>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-white border-2 border-gray-100 rounded-xl flex items-center justify-center group-hover:border-[#E85D00] transition-all shadow-sm">
                      <Building2 size={24} className="text-[#C0181A]" />
                    </div>
                    <span className="text-xs text-center text-gray-700 font-medium leading-tight">{cat.nome}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Promotional section */}
      <section className="px-4 mb-8">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-r from-[#C0181A] to-[#E85D00] rounded-xl p-6 text-white">
            <p className="text-sm font-medium opacity-90 mb-1">Atacado B2B</p>
            <h3 className="text-2xl font-black mb-1">Cimento & Estrutura</h3>
            <p className="text-white/80 text-sm mb-4">Mínimo de 50 sacos</p>
            <button
              onClick={() => navigate("/catalogo?categoryId=5")}
              className="bg-white text-[#C0181A] text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Ver produtos
            </button>
          </div>
          <div className="bg-gradient-to-r from-[#1a3a6b] to-[#2a5298] rounded-xl p-6 text-white">
            <p className="text-sm font-medium opacity-90 mb-1">Novidades</p>
            <h3 className="text-2xl font-black mb-1">Acabamento & Pisos</h3>
            <p className="text-white/80 text-sm mb-4">Porcelanato e revestimentos</p>
            <button
              onClick={() => navigate("/catalogo?categoryId=7")}
              className="bg-white text-[#1a3a6b] text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Ver produtos
            </button>
          </div>
          <div className="bg-gradient-to-r from-[#1a6b2a] to-[#2a8a3a] rounded-xl p-6 text-white">
            <p className="text-sm font-medium opacity-90 mb-1">Cotação</p>
            <h3 className="text-2xl font-black mb-1">Precisa de orçamento?</h3>
            <p className="text-white/80 text-sm mb-4">Vários fornecedores respondem</p>
            <button
              onClick={() => navigate("/cotacoes")}
              className="bg-white text-[#1a6b2a] text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Solicitar cotação
            </button>
          </div>
        </div>
      </section>

      {/* Products grid */}
      {productsData?.products && productsData.products.length > 0 && (
        <section className="px-4 pb-10">
          <div className="max-w-[1280px] mx-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-800">Produtos em destaque</h2>
              <Link href="/catalogo" className="text-[#C0181A] text-sm font-medium hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {productsData.products.map((product) => (
                <Link key={product.id} href={`/produto/${product.slug || product.id}`}>
                  <div className="bg-white rounded-xl border border-gray-100 hover:border-[#E85D00] hover:shadow-md transition-all cursor-pointer overflow-hidden group">
                    <div className="aspect-square bg-gray-50 overflow-hidden">
                      {product.imagemPrincipal ? (
                        <img
                          src={product.imagemPrincipal}
                          alt={product.nome}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Building2 size={48} />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-400 mb-1">{product.categoryName}</p>
                      <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug mb-2">
                        {product.nome}
                      </h3>
                      <div className="flex items-center gap-1 mb-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={11} className="text-[#FFC107] fill-[#FFC107]" />
                        ))}
                      </div>
                      {canSeePrice ? (
                        <div>
                          <p className="text-[#C0181A] font-black text-lg leading-tight">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.preco || 0)}
                          </p>
                          <p className="text-gray-400 text-xs">por {product.unidadeMedida}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5">
                          <Lock size={11} className="text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-500">Faça login para ver</span>
                        </div>
                      )}
                      <div className="mt-2">
                        <Badge
                          variant={product.disponivel ? "default" : "secondary"}
                          className={`text-xs ${product.disponivel ? "bg-green-100 text-green-700 hover:bg-green-100 border-0" : ""}`}
                        >
                          {product.disponivel ? "Em estoque" : "Indisponível"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA banner for non-logged */}
      <section className="bg-[#1a1a1a] text-white py-12 px-4">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="text-3xl font-black mb-3">
            <span className="text-[#E85D00]">Sua empresa</span> merece os melhores preços
          </h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto text-sm">
            Crie sua conta B2B gratuitamente e tenha acesso a preços exclusivos para Pessoa Jurídica, sistema de cotação e compras em volume.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => navigate("/cadastro")}
              className="bg-[#C0181A] hover:bg-[#a01416] text-white font-bold px-8 py-3 rounded-lg transition-colors"
            >
              Criar conta B2B grátis
            </button>
            <button
              onClick={() => navigate("/catalogo")}
              className="bg-transparent border border-gray-500 text-gray-300 hover:border-white hover:text-white font-bold px-8 py-3 rounded-lg transition-colors"
            >
              Ver catálogo
            </button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
