import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { registerBuyerAction } from "@/server/actions/register-actions";
import { CompanyRegisterWizard } from "../company-register-wizard";

export const metadata: Metadata = {
  title: "Cadastro de comprador — Seu Zuca",
};

export default function RegisterBuyerPage() {
  return (
    <div className="flex flex-1 justify-center bg-muted/30 px-4 py-16">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Criar conta de comprador</CardTitle>
          <CardDescription>
            Cadastre sua empresa para comprar materiais de construção com preços exclusivos PJ. Sua
            conta passa por uma análise antes da liberação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyRegisterWizard action={registerBuyerAction} />
        </CardContent>
      </Card>
    </div>
  );
}
