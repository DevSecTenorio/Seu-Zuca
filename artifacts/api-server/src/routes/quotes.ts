import { Router, type IRouter } from "express";
import { db, quotesTable, quoteItemsTable, quoteResponsesTable, productsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, requireApprovedBuyer, requireSupplier, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

async function buildQuoteResponse(quote: typeof quotesTable.$inferSelect) {
  const items = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, quote.id));
  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, quote.buyerId));
  const [supplier] = await db.select().from(usersTable).where(eq(usersTable.id, quote.supplierId));

  const detailedItems = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    return { ...item, productName: product?.nome || "Produto" };
  }));

  return {
    ...quote,
    buyerName: buyer?.nomeFantasia || buyer?.nome,
    supplierName: supplier?.nomeFantasia || supplier?.nome,
    items: detailedItems,
  };
}

router.get("/quotes", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const quotes = await db.select().from(quotesTable)
    .where(eq(quotesTable.buyerId, req.userId!))
    .orderBy(desc(quotesTable.createdAt));

  const result = await Promise.all(quotes.map(buildQuoteResponse));
  res.json(result);
});

router.post("/quotes", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const { supplierId, items, observacoes } = req.body;

  if (!supplierId || !items || items.length === 0) {
    res.status(400).json({ message: "Fornecedor e itens são obrigatórios" });
    return;
  }

  const [quote] = await db.insert(quotesTable).values({
    buyerId: req.userId!,
    supplierId,
    status: "pendente",
    observacoes,
  }).returning();

  await db.insert(quoteItemsTable).values(items.map((item: { productId: number; quantidade: number }) => ({
    quoteId: quote.id,
    productId: item.productId,
    quantidade: item.quantidade,
  })));

  const result = await buildQuoteResponse(quote);
  res.status(201).json(result);
});

router.get("/quotes/:id", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
  if (!quote) {
    res.status(404).json({ message: "Cotação não encontrada" });
    return;
  }

  const base = await buildQuoteResponse(quote);
  const responses = await db.select().from(quoteResponsesTable).where(eq(quoteResponsesTable.quoteId, id));

  const detailedResponses = await Promise.all(responses.map(async (r) => {
    const [supplier] = await db.select().from(usersTable).where(eq(usersTable.id, r.supplierId));
    return { ...r, supplierName: supplier?.nomeFantasia || supplier?.nome };
  }));

  res.json({ ...base, responses: detailedResponses });
});

router.post("/quotes/:id/accept", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { responseId } = req.body;

  const [quote] = await db.select().from(quotesTable).where(and(eq(quotesTable.id, id), eq(quotesTable.buyerId, req.userId!)));
  if (!quote) {
    res.status(404).json({ message: "Cotação não encontrada" });
    return;
  }

  await db.update(quoteResponsesTable).set({ status: "aceita" }).where(eq(quoteResponsesTable.id, responseId));
  await db.update(quotesTable).set({ status: "aceita" }).where(eq(quotesTable.id, id));

  res.json({ message: "Cotação aceita com sucesso" });
});

// SUPPLIER
router.get("/supplier/quotes", authMiddleware, requireSupplier, async (req: AuthRequest, res): Promise<void> => {
  const quotes = await db.select().from(quotesTable)
    .where(eq(quotesTable.supplierId, req.userId!))
    .orderBy(desc(quotesTable.createdAt));

  const result = await Promise.all(quotes.map(buildQuoteResponse));
  res.json(result);
});

router.post("/supplier/quotes/:id/respond", authMiddleware, requireSupplier, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { precoTotal, prazoEntrega, condicoes, valorFrete, validadeAte } = req.body;

  if (!precoTotal || !prazoEntrega) {
    res.status(400).json({ message: "Preço total e prazo de entrega são obrigatórios" });
    return;
  }

  const [quote] = await db.select().from(quotesTable).where(and(eq(quotesTable.id, id), eq(quotesTable.supplierId, req.userId!)));
  if (!quote) {
    res.status(404).json({ message: "Cotação não encontrada" });
    return;
  }

  const [response] = await db.insert(quoteResponsesTable).values({
    quoteId: id,
    supplierId: req.userId!,
    precoTotal,
    prazoEntrega,
    condicoes,
    valorFrete: valorFrete || 0,
    validadeAte: validadeAte ? new Date(validadeAte) : null,
    status: "pendente",
  }).returning();

  await db.update(quotesTable).set({ status: "respondida" }).where(eq(quotesTable.id, id));

  const [supplier] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  res.status(201).json({ ...response, supplierName: supplier?.nomeFantasia || supplier?.nome });
});

export default router;
