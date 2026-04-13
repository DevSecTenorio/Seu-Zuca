import { Router, type IRouter } from "express";
import { db, addressesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/addresses", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const addresses = await db.select().from(addressesTable).where(eq(addressesTable.userId, req.userId!));
  res.json(addresses);
});

router.post("/addresses", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { nome, cep, logradouro, numero, complemento, bairro, cidade, estado, principal } = req.body;

  if (!cep || !logradouro || !numero || !cidade || !estado) {
    res.status(400).json({ message: "CEP, logradouro, número, cidade e estado são obrigatórios" });
    return;
  }

  if (principal) {
    await db.update(addressesTable).set({ principal: false }).where(eq(addressesTable.userId, req.userId!));
  }

  const [address] = await db.insert(addressesTable).values({
    userId: req.userId!,
    nome,
    cep: cep.replace(/\D/g, ""),
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    principal: principal || false,
  }).returning();

  res.status(201).json(address);
});

router.put("/addresses/:id", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { nome, cep, logradouro, numero, complemento, bairro, cidade, estado, principal } = req.body;

  const [existing] = await db.select().from(addressesTable).where(and(eq(addressesTable.id, id), eq(addressesTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ message: "Endereço não encontrado" });
    return;
  }

  if (principal) {
    await db.update(addressesTable).set({ principal: false }).where(eq(addressesTable.userId, req.userId!));
  }

  const [updated] = await db.update(addressesTable).set({
    nome: nome !== undefined ? nome : existing.nome,
    cep: cep ? cep.replace(/\D/g, "") : existing.cep,
    logradouro: logradouro || existing.logradouro,
    numero: numero || existing.numero,
    complemento: complemento !== undefined ? complemento : existing.complemento,
    bairro: bairro !== undefined ? bairro : existing.bairro,
    cidade: cidade || existing.cidade,
    estado: estado || existing.estado,
    principal: principal !== undefined ? principal : existing.principal,
  }).where(eq(addressesTable.id, id)).returning();

  res.json(updated);
});

router.delete("/addresses/:id", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(addressesTable).where(and(eq(addressesTable.id, id), eq(addressesTable.userId, req.userId!)));
  res.json({ message: "Endereço excluído com sucesso" });
});

export default router;
