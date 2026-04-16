import { Router, type IRouter } from "express";
import { db, usersTable, productsTable, ordersTable, orderItemsTable, quotesTable, quoteItemsTable, reviewsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { authMiddleware, requireAdminOrSupport, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

/* ── List all suppliers (for support to pick one) ──────────────────────── */
router.get("/support/suppliers", authMiddleware, requireAdminOrSupport, async (_req: AuthRequest, res): Promise<void> => {
  const suppliers = await db
    .select({
      id: usersTable.id,
      nome: usersTable.nome,
      email: usersTable.email,
      nomeFantasia: usersTable.nomeFantasia,
      razaoSocial: usersTable.razaoSocial,
      cnpj: usersTable.cnpj,
      telefone: usersTable.telefone,
      ramo: usersTable.ramo,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "supplier"))
    .orderBy(desc(usersTable.createdAt));

  res.json(suppliers);
});

/* ── Supplier profile ───────────────────────────────────────────────────── */
router.get("/support/suppliers/:id/profile", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [supplier] = await db
    .select({
      id: usersTable.id,
      nome: usersTable.nome,
      email: usersTable.email,
      nomeFantasia: usersTable.nomeFantasia,
      razaoSocial: usersTable.razaoSocial,
      cnpj: usersTable.cnpj,
      telefone: usersTable.telefone,
      ramo: usersTable.ramo,
      status: usersTable.status,
      emailVerificado: usersTable.emailVerificado,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "supplier")));

  if (!supplier) { res.status(404).json({ message: "Fornecedor não encontrado" }); return; }
  res.json(supplier);
});

/* ── Supplier products ──────────────────────────────────────────────────── */
router.get("/support/suppliers/:id/products", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const supplierId = parseInt(req.params.id, 10);
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.supplierId, supplierId))
    .orderBy(desc(productsTable.createdAt));

  res.json({ products, total: products.length });
});

/* ── Supplier orders ────────────────────────────────────────────────────── */
router.get("/support/suppliers/:id/orders", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const supplierId = parseInt(req.params.id, 10);

  const orders = await db
    .select({
      id: ordersTable.id,
      status: ordersTable.status,
      total: ordersTable.total,
      createdAt: ordersTable.createdAt,
      buyerId: ordersTable.buyerId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.supplierId, supplierId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(50);

  // Totals
  const [totals] = await db
    .select({
      count: sql<number>`count(*)`,
      sum: sql<number>`coalesce(sum(${ordersTable.total}), 0)`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.supplierId, supplierId));

  res.json({ orders, total: Number(totals?.count ?? 0), gmv: Number(totals?.sum ?? 0) });
});

/* ── Supplier quotes ────────────────────────────────────────────────────── */
router.get("/support/suppliers/:id/quotes", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const supplierId = parseInt(req.params.id, 10);
  const quotes = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.supplierId, supplierId))
    .orderBy(desc(quotesTable.createdAt))
    .limit(50);

  res.json({ quotes, total: quotes.length });
});

/* ── Supplier reviews ───────────────────────────────────────────────────── */
router.get("/support/suppliers/:id/reviews", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const supplierId = parseInt(req.params.id, 10);

  const reviews = await db
    .select({
      id: reviewsTable.id,
      nota: reviewsTable.nota,
      comentario: reviewsTable.comentario,
      aprovado: reviewsTable.aprovada,
      createdAt: reviewsTable.createdAt,
      buyerId: reviewsTable.buyerId,
      productId: reviewsTable.productId,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.supplierId, supplierId))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(50);

  const [avg] = await db
    .select({ avgNota: sql<number>`round(avg(${reviewsTable.nota})::numeric, 1)` })
    .from(reviewsTable)
    .where(eq(reviewsTable.supplierId, supplierId));

  res.json({ reviews, avgNota: avg?.avgNota ?? null, total: reviews.length });
});

/* ── Summary stats for a supplier ──────────────────────────────────────── */
router.get("/support/suppliers/:id/summary", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const supplierId = parseInt(req.params.id, 10);

  const [prodCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(productsTable)
    .where(eq(productsTable.supplierId, supplierId));

  const [orderStats] = await db
    .select({
      count: sql<number>`count(*)`,
      gmv: sql<number>`coalesce(sum(${ordersTable.total}), 0)`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.supplierId, supplierId));

  const [quoteCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(quotesTable)
    .where(eq(quotesTable.supplierId, supplierId));

  const [reviewStats] = await db
    .select({
      count: sql<number>`count(*)`,
      avg: sql<number>`round(avg(${reviewsTable.nota})::numeric, 1)`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.supplierId, supplierId));

  res.json({
    produtos: Number(prodCount?.count ?? 0),
    pedidos: Number(orderStats?.count ?? 0),
    gmv: Number(orderStats?.gmv ?? 0),
    cotacoes: Number(quoteCount?.count ?? 0),
    avaliacoes: Number(reviewStats?.count ?? 0),
    notaMedia: reviewStats?.avg ?? null,
  });
});

export default router;
