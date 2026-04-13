import { Link } from "wouter";
import { Package, Clock, CheckCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AwaitingApproval() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-lg text-center">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl mb-8 justify-center">
          <div className="w-10 h-10 bg-[hsl(220,35%,14%)] rounded-lg flex items-center justify-center">
            <Package className="text-[hsl(25,95%,53%)]" size={20} />
          </div>
          <span>Seu Zuca</span>
        </Link>

        <Card className="border-border shadow-lg">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="text-amber-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-3">Conta aguardando aprovação</h1>
            <p className="text-muted-foreground mb-6">
              Seu cadastro foi recebido com sucesso! Nossa equipe irá analisar os dados da sua empresa
              e você receberá uma resposta por e-mail em até 2 dias úteis.
            </p>

            <div className="space-y-3 text-left mb-8">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="text-green-500 shrink-0" size={16} />
                <span>Cadastro realizado</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-4 h-4 rounded-full border-2 border-amber-400 shrink-0" />
                <span className="text-amber-600 font-medium">Aguardando análise do administrador</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
                <span>Acesso liberado ao catálogo e pedidos</span>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3 text-sm text-muted-foreground mb-6">
              <Mail size={16} className="shrink-0 mt-0.5" />
              <p>Você receberá um e-mail quando sua conta for aprovada ou se precisarmos de mais informações.</p>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/">
                <Button variant="outline" className="w-full">Voltar para a página inicial</Button>
              </Link>
              <Link href="/catalogo">
                <Button variant="ghost" className="w-full">Ver catálogo de produtos</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
