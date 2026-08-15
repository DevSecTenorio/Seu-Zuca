import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { registerSupplierAction } from "@/server/actions/register-actions";
import { CompanyRegisterWizard } from "../company-register-wizard";

export const metadata: Metadata = {
  title: "Cadastro de fornecedor — Seu Zuca",
};

export default function RegisterSupplierPage() {
  return (
    <div className="flex flex-1 justify-center bg-muted/30 px-4 py-16">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Criar conta de fornecedor</CardTitle>
          <CardDescription>
            Cadastre sua empresa para vender materiais de construção no Seu Zuca. Sua conta e seus
            produtos passam por análise antes de ficarem visíveis no catálogo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyRegisterWizard action={registerSupplierAction} />
        </CardContent>
      </Card>
    </div>
  );
}
