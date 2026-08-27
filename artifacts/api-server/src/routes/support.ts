import { Router, type IRouter } from "express";
import { db, usersTable, productsTable, ordersTable, orderItemsTable, reviewsTable } from "@workspace/db";
import { eq, desc, sql, and, ilike, or } from "drizzle-orm";
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
  const id = parseInt(req.params.id as string, 10);
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
  const supplierId = parseInt(req.params.id as string, 10);
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.supplierId, supplierId))
    .orderBy(desc(productsTable.createdAt));

  res.json({ products, total: products.length });
});

/* ── Supplier orders ────────────────────────────────────────────────────── */
router.get("/support/suppliers/:id/orders", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const supplierId = parseInt(req.params.id as string, 10);

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

/* ── Supplier reviews ───────────────────────────────────────────────────── */
router.get("/support/suppliers/:id/reviews", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const supplierId = parseInt(req.params.id as string, 10);

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
  const supplierId = parseInt(req.params.id as string, 10);

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
    avaliacoes: Number(reviewStats?.count ?? 0),
    notaMedia: reviewStats?.avg ?? null,
  });
});

/* ── Overview stats for support dashboard ───────────────────────────────── */
router.get("/support/overview", authMiddleware, requireAdminOrSupport, async (_req: AuthRequest, res): Promise<void> => {
  const [buyerStats] = await db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where ${usersTable.status} = 'pending')`,
      approved: sql<number>`count(*) filter (where ${usersTable.status} = 'approved')`,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "buyer"));

  const [supplierStats] = await db
    .select({
      total: sql<number>`count(*)`,
      approved: sql<number>`count(*) filter (where ${usersTable.status} = 'approved')`,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "supplier"));

  const [orderStats] = await db
    .select({
      total: sql<number>`count(*)`,
      gmv: sql<number>`coalesce(sum(${ordersTable.total}), 0)`,
      pending: sql<number>`count(*) filter (where ${ordersTable.status} = 'pendente')`,
    })
    .from(ordersTable);

  res.json({
    compradores: { total: Number(buyerStats?.total ?? 0), pendentes: Number(buyerStats?.pending ?? 0), aprovados: Number(buyerStats?.approved ?? 0) },
    fornecedores: { total: Number(supplierStats?.total ?? 0), ativos: Number(supplierStats?.approved ?? 0) },
    pedidos: { total: Number(orderStats?.total ?? 0), gmv: Number(orderStats?.gmv ?? 0), pendentes: Number(orderStats?.pending ?? 0) },
  });
});

/* ── List all buyers ────────────────────────────────────────────────────── */
router.get("/support/buyers", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const q = req.query.q as string | undefined;
  const statusFilter = req.query.status as string | undefined;

  let query = db
    .select({
      id: usersTable.id,
      nome: usersTable.nome,
      email: usersTable.email,
      cnpj: usersTable.cnpj,
      razaoSocial: usersTable.razaoSocial,
      nomeFantasia: usersTable.nomeFantasia,
      telefone: usersTable.telefone,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
      ultimoAcesso: usersTable.ultimoAcesso,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "buyer"))
    .orderBy(desc(usersTable.createdAt))
    .$dynamic();

  if (q) {
    query = query.where(
      and(
        eq(usersTable.role, "buyer"),
        or(
          ilike(usersTable.nome, `%${q}%`),
          ilike(usersTable.email, `%${q}%`),
          ilike(usersTable.cnpj, `%${q}%`),
          ilike(usersTable.razaoSocial, `%${q}%`),
        )
      )
    );
  } else if (statusFilter && statusFilter !== "all") {
    query = query.where(and(eq(usersTable.role, "buyer"), eq(usersTable.status, statusFilter)));
  }

  const buyers = await query.limit(100);
  res.json(buyers);
});

/* ── Buyer profile ──────────────────────────────────────────────────────── */
router.get("/support/buyers/:id/profile", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const [buyer] = await db
    .select({
      id: usersTable.id,
      nome: usersTable.nome,
      email: usersTable.email,
      cnpj: usersTable.cnpj,
      razaoSocial: usersTable.razaoSocial,
      nomeFantasia: usersTable.nomeFantasia,
      telefone: usersTable.telefone,
      status: usersTable.status,
      emailVerificado: usersTable.emailVerificado,
      createdAt: usersTable.createdAt,
      ultimoAcesso: usersTable.ultimoAcesso,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "buyer")));

  if (!buyer) { res.status(404).json({ message: "Comprador não encontrado" }); return; }
  res.json(buyer);
});

/* ── Buyer orders ───────────────────────────────────────────────────────── */
router.get("/support/buyers/:id/orders", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const buyerId = parseInt(req.params.id as string, 10);

  const orders = await db
    .select({
      id: ordersTable.id,
      status: ordersTable.status,
      total: ordersTable.total,
      createdAt: ordersTable.createdAt,
      supplierId: ordersTable.supplierId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.buyerId, buyerId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(50);

  const [stats] = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${ordersTable.total}), 0)`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.buyerId, buyerId));

  res.json({ orders, total: Number(stats?.count ?? 0), totalGasto: Number(stats?.total ?? 0) });
});

export default router;
