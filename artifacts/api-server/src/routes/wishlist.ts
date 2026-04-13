import { Router, type IRouter } from "express";
import { db, wishlistsTable, productsTable, categoriesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireApprovedBuyer, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/wishlist", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const items = await db.select().from(wishlistsTable).where(eq(wishlistsTable.userId, req.userId!));

  const result = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    const [category] = product ? await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId)) : [null];
    const [supplier] = product ? await db.select().from(usersTable).where(eq(usersTable.id, product.supplierId)) : [null];
    return {
      id: item.id,
      productId: item.productId,
      addedAt: item.createdAt,
      product: product ? {
        ...product,
        categoryName: category?.nome,
        supplierName: supplier?.nomeFantasia || supplier?.nome,
      } : null,
    };
  }));

  res.json(result);
});

router.post("/wishlist/:productId", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);

  const existing = await db.select().from(wishlistsTable).where(
    and(eq(wishlistsTable.userId, req.userId!), eq(wishlistsTable.productId, productId))
  );

  if (existing.length === 0) {
    await db.insert(wishlistsTable).values({ userId: req.userId!, productId });
  }

  res.json({ message: "Produto adicionado aos favoritos" });
});

router.delete("/wishlist/:productId", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);

  await db.delete(wishlistsTable).where(
    and(eq(wishlistsTable.userId, req.userId!), eq(wishlistsTable.productId, productId))
  );

  res.json({ message: "Produto removido dos favoritos" });
});

export default router;
