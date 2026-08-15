import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Conta bloqueada — Seu Zuca",
};

export default async function AccountBlockedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "suspenso" && user.status !== "rejeitado") redirect(ROLE_HOME[user.role]);

  const isSuspended = user.status === "suspenso";

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-16">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="items-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="size-7 text-destructive" />
          </div>
          <CardTitle className="mt-4 text-2xl">
            {isSuspended ? "Conta suspensa" : "Cadastro rejeitado"}
          </CardTitle>
          <CardDescription className="text-base">
            {isSuspended
              ? "Sua conta foi suspensa e o acesso à plataforma está temporariamente bloqueado."
              : "Seu cadastro não foi aprovado."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isSuspended && user.rejectionReason && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-left text-sm">
              <p className="font-medium text-foreground">Motivo informado:</p>
              <p className="mt-1 text-muted-foreground">{user.rejectionReason}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Se você acredita que isso é um engano, entre em contato com o suporte informando o e-mail{" "}
            <strong>{user.email}</strong> para mais informações.
          </p>
          <div className="flex justify-center">
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
