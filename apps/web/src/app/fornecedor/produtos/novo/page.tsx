import type { Metadata } from "next";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategoriesForProductForm, listUnitsForProductForm } from "@/server/actions/product-actions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Novo produto — Seu Zuca" };

export default async function NewProductPage() {
  await requireApprovedUser(["fornecedor"]);
  const [categories, units] = await Promise.all([listCategoriesForProductForm(), listUnitsForProductForm()]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Novo produto</CardTitle>
          <CardDescription>
            O produto entra na fila de moderação do admin e só aparece na loja depois de aprovado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm mode="create" categories={categories} units={units} />
        </CardContent>
      </Card>
    </div>
  );
}
