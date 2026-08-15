"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { validateQuantity } from "@/lib/quantity-rules";
import { getBuyableProduct, ruleFor } from "@/server/queries/cart";
import type { FormState } from "./form-state";

async function getOrCreateCartId(buyerId: string): Promise<string> {
  const existing = await db.query.carts.findFirst({ where: eq(schema.carts.buyerId, buyerId) });
  if (existing) return existing.id;
  const [cart] = await db.insert(schema.carts).values({ buyerId }).returning({ id: schema.carts.id });
  return cart.id;
}

export async function addToCartAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const buyer = await requireApprovedUser(["comprador"]);

  const productId = String(formData.get("productId") ?? "");
  const quantity = Number(formData.get("quantity"));
  if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
    return { status: "error", message: "Quantidade inválida." };
  }

  const product = await getBuyableProduct(productId);
  if (!product) {
    return { status: "error", message: "Este produto não está mais disponível." };
  }

  const cartId = await getOrCreateCartId(buyer.id);
  const existingItem = await db.query.cartItems.findFirst({
    where: and(eq(schema.cartItems.cartId, cartId), eq(schema.cartItems.productId, productId)),
  });
  const nextQuantity = (existingItem?.quantity ?? 0) + quantity;

  const validation = validateQuantity(nextQuantity, ruleFor(product));
  if (!validation.valid) {
    return { status: "error", message: validation.reason };
  }
  if (nextQuantity > product.stock) {
    return { status: "error", message: `Apenas ${product.stock} unidades em estoque.` };
  }

  if (existingItem) {
    await db.update(schema.cartItems).set({ quantity: nextQuantity, updatedAt: new Date() }).where(eq(schema.cartItems.id, existingItem.id));
  } else {
    await db.insert(schema.cartItems).values({ cartId, productId, quantity: nextQuantity });
  }

  revalidatePath("/carrinho");
  return { status: "success", message: "Produto adicionado ao carrinho." };
}

export async function updateCartItemQuantityAction(
  itemId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const buyer = await requireApprovedUser(["comprador"]);

  const quantity = Number(formData.get("quantity"));
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { status: "error", message: "Quantidade inválida." };
  }

  const item = await db.query.cartItems.findFirst({
    where: eq(schema.cartItems.id, itemId),
    with: { cart: true },
  });
  if (!item || item.cart.buyerId !== buyer.id) {
    return { status: "error", message: "Item não encontrado no carrinho." };
  }

  const product = await getBuyableProduct(item.productId);
  if (!product) {
    await db.delete(schema.cartItems).where(eq(schema.cartItems.id, itemId));
    revalidatePath("/carrinho");
    return { status: "error", message: "Este produto não está mais disponível e foi removido do carrinho." };
  }

  const validation = validateQuantity(quantity, ruleFor(product));
  if (!validation.valid) {
    return { status: "error", message: validation.reason };
  }
  if (quantity > product.stock) {
    return { status: "error", message: `Apenas ${product.stock} unidades em estoque.` };
  }

  await db.update(schema.cartItems).set({ quantity, updatedAt: new Date() }).where(eq(schema.cartItems.id, itemId));
  revalidatePath("/carrinho");
  return { status: "success" };
}

export async function removeCartItemAction(itemId: string) {
  const buyer = await requireApprovedUser(["comprador"]);
  const item = await db.query.cartItems.findFirst({ where: eq(schema.cartItems.id, itemId), with: { cart: true } });
  if (!item || item.cart.buyerId !== buyer.id) return;
  await db.delete(schema.cartItems).where(eq(schema.cartItems.id, itemId));
  revalidatePath("/carrinho");
}
