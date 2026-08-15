import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestResetForm } from "./request-reset-form";

export const metadata: Metadata = {
  title: "Esqueci minha senha — Seu Zuca",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Esqueci minha senha</CardTitle>
          <CardDescription>
            Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestResetForm />
        </CardContent>
      </Card>
    </div>
  );
}
