import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { ProductCard } from "@/components/product-card";
import { getWishlistProducts } from "@/server/actions/wishlist-actions";

export const metadata: Metadata = { title: "Favoritos — Seu Zuca" };

export default async function WishlistPage() {
  const user = await requireApprovedUser(["comprador"]);
  const products = await getWishlistProducts(user.id);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-foreground">Favoritos</h1>

      {products.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <Heart className="size-10 text-muted-foreground/40" />
          <p>Você ainda não favoritou nenhum produto.</p>
          <Link href="/catalogo" className="text-primary hover:underline">
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
