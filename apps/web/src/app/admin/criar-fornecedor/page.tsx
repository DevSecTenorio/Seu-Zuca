import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateSupplierForm } from "./create-supplier-form";

export const metadata: Metadata = { title: "Criar Fornecedor — Admin — Seu Zuca" };

export default async function CreateSupplierPage() {
  await requireUser(["admin"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Criar fornecedor</h1>
        <p className="mt-1 text-muted-foreground">
          Cadastra um fornecedor já aprovado, sem passar pela fila de análise de documentos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
          <CardDescription>Use para parceiros já validados fora da plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateSupplierForm />
        </CardContent>
      </Card>
    </div>
  );
}
