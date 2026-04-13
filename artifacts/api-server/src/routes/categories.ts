import { Router, type IRouter } from "express";
import { db, categoriesTable, categoryMinimumRulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.ordem);
  const rules = await db.select().from(categoryMinimumRulesTable);

  const result = categories.map((cat) => ({
    ...cat,
    minimumRule: rules.find((r) => r.categoryId === cat.id) || null,
    children: categories.filter((c) => c.parentId === cat.id),
  }));

  const topLevel = result.filter((c) => !c.parentId);
  res.json(topLevel);
});

router.get("/categories/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
  if (!cat) {
    res.status(404).json({ message: "Categoria não encontrada" });
    return;
  }

  const [rule] = await db.select().from(categoryMinimumRulesTable).where(eq(categoryMinimumRulesTable.categoryId, id));
  const children = await db.select().from(categoriesTable).where(eq(categoriesTable.parentId, id));

  res.json({ ...cat, minimumRule: rule || null, children });
});

router.post("/categories", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { nome, slug, descricao, parentId, unidadeMedida, ativo, ordem } = req.body;

  if (!nome || !slug) {
    res.status(400).json({ message: "Nome e slug são obrigatórios" });
    return;
  }

  const [cat] = await db.insert(categoriesTable).values({
    nome, slug, descricao, parentId, unidadeMedida: unidadeMedida || "un",
    ativo: ativo !== false, ordem: ordem || 0,
  }).returning();

  res.status(201).json({ ...cat, minimumRule: null, children: [] });
});

router.put("/categories/:id", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { nome, slug, descricao, parentId, unidadeMedida, ativo, ordem } = req.body;

  const [cat] = await db.update(categoriesTable)
    .set({ nome, slug, descricao, parentId, unidadeMedida, ativo, ordem })
    .where(eq(categoriesTable.id, id))
    .returning();

  if (!cat) {
    res.status(404).json({ message: "Categoria não encontrada" });
    return;
  }

  const [rule] = await db.select().from(categoryMinimumRulesTable).where(eq(categoryMinimumRulesTable.categoryId, id));
  res.json({ ...cat, minimumRule: rule || null, children: [] });
});

router.delete("/categories/:id", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.json({ message: "Categoria excluída com sucesso" });
});

export default router;
