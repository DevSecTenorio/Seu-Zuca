import { Router, type IRouter } from "express";
import { db, usersTable, commissionsTable, categoryMinimumRulesTable, categoriesTable, ordersTable, orderItemsTable, productsTable, reviewsTable } from "@workspace/db";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { authMiddleware, requireAdmin, requireAdminOrSupport, type AuthRequest } from "../middlewares/auth";
import bcrypt from "bcryptjs";
import { sendEmail, buildApprovalEmailHtml, buildRejectionEmailHtml } from "../lib/email";
import { writeAuditLog, getClientIp } from "../lib/auditLog";

function validateCnpj(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  const calcDigit = (digits: string, weights: number[]) => {
    const sum = digits.split("").reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const d1 = calcDigit(cleaned.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(cleaned.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return parseInt(cleaned[12]) === d1 && parseInt(cleaned[13]) === d2;
}

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
    comissao: u.comissao,
    documentos: u.documentos ? JSON.parse(u.documentos) : [],
  }));

  res.json({ users: sanitized, total, page: pageNum, totalPages: Math.ceil(total / limit) });
});

const OWNER_EMAIL = "admin@seuzuca.com.br";

router.post("/admin/users/:id/approve", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [user] = await db.update(usersTable).set({ status: "approved" }).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ message: "Usuário não encontrado" });
    return;
  }

  await sendEmail({
    to: user.email,
    subject: "Cadastro aprovado — Seu Zuca",
    html: buildApprovalEmailHtml(user.nome || user.email, user.role || "buyer"),
  }).catch(() => {});

  void writeAuditLog({ actorId: req.userId, action: "user.approve", targetId: user.id, targetType: "user", details: { email: user.email, role: user.role }, ip: getClientIp(req) });

  res.json({ id: user.id, email: user.email, nome: user.nome, role: user.role, status: user.status, createdAt: user.createdAt });
});

router.post("/admin/users/:id/reject", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { motivo } = req.body as { motivo?: string };

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (target?.email === OWNER_EMAIL) {
    res.status(403).json({ message: "O administrador principal não pode ser modificado" });
    return;
  }

  const [user] = await db.update(usersTable).set({ status: "rejected" }).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ message: "Usuário não encontrado" });
    return;
  }

  await sendEmail({
    to: user.email,
    subject: "Atualização sobre seu cadastro — Seu Zuca",
    html: buildRejectionEmailHtml(user.nome || user.email, motivo),
  }).catch(() => {});

  void writeAuditLog({ actorId: req.userId, action: "user.reject", targetId: user.id, targetType: "user", details: { email: user.email, motivo }, ip: getClientIp(req) });

  res.json({ id: user.id, email: user.email, nome: user.nome, role: user.role, status: user.status, createdAt: user.createdAt });
});

router.post("/admin/users/:id/suspend", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (target?.email === OWNER_EMAIL) {
    res.status(403).json({ message: "O administrador principal não pode ser suspenso" });
    return;
  }

  const [user] = await db.update(usersTable).set({ status: "suspended" }).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ message: "Usuário não encontrado" });
    return;
  }

  void writeAuditLog({ actorId: req.userId, action: "user.suspend", targetId: user.id, targetType: "user", details: { email: user.email }, ip: getClientIp(req) });

  res.json({ id: user.id, email: user.email, nome: user.nome, role: user.role, status: user.status, createdAt: user.createdAt });
});

