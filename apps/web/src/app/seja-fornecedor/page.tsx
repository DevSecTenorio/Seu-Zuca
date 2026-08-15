import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, LineChart, Megaphone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Seja um fornecedor — Seu Zuca" };

const BENEFITS = [
  {
    icon: Megaphone,
    title: "Alcance novos compradores",
    text: "Seus produtos ficam visíveis para construtoras e empreiteiras de todo o Brasil que já buscam ativamente por materiais de construção.",
  },
  {
    icon: Wallet,
    title: "Comissão transparente",
    text: "Uma única comissão por pedido, calculada e exibida de forma clara — sem taxas escondidas.",
  },
  {
    icon: LineChart,
    title: "Painel completo",
    text: "Acompanhe pedidos, faturamento e desempenho de vendas em um painel próprio, com relatórios exportáveis.",
  },
  {
    icon: BadgeCheck,
    title: "Marca de confiança",
    text: "Cadastro e produtos passam por análise, o que reforça a confiança do comprador em fechar negócio com você.",
  },
];

export default function BecomeSupplierPage() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b bg-gradient-to-b from-muted/50 to-background">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Venda materiais de construção para todo o Brasil
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Cadastre sua empresa gratuitamente, envie a documentação e comece a vender assim que
            aprovado. Sem mensalidade fixa — você paga uma comissão apenas sobre o que vender.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/cadastro/fornecedor">Cadastrar minha empresa</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 rounded-lg border bg-card p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold text-foreground">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
