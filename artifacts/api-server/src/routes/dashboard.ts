import { Router, type IRouter } from "express";
import { db, ordersTable, usersTable, productsTable, orderItemsTable } from "@workspace/db";
import { eq, sql, and, desc } from "drizzle-orm";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/stats", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const [gmvResult] = await db.select({ total: sql<number>`coalesce(sum(total), 0)` }).from(ordersTable);
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable);
  const [commissionResult] = await db.select({ total: sql<number>`coalesce(sum(comissao), 0)` }).from(ordersTable);

  const totalPedidos = Number(countResult?.count || 0);
  const gmvTotal = Number(gmvResult?.total || 0);
  const ticketMedio = totalPedidos > 0 ? gmvTotal / totalPedidos : 0;

  const fornecedores = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(and(eq(usersTable.role, "supplier"), eq(usersTable.status, "approved")));
  const compradores = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(and(eq(usersTable.role, "buyer"), eq(usersTable.status, "approved")));
  const pendentes = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "pendente"));

  res.json({
    gmvTotal: Math.round(gmvTotal * 100) / 100,
    totalPedidos,
    ticketMedio: Math.round(ticketMedio * 100) / 100,
    fornecedoresAtivos: Number(fornecedores[0]?.count || 0),
    compradoresAprovados: Number(compradores[0]?.count || 0),
    pedidosPendentes: Number(pendentes[0]?.count || 0),
    comissoesTotais: Math.round(Number(commissionResult?.total || 0) * 100) / 100,
  });
});

router.get("/dashboard/sales-chart", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') as mes,
      COALESCE(SUM(total), 0) as vendas,
      COUNT(*) as pedidos,
      COALESCE(SUM(comissao), 0) as comissoes
    FROM orders
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY mes DESC
    LIMIT 12
  `);

  const rows = (result.rows as Array<{ mes: string; vendas: string; pedidos: string; comissoes: string }>).reverse();

  res.json(rows.map((r) => ({
    mes: r.mes,
    vendas: parseFloat(r.vendas),
    pedidos: parseInt(r.pedidos),
    comissoes: parseFloat(r.comissoes),
  })));
});

router.get("/dashboard/recent-orders", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(10);
  const result = await Promise.all(orders.map(async (order) => {
    const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, order.buyerId));
    const [supplier] = await db.select().from(usersTable).where(eq(usersTable.id, order.supplierId));
    return {
      ...order,
      buyerName: buyer?.nomeFantasia || buyer?.nome,
      supplierName: supplier?.nomeFantasia || supplier?.nome,
      items: [],
    };
  }));
  res.json(result);
});

router.get("/dashboard/top-products", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      p.id as product_id,
      p.nome as product_name,
      c.nome as category_name,
      COALESCE(SUM(oi.quantidade), 0) as total_vendido,
      COALESCE(SUM(oi.subtotal), 0) as receita
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN categories c ON c.id = p.category_id
    GROUP BY p.id, p.nome, c.nome
    ORDER BY total_vendido DESC
    LIMIT 10
  `);

  const rows = result.rows as Array<{ product_id: number; product_name: string; category_name: string; total_vendido: string; receita: string }>;
  res.json(rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    categoryName: r.category_name,
    totalVendido: parseInt(String(r.total_vendido)),
    receita: parseFloat(String(r.receita)),
  })));
});

// Supplier stats
router.get("/supplier/stats", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const [pedidosResult] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.supplierId, req.userId!));
  const [pendenteResult] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(and(eq(ordersTable.supplierId, req.userId!), eq(ordersTable.status, "pendente")));
  const [receitaResult] = await db.select({ total: sql<number>`coalesce(sum(total), 0)` }).from(ordersTable).where(eq(ordersTable.supplierId, req.userId!));
  const [comissaoResult] = await db.select({ total: sql<number>`coalesce(sum(comissao), 0)` }).from(ordersTable).where(eq(ordersTable.supplierId, req.userId!));
  const [produtosResult] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(and(eq(productsTable.supplierId, req.userId!), eq(productsTable.disponivel, true)));

  res.json({
    totalPedidos: Number(pedidosResult?.count || 0),
    pedidosPendentes: Number(pendenteResult?.count || 0),
    receitaTotal: Math.round(Number(receitaResult?.total || 0) * 100) / 100,
    comissaoDescontada: Math.round(Number(comissaoResult?.total || 0) * 100) / 100,
    produtosAtivos: Number(produtosResult?.count || 0),
    avaliacaoMedia: 4.5,
  });
});

