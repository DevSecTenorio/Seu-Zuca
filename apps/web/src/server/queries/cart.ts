import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** A product is only ever addable to a cart if it's currently buyable on the storefront —
 * mirrors the approved-product/approved-supplier filter in src/server/queries/storefront.ts, so
 * a cart line can never reference something a visitor couldn't also see on /produto/[slug]. */
export async function getBuyableProduct(productId: string) {
  const product = await db.query.products.findFirst({
    where: eq(schema.products.id, productId),
    with: { category: { with: { minQuantityRule: true } }, supplier: true },
  });
  if (!product) return null;
  if (product.moderationStatus !== "ativo") return null;
  if (product.supplier.role !== "fornecedor" || product.supplier.status !== "aprovado") return null;
  return product;
}

export function ruleFor(product: NonNullable<Awaited<ReturnType<typeof getBuyableProduct>>>) {
  return {
    minQuantity: product.category.minQuantityRule?.minQuantity ?? 1,
    multiple: product.category.minQuantityRule?.multiple ?? 1,
  };
}

export async function getCartForBuyer(buyerId: string) {
  const cart = await db.query.carts.findFirst({
    where: eq(schema.carts.buyerId, buyerId),
    with: {
      items: {
        with: {
          product: {
            with: {
              images: { orderBy: (i, { asc }) => [asc(i.order)] },
              unit: true,
              category: { with: { minQuantityRule: true } },
              supplier: { with: { company: true } },
            },
          },
        },
      },
    },
  });
  return cart?.items ?? [];
}
