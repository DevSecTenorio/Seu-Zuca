import { Router, type IRouter } from "express";
import { db, reviewsTable, productsTable, usersTable, ordersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireApprovedBuyer, requireAdmin, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/reviews", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const { productId, orderId, nota, comentario } = req.body;

  if (!productId || !orderId || !nota || !comentario) {
    res.status(400).json({ message: "Produto, pedido, nota e comentário são obrigatórios" });
    return;
  }

  if (nota < 1 || nota > 5) {
    res.status(400).json({ message: "Nota deve ser entre 1 e 5" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ message: "Produto não encontrado" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, orderId), eq(ordersTable.buyerId, req.userId!)));
  if (!order) {
    res.status(404).json({ message: "Pedido não encontrado" });
    return;
  }

  const [review] = await db.insert(reviewsTable).values({
    buyerId: req.userId!,
    supplierId: product.supplierId,
    productId,
    orderId,
    nota,
    comentario,
    aprovada: false,
  }).returning();

  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  res.status(201).json({ ...review, buyerName: buyer?.nome, productName: product.nome });
});

// ADMIN
router.get("/admin/reviews", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const reviews = await db.select().from(reviewsTable);
  const result = await Promise.all(reviews.map(async (r) => {
    const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, r.buyerId));
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, r.productId));
    return { ...r, buyerName: buyer?.nome, productName: product?.nome };
  }));
  res.json(result);
});

router.post("/admin/reviews/:id/approve", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [review] = await db.update(reviewsTable).set({ aprovada: true }).where(eq(reviewsTable.id, id)).returning();
  if (!review) {
    res.status(404).json({ message: "Avaliação não encontrada" });
    return;
  }

  res.json(review);
});

router.delete("/admin/reviews/:id/remove", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
  res.json({ message: "Avaliação removida com sucesso" });
});

export default router;
