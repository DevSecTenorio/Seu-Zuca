import type { Metadata } from "next";
import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página não encontrada — Seu Zuca" };

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CompassIcon className="size-8" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold text-foreground">Página não encontrada</h1>
      <p className="mt-2 text-muted-foreground">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/">Voltar para a home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/catalogo">Ver catálogo</Link>
        </Button>
      </div>
    </div>
  );
}
