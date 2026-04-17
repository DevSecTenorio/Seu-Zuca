import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { UserPlus, Search, ShoppingCart, FileText, Truck, Star } from "lucide-react";

const COMPRADOR_STEPS = [
  { icon: UserPlus, step: "1", title: "Crie sua conta PJ", desc: "Cadastre-se com seu CNPJ. Após análise, sua conta é aprovada em até 24 horas." },
  { icon: Search, step: "2", title: "Explore o catálogo", desc: "Navegue por mais de 8 categorias de materiais de construção de fornecedores verificados." },
  { icon: FileText, step: "3", title: "Solicite cotações", desc: "Monte seu carrinho e envie pedidos de cotação para múltiplos fornecedores de uma vez." },
  { icon: ShoppingCart, step: "4", title: "Feche negócio", desc: "Compare propostas, escolha a melhor e finalize a compra diretamente pela plataforma." },
  { icon: Truck, step: "5", title: "Receba seus produtos", desc: "Acompanhe o status do pedido em tempo real e receba os materiais no prazo combinado." },
  { icon: Star, step: "6", title: "Avalie o fornecedor", desc: "Sua avaliação ajuda outros compradores e melhora a qualidade da plataforma." },
];

const FORNECEDOR_STEPS = [
  { icon: UserPlus, step: "1", title: "Solicite cadastro", desc: "Preencha os dados da sua empresa. Nossa equipe analisa e aprova em até 48 horas." },
  { icon: ShoppingCart, step: "2", title: "Liste seus produtos", desc: "Cadastre produtos com preços, fotos, descrições e condições de entrega." },
  { icon: FileText, step: "3", title: "Receba cotações", desc: "Compradores enviam pedidos de cotação. Você responde com sua melhor proposta." },
  { icon: Truck, step: "4", title: "Entregue e receba", desc: "Confirme o pedido, entregue os materiais e receba o pagamento de forma segura." },
];

export default function ComoFunciona() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-14">

        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-[#1a1a1a]">Como funciona</h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Entenda como o Seu Zuca conecta compradores e fornecedores de materiais de construção.
          </p>
        </div>

        {/* Para compradores */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#C0181A] flex items-center justify-center">
              <ShoppingCart size={15} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-[#1a1a1a]">Para compradores</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {COMPRADOR_STEPS.map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="flex gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#C0181A]/20 transition-colors">
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-[#C0181A] text-white text-xs font-bold flex items-center justify-center">{step}</div>
                  <Icon size={14} className="text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/cadastro">
              <button className="px-6 py-3 bg-[#C0181A] text-white font-semibold rounded-lg hover:bg-[#a01418] transition-colors text-sm">
                Criar conta de comprador
              </button>
            </Link>
          </div>
        </div>

        {/* Divisor */}
        <div className="border-t border-dashed" />

        {/* Para fornecedores */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E85D00] flex items-center justify-center">
              <Truck size={15} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-[#1a1a1a]">Para fornecedores</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {FORNECEDOR_STEPS.map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="flex gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#E85D00]/20 transition-colors">
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-[#E85D00] text-white text-xs font-bold flex items-center justify-center">{step}</div>
                  <Icon size={14} className="text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/seja-fornecedor">
              <button className="px-6 py-3 bg-[#E85D00] text-white font-semibold rounded-lg hover:bg-[#c94e00] transition-colors text-sm">
                Quero ser fornecedor
              </button>
            </Link>
          </div>
        </div>

        {/* FAQ rápido */}
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900">Dúvidas frequentes</h3>
          {[
            { q: "Pessoa Física pode comprar?", a: "Não. O Seu Zuca é exclusivo para empresas com CNPJ ativo." },
            { q: "Como são feitos os pagamentos?", a: "Os pagamentos são processados de forma segura dentro da plataforma." },
            { q: "Os preços dos produtos são visíveis sem login?", a: "Os preços são exibidos apenas para compradores aprovados." },
          ].map(({ q, a }) => (
            <div key={q} className="border-b border-gray-200 last:border-0 pb-3 last:pb-0">
              <p className="text-sm font-semibold text-gray-800 mb-0.5">{q}</p>
              <p className="text-sm text-gray-600">{a}</p>
            </div>
          ))}
        </div>

      </div>
    </Layout>
  );
}
