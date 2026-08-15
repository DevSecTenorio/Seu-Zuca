import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategoriesForProductForm, listUnitsForProductForm } from "@/server/actions/product-actions";
import { ProductForm } from "../../product-form";

export const metadata: Metadata = { title: "Editar produto — Seu Zuca" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const supplier = await requireApprovedUser(["fornecedor"]);
  const { id } = await params;

  const [product, categories, units] = await Promise.all([
    db.query.products.findFirst({ where: eq(schema.products.id, id), with: { images: true } }),
    listCategoriesForProductForm(),
    listUnitsForProductForm(),
  ]);

  if (!product || product.supplierId !== supplier.id) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Editar produto</CardTitle>
          <CardDescription>Alterações reabrem a moderação do admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm
            mode="edit"
            categories={categories}
            units={units}
            product={{
              id: product.id,
              name: product.name,
              categoryId: product.categoryId,
              unitId: product.unitId,
              sku: product.sku,
              description: product.description,
              priceCents: product.priceCents,
              stock: product.stock,
              leadTimeDays: product.leadTimeDays,
              rejectionReason: product.rejectionReason,
              images: product.images.map((i) => ({ id: i.id, url: i.url })),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
