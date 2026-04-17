import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Building2, ShieldCheck, TrendingUp, Users } from "lucide-react";

export default function QuemSomos() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-14">

        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-[#1a1a1a]">Quem somos</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            O Seu Zuca é o marketplace B2B especializado em materiais de construção para Pessoas Jurídicas.
            Conectamos construtoras, empreiteiras e incorporadoras diretamente aos melhores fornecedores do Brasil.
          </p>
        </div>

        {/* Mission */}
        <div className="bg-gradient-to-r from-[#C0181A] to-[#E85D00] rounded-2xl p-8 text-white text-center space-y-3">
          <h2 className="text-xl font-bold">Nossa missão</h2>
          <p className="text-white/90 max-w-xl mx-auto leading-relaxed">
            Simplificar a compra de materiais de construção em grande volume, com preços competitivos,
            cotações ágeis e total transparência para compradores corporativos.
          </p>
        </div>

        {/* Valores */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[#1a1a1a] text-center">Nossos valores</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { icon: ShieldCheck, title: "Confiança", desc: "Todos os fornecedores passam por aprovação manual antes de listar produtos na plataforma." },
              { icon: TrendingUp, title: "Eficiência", desc: "Sistema de cotações integrado que reduz o tempo de negociação entre comprador e fornecedor." },
              { icon: Users, title: "Foco em PJ", desc: "Plataforma exclusiva para Pessoas Jurídicas, garantindo um ambiente profissional e seguro." },
              { icon: Building2, title: "Construção", desc: "Especialistas no segmento de construção civil, com catálogo curado de produtos e fornecedores." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 p-5 rounded-xl border border-gray-100 bg-gray-50">
                <div className="w-10 h-10 rounded-xl bg-[#C0181A]/10 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-[#C0181A]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">{title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center border-t pt-10 space-y-4">
          <p className="text-gray-600">Faça parte do maior marketplace B2B de construção do Brasil</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/cadastro">
              <button className="px-6 py-3 bg-[#C0181A] text-white font-semibold rounded-lg hover:bg-[#a01418] transition-colors text-sm">
                Criar conta de comprador
              </button>
            </Link>
            <Link href="/seja-fornecedor">
              <button className="px-6 py-3 border-2 border-[#E85D00] text-[#E85D00] font-semibold rounded-lg hover:bg-[#E85D00]/5 transition-colors text-sm">
                Quero ser fornecedor
              </button>
            </Link>
          </div>
        </div>

      </div>
    </Layout>
  );
}
