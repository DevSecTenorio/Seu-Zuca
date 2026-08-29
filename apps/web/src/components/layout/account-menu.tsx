"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth-actions";

// Same reasoning as CategoriesMenu (see that file's comment): this was the other
// DropdownMenuTrigger asChild -> Button composition in the header, and reproduced the exact
// same recurring hydration mismatch — 100% on reload while logged in. Plain button + manual
// state, no Slot involved.
const MENU_ITEM_CLASS =
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground";

export function AccountMenu({
  label,
  roleLabel,
  panelHref,
}: {
  label: string;
  roleLabel: string;
  panelHref: string;
}) {
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
        onClick={() => setOpen((current) => !current)}
        className={cn(buttonVariants({ variant: "ghost" }), "gap-2")}
      >
        <User className="size-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>

      {open && (
        <div
          id={panelId}
          role="menu"
          aria-label="Conta"
          className="absolute top-full right-0 z-50 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-popover-foreground">{label}</p>
            <p className="text-xs font-normal text-muted-foreground">{roleLabel}</p>
          </div>
          <div className="-mx-1 my-1 h-px bg-border" />
          <Link href={panelHref} role="menuitem" onClick={close} className={MENU_ITEM_CLASS}>
            Meu painel
          </Link>
          <div className="-mx-1 my-1 h-px bg-border" />
          <form action={logoutAction}>
            <button type="submit" role="menuitem" className={cn(MENU_ITEM_CLASS, "w-full text-left")}>
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
