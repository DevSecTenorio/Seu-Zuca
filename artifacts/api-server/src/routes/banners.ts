import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bannersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

/* ── Public: list active banners ────────────────────────────────────── */
router.get("/banners", async (_req, res): Promise<void> => {
  const banners = await db
    .select()
    .from(bannersTable)
    .where(eq(bannersTable.ativo, true))
    .orderBy(asc(bannersTable.ordem));
  res.json(banners);
});

/* ── Admin: list ALL banners ─────────────────────────────────────────── */
router.get("/admin/banners", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const banners = await db.select().from(bannersTable).orderBy(asc(bannersTable.ordem));
  res.json(banners);
});

/* ── Admin: create banner ────────────────────────────────────────────── */
router.post("/admin/banners", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { titulo, subtitulo, destaque, tag, imagemUrl, linkUrl, corFundo, ativo, ordem } = req.body;
  if (!titulo) { res.status(400).json({ message: "Título é obrigatório" }); return; }

  const maxOrdem = await db.select().from(bannersTable).orderBy(asc(bannersTable.ordem));
  const nextOrdem = ordem ?? (maxOrdem.length > 0 ? maxOrdem[maxOrdem.length - 1].ordem + 1 : 1);

  const [banner] = await db.insert(bannersTable).values({
    titulo,
    subtitulo: subtitulo || null,
    destaque: destaque || null,
    tag: tag || null,
    imagemUrl: imagemUrl || null,
    linkUrl: linkUrl || null,
    corFundo: corFundo || "from-[#C0181A] to-[#E85D00]",
    ativo: ativo !== undefined ? ativo : true,
    ordem: nextOrdem,
  }).returning();

  res.status(201).json(banner);
});

/* ── Admin: update banner ────────────────────────────────────────────── */
router.put("/admin/banners/:id", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { titulo, subtitulo, destaque, tag, imagemUrl, linkUrl, corFundo, ativo, ordem } = req.body;

  if (!titulo) { res.status(400).json({ message: "Título é obrigatório" }); return; }

  const [updated] = await db.update(bannersTable).set({
    titulo,
    subtitulo: subtitulo || null,
    destaque: destaque || null,
    tag: tag || null,
    imagemUrl: imagemUrl || null,
    linkUrl: linkUrl || null,
    corFundo: corFundo || "from-[#C0181A] to-[#E85D00]",
    ativo: ativo !== undefined ? ativo : true,
    ordem: ordem ?? 0,
    updatedAt: new Date(),
  }).where(eq(bannersTable.id, id)).returning();

  if (!updated) { res.status(404).json({ message: "Banner não encontrado" }); return; }
  res.json(updated);
});

/* ── Admin: toggle ativo ─────────────────────────────────────────────── */
router.patch("/admin/banners/:id/toggle", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const current = await db.select().from(bannersTable).where(eq(bannersTable.id, id));
  if (!current[0]) { res.status(404).json({ message: "Banner não encontrado" }); return; }

  const [updated] = await db.update(bannersTable).set({
    ativo: !current[0].ativo,
    updatedAt: new Date(),
  }).where(eq(bannersTable.id, id)).returning();

  res.json(updated);
});

/* ── Admin: reorder banners ──────────────────────────────────────────── */
router.patch("/admin/banners/reorder", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ message: "ids é obrigatório" }); return; }
  await Promise.all(ids.map((id, index) =>
    db.update(bannersTable).set({ ordem: index + 1 }).where(eq(bannersTable.id, id))
  ));
  res.json({ ok: true });
});

router.delete("/admin/banners/:id", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(bannersTable).where(eq(bannersTable.id, id));
  res.json({ success: true });
});

export default router;
