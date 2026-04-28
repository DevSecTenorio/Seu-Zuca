import { Router, type IRouter } from "express";
import { db, unidadesMedidaTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/units", async (_req, res): Promise<void> => {
  const units = await db.select().from(unidadesMedidaTable).orderBy(unidadesMedidaTable.nome);
  res.json(units);
});

router.post("/units", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { nome, sigla, ativo } = req.body;
  if (!nome || !sigla) {
    res.status(400).json({ message: "Nome e sigla são obrigatórios" });
    return;
  }
  try {
    const [unit] = await db.insert(unidadesMedidaTable).values({
      nome, sigla: sigla.trim(), ativo: ativo !== false,
    }).returning();
    res.status(201).json(unit);
  } catch {
    res.status(409).json({ message: "Sigla já cadastrada" });
  }
});

router.put("/units/:id", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { nome, sigla, ativo } = req.body;
  try {
    const [unit] = await db.update(unidadesMedidaTable)
      .set({ nome, sigla: sigla?.trim(), ativo })
      .where(eq(unidadesMedidaTable.id, id))
      .returning();
    if (!unit) { res.status(404).json({ message: "Unidade não encontrada" }); return; }
    res.json(unit);
  } catch {
    res.status(409).json({ message: "Sigla já cadastrada" });
  }
});

router.delete("/units/:id", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(unidadesMedidaTable).where(eq(unidadesMedidaTable.id, id));
  res.json({ message: "Unidade excluída" });
});

export default router;
