import { Router, type IRouter } from "express";
import { db, usersTable, commissionsTable, categoryMinimumRulesTable, categoriesTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/admin/users", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { role, status, page = "1" } = req.query;
  const pageNum = parseInt(String(page), 10);
  const limit = 20;
  const offset = (pageNum - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (role) conditions.push(eq(usersTable.role, String(role)));
  if (status) conditions.push(eq(usersTable.status, String(status)));

  let query = db.select().from(usersTable);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const users = await query.orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const total = Number(countResult[0]?.count || 0);

  const sanitized = users.map((u) => ({
    id: u.id, email: u.email, nome: u.nome, role: u.role, status: u.status,
    cnpj: u.cnpj, razaoSocial: u.razaoSocial, nomeFantasia: u.nomeFantasia,
    telefone: u.telefone, ramo: u.ramo, emailVerificado: u.emailVerificado,
    stripeAccountId: u.stripeAccountId, createdAt: u.createdAt,
  }));

  res.json({ users: sanitized, total, page: pageNum, totalPages: Math.ceil(total / limit) });
});

router.post("/admin/users/:id/approve", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [user] = await db.update(usersTable).set({ status: "approved" }).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ message: "Usuário não encontrado" });
    return;
  }

  res.json({ id: user.id, email: user.email, nome: user.nome, role: user.role, status: user.status, createdAt: user.createdAt });
});

router.post("/admin/users/:id/reject", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [user] = await db.update(usersTable).set({ status: "rejected" }).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ message: "Usuário não encontrado" });
    return;
  }

  res.json({ id: user.id, email: user.email, nome: user.nome, role: user.role, status: user.status, createdAt: user.createdAt });
});

router.post("/admin/users/:id/suspend", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [user] = await db.update(usersTable).set({ status: "suspended" }).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ message: "Usuário não encontrado" });
    return;
  }

  res.json({ id: user.id, email: user.email, nome: user.nome, role: user.role, status: user.status, createdAt: user.createdAt });
});

// Category rules
router.get("/admin/category-rules", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const rules = await db.select().from(categoryMinimumRulesTable);
  const result = await Promise.all(rules.map(async (r) => {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, r.categoryId));
    return { ...r, categoryName: cat?.nome };
  }));
  res.json(result);
});

router.post("/admin/category-rules", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { categoryId, quantidadeMinima, multiplo, ativo } = req.body;

  if (!categoryId || !quantidadeMinima || !multiplo) {
    res.status(400).json({ message: "Categoria, quantidade mínima e múltiplo são obrigatórios" });
    return;
  }

  const [rule] = await db.insert(categoryMinimumRulesTable).values({
    categoryId, quantidadeMinima, multiplo, ativo: ativo !== false,
  }).returning();

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, rule.categoryId));
  res.status(201).json({ ...rule, categoryName: cat?.nome });
});

router.put("/admin/category-rules/:id", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { categoryId, quantidadeMinima, multiplo, ativo } = req.body;

  const [rule] = await db.update(categoryMinimumRulesTable)
    .set({ categoryId, quantidadeMinima, multiplo, ativo })
    .where(eq(categoryMinimumRulesTable.id, id))
    .returning();

  if (!rule) {
    res.status(404).json({ message: "Regra não encontrada" });
    return;
  }

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, rule.categoryId));
  res.json({ ...rule, categoryName: cat?.nome });
});

router.delete("/admin/category-rules/:id", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(categoryMinimumRulesTable).where(eq(categoryMinimumRulesTable.id, id));
  res.json({ message: "Regra excluída com sucesso" });
});

// Commission
router.get("/admin/commission", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const [config] = await db.select().from(commissionsTable);
  if (!config) {
    const [newConfig] = await db.insert(commissionsTable).values({ percentualGlobal: 5 }).returning();
    res.json(newConfig);
    return;
  }
  res.json(config);
});

router.put("/admin/commission", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { percentualGlobal } = req.body;

  if (percentualGlobal === undefined || percentualGlobal < 0 || percentualGlobal > 100) {
    res.status(400).json({ message: "Percentual deve ser entre 0 e 100" });
    return;
  }

  const [existing] = await db.select().from(commissionsTable);
  if (existing) {
    const [updated] = await db.update(commissionsTable).set({ percentualGlobal }).where(eq(commissionsTable.id, existing.id)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(commissionsTable).values({ percentualGlobal }).returning();
    res.json(created);
  }
});

// Reports
router.get("/admin/reports/orders", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { startDate, endDate } = req.query;

  let query = db.select().from(ordersTable);
  if (startDate) query = query.where(gte(ordersTable.createdAt, new Date(String(startDate)))) as typeof query;
  if (endDate) query = query.where(lte(ordersTable.createdAt, new Date(String(endDate)))) as typeof query;

  const orders = await query.orderBy(desc(ordersTable.createdAt));
  res.json({ data: orders, total: orders.length, periodo: { inicio: startDate, fim: endDate } });
});

export default router;
