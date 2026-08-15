"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";

export async function toggleWishlistAction(productId: string) {
  const buyer = await requireApprovedUser(["comprador"]);

  const existing = await db.query.wishlistItems.findFirst({
    where: and(eq(schema.wishlistItems.buyerId, buyer.id), eq(schema.wishlistItems.productId, productId)),
  });

  if (existing) {
    await db.delete(schema.wishlistItems).where(eq(schema.wishlistItems.id, existing.id));
  } else {
    await db.insert(schema.wishlistItems).values({ buyerId: buyer.id, productId });
  }

  revalidatePath("/favoritos");
  revalidatePath("/produto", "layout");
}

export async function isProductWishlisted(buyerId: string, productId: string): Promise<boolean> {
  const existing = await db.query.wishlistItems.findFirst({
    where: and(eq(schema.wishlistItems.buyerId, buyerId), eq(schema.wishlistItems.productId, productId)),
  });
  return !!existing;
}

export async function getWishlistProducts(buyerId: string) {
  const items = await db.query.wishlistItems.findMany({
    where: eq(schema.wishlistItems.buyerId, buyerId),
    orderBy: (w, { desc }) => [desc(w.createdAt)],
    with: {
      product: {
        with: {
          images: { orderBy: (i, { asc }) => [asc(i.order)] },
          unit: true,
          category: true,
        },
      },
    },
  });
  return items.map((i) => i.product);
}
