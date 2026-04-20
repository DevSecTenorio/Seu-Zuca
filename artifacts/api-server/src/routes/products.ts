import { Router, type IRouter } from "express";
import { db, productsTable, productImagesTable, categoriesTable, categoryMinimumRulesTable, usersTable, reviewsTable } from "@workspace/db";
import { eq, and, ilike, sql, asc, desc } from "drizzle-orm";
import { authMiddleware, requireSupplier, requireAdmin, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

function createSlug(nome: string, id: number): string {
  return nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + id;
}

// PUBLIC: list approved products
router.get("/products", async (req, res): Promise<void> => {
  const { search, categoryId, supplierId, available, page = "1", limit = "20", orderBy = "createdAt" } = req.query;

  const pageNum = parseInt(String(page), 10);
  const limitNum = Math.min(parseInt(String(limit), 10), 100);
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [eq(productsTable.aprovado, true)];
  if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(String(categoryId), 10)));
  if (supplierId) conditions.push(eq(productsTable.supplierId, parseInt(String(supplierId), 10)));
  if (available === "true") conditions.push(eq(productsTable.disponivel, true));

  const baseSelect = db.select({
    id: productsTable.id,
    nome: productsTable.nome,
    slug: productsTable.slug,
    descricao: productsTable.descricao,
    sku: productsTable.sku,
    preco: productsTable.preco,
    unidadeMedida: productsTable.unidadeMedida,
    estoque: productsTable.estoque,
    disponivel: productsTable.disponivel,
    aprovado: productsTable.aprovado,
    categoryId: productsTable.categoryId,
    supplierId: productsTable.supplierId,
    imagemPrincipal: productsTable.imagemPrincipal,
    prazoFrete: productsTable.prazoFrete,
    createdAt: productsTable.createdAt,
    categoryName: categoriesTable.nome,
    supplierName: usersTable.nomeFantasia,
  })
  .from(productsTable)
  .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
  .leftJoin(usersTable, eq(productsTable.supplierId, usersTable.id));

  let query;
  if (search) {
    query = baseSelect.where(and(eq(productsTable.aprovado, true), ilike(productsTable.nome, `%${search}%`)));
  } else {
    query = baseSelect.where(and(...conditions));
  }

  const orderFn = String(orderBy) === "nome" ? asc(productsTable.nome)
    : String(orderBy) === "preco" ? asc(productsTable.preco)
    : desc(productsTable.createdAt);

  const products = await (query as typeof baseSelect).limit(limitNum).offset(offset).orderBy(orderFn);

  const countBase = db.select({ count: sql<number>`count(*)` }).from(productsTable);
  const countResult = search
    ? await countBase.where(and(eq(productsTable.aprovado, true), ilike(productsTable.nome, `%${search}%`)))
    : await countBase.where(and(...conditions));
  const total = Number(countResult[0]?.count || 0);

  const productsWithMinimum = await Promise.all(products.map(async (p) => {
    const [rule] = await db.select().from(categoryMinimumRulesTable).where(eq(categoryMinimumRulesTable.categoryId, p.categoryId));
    const reviews = await db.select().from(reviewsTable).where(and(eq(reviewsTable.productId, p.id), eq(reviewsTable.aprovada, true)));
    const mediaAvaliacao = reviews.length > 0 ? reviews.reduce((acc, r) => acc + r.nota, 0) / reviews.length : 0;
    return { ...p, quantidadeMinima: rule?.quantidadeMinima || 1, mediaAvaliacao: Math.round(mediaAvaliacao * 10) / 10, totalAvaliacoes: reviews.length };
  }));

  res.json({ products: productsWithMinimum, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
});

// PUBLIC: get product detail (approved only for non-owners)
router.get("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idOrSlug = raw;

  let product = null;
  const asInt = parseInt(idOrSlug, 10);
  if (!isNaN(asInt)) {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, asInt));
    product = p;
  }
  if (!product) {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.slug, idOrSlug));
    product = p;
  }
  if (!product) {
    res.status(404).json({ message: "Produto não encontrado" });
    return;
  }

  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));
  const [supplier] = await db.select().from(usersTable).where(eq(usersTable.id, product.supplierId));
  const images = await db.select().from(productImagesTable).where(eq(productImagesTable.productId, product.id));
  const reviews = await db.select().from(reviewsTable).where(and(eq(reviewsTable.productId, product.id), eq(reviewsTable.aprovada, true)));
  const [rule] = await db.select().from(categoryMinimumRulesTable).where(eq(categoryMinimumRulesTable.categoryId, product.categoryId));
  const mediaAvaliacao = reviews.length > 0 ? reviews.reduce((acc, r) => acc + r.nota, 0) / reviews.length : 0;

  const reviewsWithBuyer = await Promise.all(reviews.map(async (r) => {
    const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, r.buyerId));
    return { ...r, buyerName: buyer?.nomeFantasia || buyer?.nome || "Comprador" };
  }));

  res.json({
    ...product,
    imagens: images.map((i) => i.url),
    category: category ? { ...category, minimumRule: rule || null } : null,
    supplier: supplier ? { id: supplier.id, nome: supplier.nome, nomeFantasia: supplier.nomeFantasia, razaoSocial: supplier.razaoSocial } : null,
    reviews: reviewsWithBuyer,
    quantidadeMinima: rule?.quantidadeMinima || 1,
    mediaAvaliacao: Math.round(mediaAvaliacao * 10) / 10,
    totalAvaliacoes: reviews.length,
    categoryName: category?.nome,
    supplierName: supplier?.nomeFantasia || supplier?.nome,
  });
});