// Admin create supplier
router.post("/admin/create-supplier", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { email, password, nome, razaoSocial, nomeFantasia, cnpj, telefone, ramo } = req.body;

  if (!email || !password || !nome || !cnpj) {
    res.status(400).json({ message: "Campos obrigatórios: email, senha, nome, CNPJ" });
    return;
  }

  if (!validateCnpj(cnpj)) {
    res.status(400).json({ message: "CNPJ inválido" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ message: "E-mail já cadastrado" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    nome,
    role: "supplier",
    status: "approved",
    cnpj: cnpj.replace(/\D/g, ""),
    razaoSocial: razaoSocial || nome,
    nomeFantasia: nomeFantasia || nome,
    telefone,
    ramo,
    emailVerificado: true,
  }).returning();

  void writeAuditLog({ actorId: req.userId, action: "user.create_internal", targetId: user.id, targetType: "user", details: { email: user.email, role: "supplier" }, ip: getClientIp(req) });

  res.status(201).json({
    id: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role,
    status: user.status,
    cnpj: user.cnpj,
    razaoSocial: user.razaoSocial,
    nomeFantasia: user.nomeFantasia,
    createdAt: user.createdAt,
  });
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
  let result;
  if (existing) {
    const [updated] = await db.update(commissionsTable).set({ percentualGlobal }).where(eq(commissionsTable.id, existing.id)).returning();
    result = updated;
  } else {
    const [created] = await db.insert(commissionsTable).values({ percentualGlobal }).returning();
    result = created;
  }

  void writeAuditLog({ actorId: req.userId, action: "commission.update_global", details: { percentualGlobal }, ip: getClientIp(req) });

  res.json(result);
});

