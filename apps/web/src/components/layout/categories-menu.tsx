"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Deliberately not Radix's DropdownMenu here — this trigger's asChild/Slot composition
// (DropdownMenuTrigger asChild -> Button) was the repeat source of a hydration mismatch that
// kept coming back no matter how server/client render were resynced. A plain button with
// manually-managed open state has no Slot cloning step for React to disagree about.
const MENU_ITEM_CLASS =
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground";

export function CategoriesMenu({ categories }: { categories: { slug: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Todas as categorias"
        onClick={() => setOpen((current) => !current)}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        <LayoutGrid className="size-4" />
        <span className="hidden sm:inline">Todas as categorias</span>
      </button>

      {open && (
        <div
          id={panelId}
          role="menu"
          aria-label="Categorias"
          className="absolute top-full left-0 z-50 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <Link href="/catalogo" role="menuitem" onClick={close} className={MENU_ITEM_CLASS}>
            Todos os produtos
          </Link>
          <Link href="/catalogo?ordenar=recentes" role="menuitem" onClick={close} className={MENU_ITEM_CLASS}>
            Lançamentos
          </Link>
          {/* No promotions data model in the MVP (SPEC backlog) — points at the full catalog
              rather than faking a filter that doesn't exist yet. */}
          <Link href="/catalogo" role="menuitem" onClick={close} className={MENU_ITEM_CLASS}>
            Promoções
          </Link>
          <Link href="/catalogo?ordenar=mais-vendidos" role="menuitem" onClick={close} className={MENU_ITEM_CLASS}>
            Mais vendidos
          </Link>
          <div className="-mx-1 my-1 h-px bg-border" />
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/catalogo?categoria=${category.slug}`}
              role="menuitem"
              onClick={close}
              className={MENU_ITEM_CLASS}
            >
              {category.name}
            </Link>
          ))}
          <div className="-mx-1 my-1 h-px bg-border" />
          <Link href="/seja-fornecedor" role="menuitem" onClick={close} className={MENU_ITEM_CLASS}>
            Vender no Seu Zuca
          </Link>
        </div>
      )}
    </div>
  );
}
