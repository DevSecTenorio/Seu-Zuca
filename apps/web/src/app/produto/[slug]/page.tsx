import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Truck, Undo2 } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { StarRating } from "@/components/star-rating";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCentsToBRL, formatDate } from "@/lib/format";
import { getApprovedReviewsForProduct, getProductBySlug } from "@/server/queries/storefront";
import { ProductGallery } from "./product-gallery";
import { BuyBox } from "./buy-box";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado — Seu Zuca" };
  return {
    title: `${product.name} — Seu Zuca`,
    description: product.description.slice(0, 160),
  };
}

const TRUST_ROW = [
  { icon: ShieldCheck, label: "Compra segura" },
  { icon: Truck, label: "Entrega em todo o Brasil" },
  { icon: Undo2, label: "Suporte para trocas e disputas" },
];

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, user] = await Promise.all([getProductBySlug(slug), getCurrentUser()]);
  if (!product) notFound();

  const { reviews, average, count } = await getApprovedReviewsForProduct(product.id);
  const minQuantity = product.category.minQuantityRule?.minQuantity ?? 1;
  const multiple = product.category.minQuantityRule?.multiple ?? 1;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/catalogo">Catálogo</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/catalogo?categoria=${product.category.slug}`}>{product.category.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-4">
          <div>
            <Link
              href={product.supplier.company?.slug ? `/fornecedor/${product.supplier.company.slug}` : "#"}
              className="text-sm font-medium text-primary hover:underline"
            >
              {product.supplier.company?.nomeFantasia ?? "Fornecedor"}
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{product.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">SKU {product.sku}</p>
            {count > 0 && average !== null && (
              <div className="mt-2 flex items-center gap-2">
                <StarRating value={average} />
                <span className="text-sm text-muted-foreground">
                  {average.toFixed(1)} ({count} avaliaç{count === 1 ? "ão" : "ões"})
                </span>
              </div>
            )}
          </div>

          <div>
            <p className="text-3xl font-semibold text-foreground">{formatCentsToBRL(product.priceCents)}</p>
            <p className="text-sm text-muted-foreground">por {product.unit.abbreviation}</p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              Estoque: <strong className="text-foreground">{product.stock > 0 ? `${product.stock} disponíveis` : "indisponível"}</strong>
            </span>
            <span>
              Prazo de entrega: <strong className="text-foreground">{product.leadTimeDays} dia{product.leadTimeDays !== 1 && "s"} útei{product.leadTimeDays === 1 ? "l" : "s"}</strong>
            </span>
          </div>

          <BuyBox user={user} minQuantity={minQuantity} multiple={multiple} inStock={product.stock > 0} />

          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-4">
            {TRUST_ROW.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-4 text-primary" /> {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Descrição</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground">Avaliações</h2>
          {reviews.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Este produto ainda não tem avaliações.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {reviews.map((review) => (
                <li key={review.id} className="border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <StarRating value={review.rating} />
                    <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {review.buyer.company?.nomeFantasia ?? "Comprador verificado"}
                  </p>
                  {review.comment && <p className="mt-1 text-sm text-muted-foreground">{review.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
