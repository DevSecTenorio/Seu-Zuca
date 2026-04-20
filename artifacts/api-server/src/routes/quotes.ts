import { Router, type IRouter } from "express";
import { db, quotesTable, quoteItemsTable, quoteResponsesTable, productsTable, usersTable } from "@workspace/db";
import { eq, and, desc, isNull, or } from "drizzle-orm";
import { authMiddleware, requireApprovedBuyer, requireSupplier, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

async function buildQuoteResponse(quote: typeof quotesTable.$inferSelect) {
  const items = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, quote.id));
  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, quote.buyerId));

  let supplierName: string | null = null;
  if (quote.supplierId) {
    const [supplier] = await db.select().from(usersTable).where(eq(usersTable.id, quote.supplierId));
    supplierName = supplier?.nomeFantasia || supplier?.nome || null;
  }

  const detailedItems = await Promise.all(items.map(async (item) => {
    let productName: string | undefined;
    if (item.productId) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      productName = product?.nome;
    }
    return {
      ...item,
      productName: productName || item.produtoDescricao || "Item",
    };
  }));

  return {
    ...quote,
    buyerName: buyer?.nomeFantasia || buyer?.nome,
    supplierName,
    items: detailedItems,
    totalRespostas: undefined as number | undefined,
  };
}

// BUYER: list own quotes
router.get("/quotes", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const quotes = await db.select().from(quotesTable)
    .where(eq(quotesTable.buyerId, req.userId!))
    .orderBy(desc(quotesTable.createdAt));

  const result = await Promise.all(quotes.map(async (q) => {
    const responses = await db.select().from(quoteResponsesTable).where(eq(quoteResponsesTable.quoteId, q.id));
    const base = await buildQuoteResponse(q);
    return { ...base, totalRespostas: responses.length };
  }));
  res.json(result);
});

// BUYER: create quote (freeform OR structured with supplierId+productIds)
router.post("/quotes", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const { supplierId, items, observacoes, titulo, descricao, dataExpiracao } = req.body;

  if (!items || items.length === 0) {
    res.status(400).json({ message: "Pelo menos um item é obrigatório" });
    return;
  }

  const [quote] = await db.insert(quotesTable).values({
    buyerId: req.userId!,
    supplierId: supplierId || null,
    titulo: titulo || null,
    descricao: descricao || null,
    status: "pendente",
    observacoes: observacoes || null,
    dataExpiracao: dataExpiracao ? new Date(dataExpiracao) : null,
  }).returning();

  await db.insert(quoteItemsTable).values(items.map((item: {
    productId?: number;
    produtoDescricao?: string;
    quantidade: number;
    unidadeMedida?: string;
  }) => ({
    quoteId: quote.id,
    productId: item.productId || null,
    produtoDescricao: item.produtoDescricao || null,
    quantidade: item.quantidade,
    unidadeMedida: item.unidadeMedida || null,
  })));

  const result = await buildQuoteResponse(quote);
  res.status(201).json(result);
});

// BUYER / SUPPLIER / ADMIN: get quote detail with responses
router.get("/quotes/:id", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
  if (!quote) {
    res.status(404).json({ message: "Cotação não encontrada" });
    return;
  }

  // Access control: buyer, targeted supplier, or admin
  if (
    quote.buyerId !== req.userId &&
    quote.supplierId !== req.userId &&
    req.userRole !== "admin" &&
    req.userRole !== "supplier"
  ) {
    res.status(403).json({ message: "Acesso negado" });
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

// BUYER: accept a quote response
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

// SUPPLIER: list incoming quotes (targeted + general broadcast quotes)
router.get("/supplier/quotes", authMiddleware, requireSupplier, async (req: AuthRequest, res): Promise<void> => {
  const quotes = await db.select().from(quotesTable)
    .where(
      or(
        eq(quotesTable.supplierId, req.userId!),
        isNull(quotesTable.supplierId)
      )
    )
    .orderBy(desc(quotesTable.createdAt));

  const result = await Promise.all(quotes.map(buildQuoteResponse));
  res.json(result);
});

// SUPPLIER: respond to a quote
router.post("/supplier/quotes/:id/respond", authMiddleware, requireSupplier, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { precoTotal, prazoEntrega, condicoes, valorFrete, validadeAte } = req.body;

  if (!precoTotal || !prazoEntrega) {
    res.status(400).json({ message: "Preço total e prazo de entrega são obrigatórios" });
    return;
  }

  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
  if (!quote) {
    res.status(404).json({ message: "Cotação não encontrada" });
    return;
  }

  // Check access: targeted at this supplier OR open (supplierId = null)
  if (quote.supplierId !== null && quote.supplierId !== req.userId) {
    res.status(403).json({ message: "Acesso negado" });
    return;
  }

  const [response] = await db.insert(quoteResponsesTable).values({
    quoteId: id,
    supplierId: req.userId!,
    precoTotal: Number(precoTotal),
    prazoEntrega: String(prazoEntrega),
    condicoes: condicoes || null,
    valorFrete: valorFrete ? Number(valorFrete) : 0,
    validadeAte: validadeAte ? new Date(validadeAte) : null,
    status: "pendente",
  }).returning();

  await db.update(quotesTable).set({ status: "respondida" }).where(eq(quotesTable.id, id));

  const [supplier] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  res.status(201).json({ ...response, supplierName: supplier?.nomeFantasia || supplier?.nome });
});

export default router;
