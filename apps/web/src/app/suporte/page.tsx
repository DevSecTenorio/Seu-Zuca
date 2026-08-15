import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = {
  title: "Painel de Suporte — Seu Zuca",
};

const UPCOMING_SECTIONS = ["Visão Geral", "Fornecedores", "Compradores", "Relatórios"];

export default async function SupportPage() {
  const user = await requireUser(["suporte"]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Painel de Suporte</h1>
          <p className="mt-1 text-muted-foreground">Logado como {user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Somente leitura</CardTitle>
          <CardDescription>
            O papel Suporte consulta dados de fornecedores, compradores e pedidos para
            atendimento, sem alterar configurações — o servidor rejeita qualquer tentativa de
            mutação vinda desta conta. As abas abaixo serão implementadas nas próximas fases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground sm:grid-cols-4">
            {UPCOMING_SECTIONS.map((section) => (
              <li key={section} className="rounded-md border px-3 py-2">
                {section}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
