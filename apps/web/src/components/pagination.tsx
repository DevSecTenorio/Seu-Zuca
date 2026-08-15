import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Query-param-driven pagination — no client JS needed, just links, so it works with RSC data
 * fetching and is trivially crawlable. */
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );

  return (
    <nav aria-label="Paginação" className="flex items-center justify-center gap-1">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          "flex size-9 items-center justify-center rounded-md border text-sm",
          page === 1 ? "pointer-events-none opacity-40" : "hover:bg-accent",
        )}
      >
        <ChevronLeft className="size-4" />
      </Link>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Link
            href={buildHref(p)}
            className={cn(
              "flex size-9 items-center justify-center rounded-md border text-sm",
              p === page ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {p}
          </Link>
        </span>
      ))}
      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={cn(
          "flex size-9 items-center justify-center rounded-md border text-sm",
          page === totalPages ? "pointer-events-none opacity-40" : "hover:bg-accent",
        )}
      >
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
