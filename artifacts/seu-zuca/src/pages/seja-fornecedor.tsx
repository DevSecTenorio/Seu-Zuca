import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { CheckCircle, TrendingUp, Users, FileText, Zap, Globe } from "lucide-react";

const BENEFICIOS = [
  { icon: Users, title: "Acesso a compradores PJ", desc: "Conecte-se a centenas de construtoras, empreiteiras e incorporadoras aprovadas." },
  { icon: FileText, title: "Gestão de cotações", desc: "Receba pedidos de cotação organizados e responda diretamente pela plataforma." },
  { icon: TrendingUp, title: "Visibilidade de vendas", desc: "Acompanhe seus produtos mais vendidos, avaliações e desempenho no painel." },
  { icon: Zap, title: "Cadastro simplificado", desc: "Publique produtos com poucos cliques e comece a vender rapidamente." },
  { icon: Globe, title: "Alcance nacional", desc: "Expanda sua carteira além da sua região com compradores de todo o Brasil." },
  { icon: CheckCircle, title: "Plataforma verificada", desc: "Todos os compradores possuem CNPJ válido e são aprovados manualmente." },
];

const REQUISITOS = [
  "CNPJ ativo e regular",
  "Atuação no segmento de materiais de construção",
  "Capacidade de emissão de nota fiscal",
  "Estrutura para atendimento a pedidos B2B",
];

export default function SejaFornecedor() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-14">

        {/* Hero */}
        <div className="bg-gradient-to-br from-[#C0181A] to-[#E85D00] rounded-2xl p-8 md:p-12 text-white text-center space-y-5">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            Venda materiais de construção<br className="hidden md:block" /> para empresas de todo o Brasil
          </h1>
          <p className="text-white/90 text-lg max-w-xl mx-auto">
            Cadastre sua empresa no Seu Zuca e acesse um canal de vendas B2B exclusivo com compradores qualificados.
          </p>
          <Link href="/cadastro/fornecedor">
            <button className="mt-2 px-8 py-3.5 bg-white text-[#C0181A] font-bold rounded-xl hover:bg-gray-100 transition-colors text-sm shadow-lg">
              Solicitar cadastro como fornecedor
            </button>
          </Link>
        </div>

        {/* Benefícios */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[#1a1a1a] text-center">Por que vender pelo Seu Zuca?</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {BENEFICIOS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-[#C0181A]/10 flex items-center justify-center">
                  <Icon size={17} className="text-[#C0181A]" />
                </div>
                <p className="font-semibold text-gray-900 text-sm">{title}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Como funciona */}
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-[#1a1a1a] text-center">Como funciona para fornecedores</h2>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { n: "1", t: "Solicite o cadastro", d: "Preencha os dados da sua empresa no formulário de cadastro." },
              { n: "2", t: "Aprovação em 48h", d: "Nossa equipe analisa e valida os dados da sua empresa." },
              { n: "3", t: "Publique produtos", d: "Cadastre seu catálogo com preços, fotos e condições." },
              { n: "4", t: "Comece a vender", d: "Receba pedidos e cotações de compradores B2B aprovados." },
            ].map(({ n, t, d }) => (
              <div key={n} className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#E85D00] text-white font-bold text-lg flex items-center justify-center mx-auto">{n}</div>
                <p className="font-semibold text-gray-900 text-sm">{t}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Requisitos */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900">Requisitos para ser fornecedor</h3>
          <ul className="space-y-2">
            {REQUISITOS.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle size={15} className="text-green-600 mt-0.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA final */}
        <div className="text-center space-y-3 border-t pt-10">
          <p className="text-gray-600 text-sm">Pronto para ampliar suas vendas B2B?</p>
          <Link href="/cadastro/fornecedor">
            <button className="px-8 py-3.5 bg-[#C0181A] text-white font-bold rounded-xl hover:bg-[#a01418] transition-colors text-sm">
              Cadastrar minha empresa agora
            </button>
          </Link>
          <p className="text-xs text-gray-500 mt-2">
            Dúvidas? Fale conosco em <span className="font-medium">contato@seuzuca.com.br</span>
          </p>
        </div>

      </div>
    </Layout>
  );
}
