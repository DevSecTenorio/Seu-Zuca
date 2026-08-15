import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart, Store } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Criar conta B2B — Seu Zuca",
};

export default function RegisterChoicePage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-16">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-foreground">Criar conta B2B</h1>
          <p className="mt-2 text-muted-foreground">
            O Seu Zuca é exclusivo para pessoas jurídicas. Escolha o tipo de conta para começar.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <ShoppingCart className="size-8 text-primary" />
              <CardTitle className="mt-2">Sou comprador</CardTitle>
              <CardDescription>
                Quero comprar materiais de construção com preços exclusivos para empresas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/cadastro/comprador">Cadastrar como comprador</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Store className="size-8 text-primary" />
              <CardTitle className="mt-2">Sou fornecedor</CardTitle>
              <CardDescription>
                Quero vender meus produtos para construtoras e empreiteiras em todo o Brasil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/cadastro/fornecedor">Cadastrar como fornecedor</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
