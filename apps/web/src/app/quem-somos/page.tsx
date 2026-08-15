import type { Metadata } from "next";
import { Building2, ShieldCheck, Target, Users } from "lucide-react";

export const metadata: Metadata = { title: "Quem somos — Seu Zuca" };

const PILLARS = [
  {
    icon: Target,
    title: "Nossa missão",
    text: "Conectar fornecedores e construtoras de todo o Brasil em um único lugar, com preços claros e condições comerciais pensadas para pessoa jurídica.",
  },
  {
    icon: ShieldCheck,
    title: "Confiança em primeiro lugar",
    text: "Todo comprador e fornecedor passa por uma análise de documentos antes de operar na plataforma, e todo produto passa por moderação antes de ir ao ar.",
  },
  {
    icon: Users,
    title: "Feito para o setor",
    text: "Entendemos as particularidades da compra de materiais de construção: pedido mínimo, múltiplos por categoria, prazos de entrega e negociação entre empresas.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Building2 className="size-7" />
        </span>
        <h1 className="mt-4 text-3xl font-semibold text-foreground">Quem somos</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          O Seu Zuca é um marketplace B2B exclusivo para pessoas jurídicas, criado para simplificar a
          compra e venda de materiais de construção no Brasil. Do fornecedor regional à grande
          distribuidora, do pequeno empreiteiro à construtora de grande porte: colocamos compradores e
          fornecedores em contato direto, com segurança e transparência.
        </p>
      </div>

      <div className="mt-16 grid gap-8 sm:grid-cols-3">
        {PILLARS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <h2 className="font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