router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const reviews = await db.select().from(reviewsTable).where(and(eq(reviewsTable.productId, id), eq(reviewsTable.aprovada, true)));

  const reviewsWithBuyer = await Promise.all(reviews.map(async (r) => {
    const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, r.buyerId));
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, r.productId));
    return { ...r, buyerName: buyer?.nome || "Comprador", productName: product?.nome };
  }));

  res.json(reviewsWithBuyer);
});

// ADMIN: list all products (including pending approval)
router.get("/admin/products", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { aprovado, page = "1" } = req.query;
  const pageNum = parseInt(String(page), 10);
  const limitNum = 20;
  const offset = (pageNum - 1) * limitNum;

  let query = db.select({
    id: productsTable.id,
    nome: productsTable.nome,
    slug: productsTable.slug,
    sku: productsTable.sku,
    preco: productsTable.preco,
    unidadeMedida: productsTable.unidadeMedida,
    estoque: productsTable.estoque,
    disponivel: productsTable.disponivel,
    aprovado: productsTable.aprovado,
    imagemPrincipal: productsTable.imagemPrincipal,
    createdAt: productsTable.createdAt,
    categoryName: categoriesTable.nome,
    supplierId: productsTable.supplierId,
    supplierName: usersTable.nomeFantasia,
  })
  .from(productsTable)
  .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
  .leftJoin(usersTable, eq(productsTable.supplierId, usersTable.id));

  if (aprovado === "false") {
    query = query.where(eq(productsTable.aprovado, false)) as typeof query;
  } else if (aprovado === "true") {
    query = query.where(eq(productsTable.aprovado, true)) as typeof query;
  }

  const products = await query.orderBy(desc(productsTable.createdAt)).limit(limitNum).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(productsTable)
    .where(aprovado === "false" ? eq(productsTable.aprovado, false) : aprovado === "true" ? eq(productsTable.aprovado, true) : sql`1=1`);

  res.json({ products, total: Number(countResult[0]?.count || 0), page: pageNum, totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limitNum) });
});

// ADMIN: approve product
router.put("/admin/products/:id/approve", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [product] = await db.update(productsTable).set({ aprovado: true }).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ message: "Produto não encontrado" }); return; }
  res.json(product);
});

// ADMIN: reject/hide product
router.put("/admin/products/:id/reject", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [product] = await db.update(productsTable).set({ aprovado: false }).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ message: "Produto não encontrado" }); return; }
  res.json(product);
});

