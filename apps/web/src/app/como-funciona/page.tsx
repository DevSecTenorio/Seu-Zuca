import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2, PackageSearch, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Como funciona — Seu Zuca" };

const STEPS = [
  {
    icon: FileCheck2,
    title: "1. Crie sua conta B2B",
    text: "Informe os dados da sua empresa e envie a documentação (cartão CNPJ, contrato social). Compradores e fornecedores passam por análise antes de operar na plataforma.",
  },
  {
    icon: PackageSearch,
    title: "2. Encontre ou cadastre produtos",
    text: "Compradores navegam pelo catálogo com preços exclusivos PJ. Fornecedores aprovados cadastram produtos, que passam por moderação antes de ficar visíveis publicamente.",
  },
  {
    icon: ShieldCheck,
    title: "3. Compre com segurança",
    text: "Pagamento via Mercado Pago (PIX, boleto ou cartão), com confirmação automática. Cada pedido soma frete e comissão da plataforma de forma transparente.",
  },
  {
    icon: Truck,
    title: "4. Acompanhe a entrega",
    text: "Acompanhe cada pedido em tempo real: separação, envio com código de rastreio e entrega, direto na sua área de pedidos.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-foreground">Como funciona</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Um marketplace pensado para o dia a dia de quem compra e vende materiais de construção,
          do cadastro ao pedido entregue.
        </p>
      </div>

      <ol className="mt-16 space-y-10">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-16 flex flex-col justify-center gap-3 rounded-xl border bg-muted/30 p-8 text-center sm:flex-row">
        <Button asChild size="lg">
          <Link href="/cadastro/comprador">Quero comprar</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/seja-fornecedor">Quero vender</Link>
        </Button>
      </div>
    </div>
  );
}
