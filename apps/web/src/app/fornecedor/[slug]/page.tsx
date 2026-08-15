import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, MapPin, Package } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getSupplierBySlug } from "@/server/queries/storefront";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getSupplierBySlug(slug);
  if (!result) return { title: "Fornecedor não encontrado — Seu Zuca" };
  return { title: `${result.company.nomeFantasia} — Seu Zuca` };
}

export default async function SupplierStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getSupplierBySlug(slug);
  if (!result) notFound();

  const { company, products } = result;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="size-7" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{company.nomeFantasia}</h1>
            <p className="text-sm text-muted-foreground">{company.ramoAtividade}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Package className="size-4" /> {products.length} produtos ativos
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Produtos deste fornecedor</h2>
        {products.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <MapPin className="size-8 text-muted-foreground/40" />
            <p>Este fornecedor ainda não tem produtos ativos.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