// SUPPLIER: list own products
router.get("/supplier/products", authMiddleware, requireSupplier, async (req: AuthRequest, res): Promise<void> => {
  const products = await db.select().from(productsTable).where(eq(productsTable.supplierId, req.userId!));
  const result = await Promise.all(products.map(async (p) => {
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, p.categoryId));
    const images = await db.select().from(productImagesTable).where(eq(productImagesTable.productId, p.id));
    const [rule] = await db.select().from(categoryMinimumRulesTable).where(eq(categoryMinimumRulesTable.categoryId, p.categoryId));
    return { ...p, categoryName: category?.nome, imagens: images.map((i) => i.url), quantidadeMinima: rule?.quantidadeMinima || 1 };
  }));
  res.json(result);
});

// SUPPLIER: create product (pending approval)
router.post("/supplier/products", authMiddleware, requireSupplier, async (req: AuthRequest, res): Promise<void> => {
  const { nome, descricao, sku, preco, unidadeMedida, estoque, categoryId, imagens, prazoFrete, regioesAtendidas, alertaEstoque } = req.body;

  if (!nome || !preco || !unidadeMedida || !categoryId) {
    res.status(400).json({ message: "Campos obrigatórios: nome, preço, unidade de medida, categoria" });
    return;
  }

  const [product] = await db.insert(productsTable).values({
    nome,
    slug: "temp",
    descricao,
    sku,
    preco,
    unidadeMedida,
    estoque: estoque || 0,
    categoryId,
    supplierId: req.userId!,
    imagemPrincipal: imagens?.[0] || null,
    prazoFrete: prazoFrete || 7,
    regioesAtendidas,
    alertaEstoque: alertaEstoque || 10,
    disponivel: (estoque || 0) > 0,
    aprovado: false,
  }).returning();

  await db.update(productsTable).set({ slug: createSlug(nome, product.id) }).where(eq(productsTable.id, product.id));

  if (imagens && imagens.length > 0) {
    await db.insert(productImagesTable).values(imagens.map((url: string, i: number) => ({ productId: product.id, url, ordem: i })));
  }

  const [updated] = await db.select().from(productsTable).where(eq(productsTable.id, product.id));
  res.status(201).json({ ...updated, message: "Produto enviado para aprovação do administrador" });
});

// SUPPLIER: update product
router.put("/supplier/products/:id", authMiddleware, requireSupplier, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { nome, descricao, sku, preco, unidadeMedida, estoque, categoryId, imagens, prazoFrete, regioesAtendidas, alertaEstoque } = req.body;

  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.supplierId, req.userId!)));
  if (!product) { res.status(404).json({ message: "Produto não encontrado" }); return; }

  const [updated] = await db.update(productsTable).set({
    nome: nome || product.nome,
    descricao: descricao !== undefined ? descricao : product.descricao,
    sku: sku !== undefined ? sku : product.sku,
    preco: preco || product.preco,
    unidadeMedida: unidadeMedida || product.unidadeMedida,
    estoque: estoque !== undefined ? estoque : product.estoque,
    categoryId: categoryId || product.categoryId,
    imagemPrincipal: imagens?.[0] || product.imagemPrincipal,
    prazoFrete: prazoFrete || product.prazoFrete,
    regioesAtendidas: regioesAtendidas || product.regioesAtendidas,
    alertaEstoque: alertaEstoque !== undefined ? alertaEstoque : product.alertaEstoque,
    disponivel: (estoque !== undefined ? estoque : product.estoque) > 0,
  }).where(eq(productsTable.id, id)).returning();

  res.json(updated);
});

// SUPPLIER: delete product
router.delete("/supplier/products/:id", authMiddleware, requireSupplier, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.supplierId, req.userId!)));
  if (!product) { res.status(404).json({ message: "Produto não encontrado" }); return; }

  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ message: "Produto excluído com sucesso" });
});

export default router;
