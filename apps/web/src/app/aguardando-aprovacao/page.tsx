import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Aguardando aprovação — Seu Zuca",
};

export default async function AwaitingApprovalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "pendente") redirect(ROLE_HOME[user.role]);

  const roleLabel = user.role === "fornecedor" ? "fornecedor" : "comprador";

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-16">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="items-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-warning/15">
            <Clock3 className="size-7 text-warning" />
          </div>
          <CardTitle className="mt-4 text-2xl">Cadastro em análise</CardTitle>
          <CardDescription className="text-base">
            Recebemos o cadastro de <strong>{user.company?.nomeFantasia ?? "sua empresa"}</strong> como{" "}
            {roleLabel} e nossa equipe está analisando os documentos enviados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Esse processo normalmente leva até 2 dias úteis. Você receberá um e-mail em{" "}
            <strong>{user.email}</strong> assim que sua conta for aprovada ou caso precisemos de mais
            informações. Não é necessário enviar os documentos novamente.
          </p>
          <div className="flex justify-center">
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