// Supplier detailed analytics (last 6 months)
router.get("/supplier/analytics", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const supplierId = req.userId!;

  const receitaMensal = await db.execute(sql`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') AS mes,
      TO_CHAR(created_at, 'Mon') AS mes_curto,
      COALESCE(SUM(total), 0) AS receita,
      COUNT(*) AS pedidos
    FROM orders
    WHERE supplier_id = ${supplierId}
      AND created_at >= NOW() - INTERVAL '6 months'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM'), TO_CHAR(created_at, 'Mon')
    ORDER BY mes ASC
  `);

  const topProdutos = await db.execute(sql`
    SELECT
      p.id,
      p.nome,
      p.imagem_principal AS "imagemPrincipal",
      COALESCE(SUM(oi.quantidade), 0) AS total_vendido,
      COALESCE(SUM(oi.quantidade * oi.preco_unitario), 0) AS receita
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    WHERE p.supplier_id = ${supplierId}
    GROUP BY p.id, p.nome, p.imagem_principal
    ORDER BY total_vendido DESC
    LIMIT 5
  `);

  res.json({
    receitaMensal: receitaMensal.rows.map((r: Record<string, unknown>) => ({
      mes: r.mes_curto,
      mesCompleto: r.mes,
      receita: parseFloat(String(r.receita)),
      pedidos: parseInt(String(r.pedidos)),
    })),
    topProdutos: topProdutos.rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      nome: r.nome,
      imagemPrincipal: r.imagemPrincipal,
      totalVendido: parseInt(String(r.total_vendido)),
      receita: parseFloat(String(r.receita)),
    })),
  });
});

// Public supplier profile
router.get("/suppliers/:id/public", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [supplier] = await db.select({
    id: usersTable.id,
    nome: usersTable.nome,
    nomeFantasia: usersTable.nomeFantasia,
    razaoSocial: usersTable.razaoSocial,
    ramo: usersTable.ramo,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.role, "supplier"), eq(usersTable.status, "approved")));

  if (!supplier) { res.status(404).json({ message: "Fornecedor não encontrado" }); return; }

  const products = await db.select({
    id: productsTable.id,
    nome: productsTable.nome,
    slug: productsTable.slug,
    preco: productsTable.preco,
    unidadeMedida: productsTable.unidadeMedida,
    imagemPrincipal: productsTable.imagemPrincipal,
    disponivel: productsTable.disponivel,
  }).from(productsTable).where(and(eq(productsTable.supplierId, id), eq(productsTable.aprovado, true), eq(productsTable.disponivel, true)));

  const reviewStatsResult = await db.execute(sql`
    SELECT COUNT(*) AS total, COALESCE(AVG(nota), 0) AS media
    FROM reviews WHERE supplier_id = ${id} AND aprovada = true
  `);

  const stats = (reviewStatsResult.rows[0] || {}) as Record<string, unknown>;

  res.json({
    ...supplier,
    totalProdutos: products.length,
    mediaAvaliacao: Math.round(parseFloat(String(stats?.media || 0)) * 10) / 10,
    totalAvaliacoes: parseInt(String(stats?.total || 0)),
    products: products.slice(0, 12),
  });
});

// CEP
router.get("/cep/:cep", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.cep) ? req.params.cep[0] : req.params.cep;
  const cep = raw.replace(/\D/g, "");

  if (cep.length !== 8) {
    res.status(400).json({ message: "CEP inválido" });
    return;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json() as Record<string, unknown>;

    if ("erro" in data) {
      res.status(404).json({ message: "CEP não encontrado" });
      return;
    }

    res.json({
      cep: data.cep,
      logradouro: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      estado: data.uf,
      ibge: data.ibge,
    });
  } catch {
    res.status(500).json({ message: "Erro ao consultar CEP" });
  }
});

export default router;
