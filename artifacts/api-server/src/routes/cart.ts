import { Router, type IRouter } from "express";
import { db, cartItemsTable, productsTable, categoriesTable, categoryMinimumRulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireApprovedBuyer, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

async function buildCart(userId: number) {
  const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.userId, userId));

  let total = 0;
  let valido = true;
  const erros: string[] = [];

  const detailedItems = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (!product) return null;

    const [rule] = await db.select().from(categoryMinimumRulesTable).where(eq(categoryMinimumRulesTable.categoryId, product.categoryId));
    const quantidadeMinima = rule?.quantidadeMinima || 1;
    const multiplo = rule?.multiplo || 1;

    const itemValido = item.quantidade >= quantidadeMinima && item.quantidade % multiplo === 0;
    let mensagemErro = "";

    if (item.quantidade < quantidadeMinima) {
      valido = false;
      mensagemErro = `Este produto exige no mínimo ${quantidadeMinima} unidades nesta categoria`;
      erros.push(`${product.nome}: ${mensagemErro}`);
    } else if (item.quantidade % multiplo !== 0) {
      valido = false;
      mensagemErro = `A quantidade deve ser múltiplo de ${multiplo}`;
      erros.push(`${product.nome}: ${mensagemErro}`);
    }

    const subtotal = product.preco * item.quantidade;
    total += subtotal;

    return {
      id: item.id,
      productId: item.productId,
      product: {
        id: product.id,
        nome: product.nome,
        slug: product.slug,
        preco: product.preco,
        unidadeMedida: product.unidadeMedida,
        imagemPrincipal: product.imagemPrincipal,
        disponivel: product.disponivel,
        categoryId: product.categoryId,
        supplierId: product.supplierId,
        descricao: product.descricao,
        sku: product.sku,
        estoque: product.estoque,
        prazoFrete: product.prazoFrete,
      },
      quantidade: item.quantidade,
      precoUnitario: product.preco,
      subtotal,
      quantidadeMinima,
      valido: itemValido,
      mensagemErro,
    };
  }));

  return {
    items: detailedItems.filter(Boolean),
    total: Math.round(total * 100) / 100,
    valido,
    erros,
  };
}

router.get("/cart", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const cart = await buildCart(req.userId!);
  res.json(cart);
});

router.delete("/cart", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, req.userId!));
  res.json({ message: "Carrinho limpo com sucesso" });
});

router.post("/cart/items", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const { productId, quantidade } = req.body;

  if (!productId || !quantidade || quantidade <= 0) {
    res.status(400).json({ message: "Produto e quantidade são obrigatórios" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product || !product.disponivel) {
    res.status(400).json({ message: "Produto não disponível" });
    return;
  }

  const [rule] = await db.select().from(categoryMinimumRulesTable).where(eq(categoryMinimumRulesTable.categoryId, product.categoryId));
  const quantidadeMinima = rule?.quantidadeMinima || 1;

  if (quantidade < quantidadeMinima) {
    res.status(400).json({ message: `Este produto exige no mínimo ${quantidadeMinima} unidades nesta categoria` });
    return;
  }

  const [existing] = await db.select().from(cartItemsTable).where(
    and(eq(cartItemsTable.userId, req.userId!), eq(cartItemsTable.productId, productId))
  );

  if (existing) {
    await db.update(cartItemsTable).set({ quantidade: existing.quantidade + quantidade }).where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({ userId: req.userId!, productId, quantidade });
  }

  const cart = await buildCart(req.userId!);
  res.json(cart);
});

router.put("/cart/items/:productId", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  const { quantidade } = req.body;

  if (!quantidade || quantidade <= 0) {
    res.status(400).json({ message: "Quantidade deve ser maior que zero" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ message: "Produto não encontrado" });
    return;
  }

  const [rule] = await db.select().from(categoryMinimumRulesTable).where(eq(categoryMinimumRulesTable.categoryId, product.categoryId));
  const quantidadeMinima = rule?.quantidadeMinima || 1;

  if (quantidade < quantidadeMinima) {
    res.status(400).json({ message: `Este produto exige no mínimo ${quantidadeMinima} unidades nesta categoria` });
    return;
  }

  await db.update(cartItemsTable).set({ quantidade }).where(
    and(eq(cartItemsTable.userId, req.userId!), eq(cartItemsTable.productId, productId))
  );

  const cart = await buildCart(req.userId!);
  res.json(cart);
});

router.delete("/cart/items/:productId", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);

  await db.delete(cartItemsTable).where(
    and(eq(cartItemsTable.userId, req.userId!), eq(cartItemsTable.productId, productId))
  );

  const cart = await buildCart(req.userId!);
  res.json(cart);
});

export default router;