// ── Create internal user (admin or support) ──────────────────────────────────
router.post("/admin/create-internal-user", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { nome, email, password, role, departamento } = req.body;

  if (!nome || !email || !password || !role) {
    res.status(400).json({ message: "Nome, email, senha e papel são obrigatórios" });
    return;
  }
  if (!["admin", "support"].includes(role)) {
    res.status(400).json({ message: "Papel deve ser 'admin' ou 'support'" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ message: "Senha deve ter pelo menos 8 caracteres" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (existing.length > 0) {
    res.status(409).json({ message: "E-mail já cadastrado" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    nome,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    status: "approved",
    emailVerificado: true,
    ramo: departamento || null,
  }).returning();

  void writeAuditLog({ actorId: req.userId, action: "user.create_internal", targetId: user.id, targetType: "user", details: { email: user.email, role }, ip: getClientIp(req) });

  res.status(201).json({
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  });
});

// ── Support: list users for support with admin or support role ─────────────
router.get("/admin/internal-users", authMiddleware, requireAdminOrSupport, async (_req: AuthRequest, res): Promise<void> => {
  const selectFields = {
    id: usersTable.id,
    nome: usersTable.nome,
    email: usersTable.email,
    role: usersTable.role,
    status: usersTable.status,
    ramo: usersTable.ramo,
    createdAt: usersTable.createdAt,
    ultimoAcesso: usersTable.ultimoAcesso,
  };

  const users = await db
    .select(selectFields)
    .from(usersTable)
    .where(and(eq(usersTable.role, "admin"), eq(usersTable.status, "approved")));

  const supportUsers = await db
    .select(selectFields)
    .from(usersTable)
    .where(eq(usersTable.role, "support"));

  res.json([...users, ...supportUsers].sort((a, b) => a.nome.localeCompare(b.nome)));
});

// ── Internal user: edit ───────────────────────────────────────────────────────
router.put("/admin/internal-users/:id", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { nome, email, role, departamento, password } = req.body as {
    nome?: string; email?: string; role?: string; departamento?: string; password?: string;
  };

  if (!nome && !email && !role && !departamento && !password) {
    res.status(400).json({ message: "Nenhum campo para atualizar" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target || (target.role !== "admin" && target.role !== "support")) {
    res.status(404).json({ message: "Usuário interno não encontrado" });
    return;
  }

  if (role && role !== "admin" && role !== "support") {
    res.status(400).json({ message: "Papel inválido. Use 'admin' ou 'support'" });
    return;
  }

  if (email && email !== target.email) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing) { res.status(409).json({ message: "E-mail já cadastrado por outro usuário" }); return; }
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (nome) updates.nome = nome;
  if (email) updates.email = email;
  if (role) updates.role = role;
  if (departamento !== undefined) updates.ramo = departamento;
  if (password) {
    if (password.length < 8) { res.status(400).json({ message: "Senha deve ter pelo menos 8 caracteres" }); return; }
    updates.passwordHash = await bcrypt.hash(password, 12);
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning({
    id: usersTable.id, nome: usersTable.nome, email: usersTable.email,
    role: usersTable.role, status: usersTable.status, ramo: usersTable.ramo, createdAt: usersTable.createdAt,
  });

  res.json(updated);
});

// ── Internal user: delete ─────────────────────────────────────────────────────
router.delete("/admin/internal-users/:id", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);

  if (req.userId === id) {
    res.status(400).json({ message: "Você não pode excluir sua própria conta" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target || (target.role !== "admin" && target.role !== "support")) {
    res.status(404).json({ message: "Usuário interno não encontrado" });
    return;
  }

  if (target.email === OWNER_EMAIL) {
    res.status(403).json({ message: "O administrador principal não pode ser excluído" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ message: "Usuário excluído com sucesso" });
});

// ── Reset user password (buyer / supplier) ────────────────────────────────────
router.patch("/admin/users/:id/reset-password", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { password, mustChangePassword } = req.body as { password?: string; mustChangePassword?: boolean };

  if (!password) { res.status(400).json({ message: "Senha é obrigatória" }); return; }
  if (password.length < 8) { res.status(400).json({ message: "Senha deve ter pelo menos 8 caracteres" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ message: "Usuário não encontrado" }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(usersTable).set({ passwordHash, mustChangePassword: mustChangePassword ?? false }).where(eq(usersTable.id, id));

  res.json({ message: "Senha redefinida com sucesso" });
});

// ── Per-supplier commission ───────────────────────────────────────────────────
router.put("/admin/users/:id/commission", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { comissao } = req.body;

  if (comissao === undefined || comissao < 0 || comissao > 100) {
    res.status(400).json({ message: "Comissão deve ser entre 0 e 100" }); return;
  }
  const [user] = await db.update(usersTable).set({ comissao: Number(comissao) }).where(and(eq(usersTable.id, id), eq(usersTable.role, "supplier"))).returning();
  if (!user) { res.status(404).json({ message: "Fornecedor não encontrado" }); return; }
  res.json({ id: user.id, nome: user.nome, comissao: user.comissao });
});

// ── Per-product commission ────────────────────────────────────────────────────
router.put("/admin/products/:id/commission", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { comissao } = req.body;

  if (comissao === undefined || comissao < 0 || comissao > 100) {
    res.status(400).json({ message: "Comissão deve ser entre 0 e 100" }); return;
  }
  const [product] = await db.update(productsTable).set({ comissao: Number(comissao) }).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ message: "Produto não encontrado" }); return; }
  res.json({ id: product.id, nome: product.nome, comissao: product.comissao });
});

// ── Review moderation ─────────────────────────────────────────────────────────
router.get("/admin/reviews", authMiddleware, requireAdmin, async (_req: AuthRequest, res): Promise<void> => {
  const reviews = await db.select().from(reviewsTable).orderBy(desc(reviewsTable.createdAt));
  const result = await Promise.all(reviews.map(async (r) => {
    const [buyer] = await db.select({ nome: usersTable.nome }).from(usersTable).where(eq(usersTable.id, r.buyerId));
    const [product] = await db.select({ nome: productsTable.nome, imagemPrincipal: productsTable.imagemPrincipal }).from(productsTable).where(eq(productsTable.id, r.productId));
    return { ...r, buyerName: buyer?.nome, productName: product?.nome, productImage: product?.imagemPrincipal };
  }));
  res.json(result);
});

router.put("/admin/reviews/:id/approve", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [review] = await db.update(reviewsTable).set({ aprovada: true }).where(eq(reviewsTable.id, id)).returning();
  if (!review) { res.status(404).json({ message: "Avaliação não encontrada" }); return; }
  res.json(review);
});

router.put("/admin/reviews/:id/reject", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [review] = await db.update(reviewsTable).set({ aprovada: false }).where(eq(reviewsTable.id, id)).returning();
  if (!review) { res.status(404).json({ message: "Avaliação não encontrada" }); return; }
  res.json(review);
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
