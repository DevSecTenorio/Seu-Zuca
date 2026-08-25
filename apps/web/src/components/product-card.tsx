import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCentsToBRL } from "@/lib/format";
import { LOW_STOCK_THRESHOLD } from "@/server/queries/storefront";

export type ProductCardData = {
  slug: string;
  name: string;
  // Absent (not null) when the viewer isn't authorized to see prices — SPEC.md "Visibilidade de
  // preço". Server-stripped in src/lib/price-visibility.ts, never fetched-then-hidden here.
  priceCents?: number;
  stock: number;
  category: { name: string };
  unit: { abbreviation: string };
  images: { url: string }[];
};

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <Badge variant="secondary">Indisponível</Badge>;
  if (stock <= LOW_STOCK_THRESHOLD)
    return <Badge className="border-transparent bg-warning text-warning-foreground">Últimas unidades</Badge>;
  return <Badge variant="outline">Em estoque</Badge>;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = product.images[0];
  const productHref = `/produto/${product.slug}`;
  const hasPrice = typeof product.priceCents === "number";

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-t-[3px] border-t-primary bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      {/* Price row lives outside this Link (see below) — an anchor can't contain another
          anchor, and the "Faça login para ver o preço" CTA needs to point at /login, not here. */}
      <Link href={productHref} className="flex flex-1 flex-col">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {image ? (
            <Image
              src={image.url}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="size-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3 pb-0">
          <span className="text-xs font-medium text-muted-foreground">{product.category.name}</span>
          <h3 className="line-clamp-2 text-sm font-medium text-foreground">{product.name}</h3>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 p-3 pt-1.5">
        {hasPrice ? (
          <Link href={productHref}>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatCentsToBRL(product.priceCents!)}
            </p>
            <p className="text-xs text-muted-foreground">por {product.unit.abbreviation}</p>
          </Link>
        ) : (
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Faça login para ver o preço
          </Link>
        )}
        <StockBadge stock={product.stock} />
      </div>
    </div>
  );
}
