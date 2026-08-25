import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { Pagination } from "@/components/pagination";
import { cn } from "@/lib/utils";
import { listTopLevelActiveCategories } from "@/server/actions/category-actions";
import { getCatalogProducts, type CatalogSort } from "@/server/queries/storefront";
import { CatalogSortSelect } from "./catalog-sort-select";
import { CatalogSearch } from "./catalog-search";

export const metadata: Metadata = { title: "Catálogo — Seu Zuca" };

const VALID_SORTS: CatalogSort[] = ["recentes", "preco-asc", "preco-desc", "mais-vendidos"];

type SearchParams = { categoria?: string; busca?: string; ordenar?: string; page?: string };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const sort = VALID_SORTS.includes(params.ordenar as CatalogSort) ? (params.ordenar as CatalogSort) : "recentes";
  const page = Number(params.page) > 0 ? Number(params.page) : 1;

  const [categories, result] = await Promise.all([
    listTopLevelActiveCategories(),
    getCatalogProducts({ categorySlug: params.categoria, busca: params.busca, sort, page }),
  ]);

  function buildHref(overrides: Partial<SearchParams>) {
    const next = { ...params, ...overrides };
    const usp = new URLSearchParams();
    if (next.categoria) usp.set("categoria", next.categoria);
    if (next.busca) usp.set("busca", next.busca);
    if (next.ordenar) usp.set("ordenar", next.ordenar);
    if (next.page && next.page !== "1") usp.set("page", next.page);
    const qs = usp.toString();
    return qs ? `/catalogo?${qs}` : "/catalogo";
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl uppercase tracking-wide text-foreground">Catálogo</h1>

      <div className="mt-4 flex flex-wrap gap-2 border-b pb-4">
        <Link
          href={buildHref({ categoria: undefined, page: undefined })}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium",
            !params.categoria ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
          )}
        >
          Todos os produtos
        </Link>
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={buildHref({ categoria: category.slug, page: undefined })}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              params.categoria === category.slug
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CatalogSearch initialValue={params.busca} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{result.total} produtos</span>
          <CatalogSortSelect current={sort} />
        </div>
      </div>

      {result.products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <SearchX className="size-10 text-muted-foreground/50" />
          <p className="text-lg font-medium text-foreground">Nenhum produto encontrado</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {params.busca
              ? `Não encontramos produtos para "${params.busca}". Tente outra busca ou remova os filtros.`
              : "Não há produtos disponíveis para esse filtro no momento."}
          </p>
          <Link href="/catalogo" className="text-sm font-medium text-primary hover:underline">
            Ver todos os produtos
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {result.products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
          <div className="mt-10">
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              buildHref={(p) => buildHref({ page: String(p) })}
            />
          </div>
        </>
      )}
    </div>
  );
}
