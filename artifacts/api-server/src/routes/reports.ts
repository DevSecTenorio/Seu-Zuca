import { Router, type IRouter } from "express";
import { db, usersTable, ordersTable, orderItemsTable, productsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { authMiddleware, requireAdmin, requireAdminOrSupport, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

function parseDate(str: string | undefined, fallback: Date): Date {
  if (!str) return fallback;
  const d = new Date(str);
  return isNaN(d.getTime()) ? fallback : d;
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

/* ── Admin: orders report ───────────────────────────────────────────────── */
router.get("/admin/report/orders", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const from = parseDate(req.query.from as string, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(parseDate(req.query.to as string, now));

  const rows = await db.execute(sql`
    SELECT
      o.id,
      TO_CHAR(o.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
      b.nome_fantasia AS comprador,
      b.cnpj AS cnpj_comprador,
      s.nome_fantasia AS fornecedor,
      o.total,
      o.comissao,
      o.status
    FROM orders o
    JOIN users b ON o.buyer_id = b.id
    JOIN users s ON o.supplier_id = s.id
    WHERE o.created_at >= ${from.toISOString()} AND o.created_at <= ${to.toISOString()}
    ORDER BY o.created_at DESC
  `);

  const gmv = (rows.rows as Array<{ total: string }>).reduce((acc, r) => acc + parseFloat(r.total || "0"), 0);
  const comissoes = (rows.rows as Array<{ comissao: string }>).reduce((acc, r) => acc + parseFloat(r.comissao || "0"), 0);
  const ticketMedio = rows.rows.length > 0 ? gmv / rows.rows.length : 0;

  res.json({ rows: rows.rows, summary: { total: rows.rows.length, gmv, comissoes, ticketMedio } });
});

/* ── Admin: users report ────────────────────────────────────────────────── */
router.get("/admin/report/users", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const from = parseDate(req.query.from as string, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(parseDate(req.query.to as string, now));

  const rows = await db.execute(sql`
    SELECT
      u.id,
      TO_CHAR(u.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data_cadastro,
      u.nome,
      u.email,
      CASE u.role WHEN 'buyer' THEN 'Comprador' WHEN 'supplier' THEN 'Fornecedor' WHEN 'admin' THEN 'Admin' ELSE u.role END AS tipo,
      CASE u.status WHEN 'approved' THEN 'Aprovado' WHEN 'pending' THEN 'Pendente' WHEN 'rejected' THEN 'Recusado' WHEN 'suspended' THEN 'Suspenso' ELSE u.status END AS status,
      u.cnpj,
      u.nome_fantasia
    FROM users u
    WHERE u.created_at >= ${from.toISOString()} AND u.created_at <= ${to.toISOString()}
    ORDER BY u.created_at DESC
  `);

  res.json({ rows: rows.rows, summary: { total: rows.rows.length } });
});

/* ── Admin: commissions report ──────────────────────────────────────────── */
router.get("/admin/report/comissoes", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const from = parseDate(req.query.from as string, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(parseDate(req.query.to as string, now));

  const rows = await db.execute(sql`
    SELECT
      o.id AS pedido,
      TO_CHAR(o.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
      s.nome_fantasia AS fornecedor,
      o.total AS valor_pedido,
      o.comissao AS comissao_plataforma,
      ROUND((o.comissao / NULLIF(o.total,0) * 100)::numeric, 2) AS pct_comissao,
      CASE o.status
        WHEN 'pendente' THEN 'Pendente'
        WHEN 'em_separacao' THEN 'Em Separação'
        WHEN 'enviado' THEN 'Enviado'
        WHEN 'entregue' THEN 'Entregue'
        WHEN 'cancelado' THEN 'Cancelado'
        ELSE o.status
      END AS status
    FROM orders o
    JOIN users s ON o.supplier_id = s.id
    WHERE o.created_at >= ${from.toISOString()} AND o.created_at <= ${to.toISOString()}
      AND o.comissao > 0
    ORDER BY o.created_at DESC
  `);

  const totalComissoes = (rows.rows as Array<{ comissao_plataforma: string }>).reduce((acc, r) => acc + parseFloat(r.comissao_plataforma || "0"), 0);
  const gmv = (rows.rows as Array<{ valor_pedido: string }>).reduce((acc, r) => acc + parseFloat(r.valor_pedido || "0"), 0);
  const pctMedio = gmv > 0 ? ((totalComissoes / gmv) * 100).toFixed(2) : "0.00";

  res.json({ rows: rows.rows, summary: { total: rows.rows.length, totalComissoes, gmv, pctMedio } });
});

/* ── Admin: top suppliers report ────────────────────────────────────────── */
router.get("/admin/report/fornecedores", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const from = parseDate(req.query.from as string, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(parseDate(req.query.to as string, now));

  const rows = await db.execute(sql`
    SELECT
      s.nome_fantasia AS fornecedor,
      s.cnpj,
      COUNT(o.id) AS total_pedidos,
      COALESCE(SUM(o.total), 0) AS gmv,
      COALESCE(SUM(o.comissao), 0) AS comissoes_geradas,
      COALESCE(SUM(o.total) - SUM(o.comissao), 0) AS repasse_liquido,
      ROUND(AVG(r.rating)::numeric, 1) AS avaliacao_media,
      COUNT(DISTINCT o.buyer_id) AS compradores_unicos,
      SUM(CASE WHEN o.status = 'cancelado' THEN 1 ELSE 0 END) AS cancelados
    FROM users s
    LEFT JOIN orders o ON o.supplier_id = s.id
      AND o.created_at >= ${from.toISOString()} AND o.created_at <= ${to.toISOString()}
    LEFT JOIN reviews r ON r.supplier_id = s.id
    WHERE s.role = 'supplier' AND s.status = 'approved'
    GROUP BY s.id, s.nome_fantasia, s.cnpj
    ORDER BY gmv DESC
    LIMIT 50
  `);

  const totalGmv = (rows.rows as Array<{ gmv: string }>).reduce((acc, r) => acc + parseFloat(r.gmv || "0"), 0);
  const totalComissoes = (rows.rows as Array<{ comissoes_geradas: string }>).reduce((acc, r) => acc + parseFloat(r.comissoes_geradas || "0"), 0);

  res.json({ rows: rows.rows, summary: { total: rows.rows.length, totalGmv, totalComissoes } });
});

/* ── Admin: quality report ──────────────────────────────────────────────── */
router.get("/admin/report/qualidade", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const from = parseDate(req.query.from as string, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(parseDate(req.query.to as string, now));

  const rows = await db.execute(sql`
    SELECT
      s.nome_fantasia AS fornecedor,
      COUNT(o.id) AS total_pedidos,
      SUM(CASE WHEN o.status = 'cancelado' THEN 1 ELSE 0 END) AS cancelados,
      ROUND(
        (SUM(CASE WHEN o.status = 'cancelado' THEN 1 ELSE 0 END)::numeric
         / NULLIF(COUNT(o.id), 0) * 100), 1
      ) AS taxa_cancelamento,
      COUNT(DISTINCT r.id) AS total_avaliacoes,
      ROUND(AVG(r.rating)::numeric, 1) AS avaliacao_media,
      MIN(r.rating) AS pior_nota,
      MAX(r.rating) AS melhor_nota
    FROM users s
    LEFT JOIN orders o ON o.supplier_id = s.id
      AND o.created_at >= ${from.toISOString()} AND o.created_at <= ${to.toISOString()}
    LEFT JOIN reviews r ON r.supplier_id = s.id
    WHERE s.role = 'supplier' AND s.status = 'approved'
    GROUP BY s.id, s.nome_fantasia
    ORDER BY avaliacao_media ASC NULLS LAST
  `);

  const withRatings = (rows.rows as Array<{ avaliacao_media: string | null }>).filter(r => r.avaliacao_media !== null);
  const avgRating = withRatings.length
    ? (withRatings.reduce((a, r) => a + parseFloat(r.avaliacao_media!), 0) / withRatings.length).toFixed(1)
    : null;

  res.json({ rows: rows.rows, summary: { total: rows.rows.length, avgRating } });
});

/* ── Admin: categories volume report ───────────────────────────────────── */
router.get("/admin/report/categorias", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const from = parseDate(req.query.from as string, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(parseDate(req.query.to as string, now));

  const rows = await db.execute(sql`
    SELECT
      COALESCE(cat.nome, 'Sem Categoria') AS categoria,
      COUNT(DISTINCT oi.order_id) AS total_pedidos,
      SUM(oi.quantidade) AS unidades_vendidas,
      COALESCE(SUM(oi.quantidade * oi.preco_unitario), 0) AS volume_vendas,
      COUNT(DISTINCT p.id) AS produtos_vendidos
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories cat ON cat.id = p.category_id
    WHERE o.created_at >= ${from.toISOString()} AND o.created_at <= ${to.toISOString()}
      AND o.status != 'cancelado'
    GROUP BY cat.id, cat.nome
    ORDER BY volume_vendas DESC
  `);

  const totalVolume = (rows.rows as Array<{ volume_vendas: string }>).reduce((acc, r) => acc + parseFloat(r.volume_vendas || "0"), 0);
  const totalUnidades = (rows.rows as Array<{ unidades_vendidas: string }>).reduce((acc, r) => acc + parseInt(r.unidades_vendidas || "0", 10), 0);

  res.json({ rows: rows.rows, summary: { total: rows.rows.length, totalVolume, totalUnidades } });
});

/* ── Admin: buyer behavior report ──────────────────────────────────────── */
router.get("/admin/report/compradores", authMiddleware, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const from = parseDate(req.query.from as string, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(parseDate(req.query.to as string, now));

  const rows = await db.execute(sql`
    SELECT
      b.nome_fantasia AS comprador,
      b.cnpj,
      COUNT(o.id) AS total_pedidos,
      COALESCE(SUM(o.total), 0) AS valor_total,
      ROUND(AVG(o.total)::numeric, 2) AS ticket_medio,
      TO_CHAR(MAX(o.created_at) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS ultima_compra,
      COUNT(DISTINCT o.supplier_id) AS fornecedores_diferentes
    FROM users b
    JOIN orders o ON o.buyer_id = b.id
      AND o.created_at >= ${from.toISOString()} AND o.created_at <= ${to.toISOString()}
      AND o.status != 'cancelado'
    WHERE b.role = 'buyer'
    GROUP BY b.id, b.nome_fantasia, b.cnpj
    ORDER BY valor_total DESC
  `);

  const totalCompras = (rows.rows as Array<{ valor_total: string }>).reduce((acc, r) => acc + parseFloat(r.valor_total || "0"), 0);
  const totalPedidos = (rows.rows as Array<{ total_pedidos: string }>).reduce((acc, r) => acc + parseInt(r.total_pedidos || "0", 10), 0);
  const ticketMedio = rows.rows.length > 0 && totalPedidos > 0 ? totalCompras / totalPedidos : 0;

  res.json({ rows: rows.rows, summary: { total: rows.rows.length, totalCompras, totalPedidos, ticketMedio } });
});

/* ── Supplier: orders report ────────────────────────────────────────────── */
router.get("/supplier/report", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const from = parseDate(req.query.from as string, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(parseDate(req.query.to as string, now));
  const supplierId = req.userId!;

  const rows = await db.execute(sql`
    SELECT
      o.id,
      TO_CHAR(o.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
      b.nome_fantasia AS comprador,
      b.cnpj AS cnpj_comprador,
      o.total,
      o.comissao,
      (o.total - o.comissao) AS valor_liquido,
      CASE o.status
        WHEN 'pendente' THEN 'Pendente'
        WHEN 'em_separacao' THEN 'Em Separação'
        WHEN 'enviado' THEN 'Enviado'
        WHEN 'entregue' THEN 'Entregue'
        WHEN 'cancelado' THEN 'Cancelado'
        ELSE o.status
      END AS status
    FROM orders o
    JOIN users b ON o.buyer_id = b.id
    WHERE o.supplier_id = ${supplierId}
      AND o.created_at >= ${from.toISOString()} AND o.created_at <= ${to.toISOString()}
    ORDER BY o.created_at DESC
  `);

  const receita = (rows.rows as Array<{ valor_liquido: string }>).reduce((acc, r) => acc + parseFloat(r.valor_liquido || "0"), 0);
  const gmv = (rows.rows as Array<{ total: string }>).reduce((acc, r) => acc + parseFloat(r.total || "0"), 0);

  res.json({ rows: rows.rows, summary: { total: rows.rows.length, gmv, receita } });
});

/* ── Buyer: orders report ───────────────────────────────────────────────── */
router.get("/buyer/report", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const from = parseDate(req.query.from as string, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(parseDate(req.query.to as string, now));
  const buyerId = req.userId!;

  const rows = await db.execute(sql`
    SELECT
      o.id,
      TO_CHAR(o.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
      s.nome_fantasia AS fornecedor,
      o.total,
      CASE o.status
        WHEN 'pendente' THEN 'Pendente'
        WHEN 'em_separacao' THEN 'Em Separação'
        WHEN 'enviado' THEN 'Enviado'
        WHEN 'entregue' THEN 'Entregue'
        WHEN 'cancelado' THEN 'Cancelado'
        ELSE o.status
      END AS status
    FROM orders o
    JOIN users s ON o.supplier_id = s.id
    WHERE o.buyer_id = ${buyerId}
      AND o.created_at >= ${from.toISOString()} AND o.created_at <= ${to.toISOString()}
    ORDER BY o.created_at DESC
  `);

  const totalGasto = (rows.rows as Array<{ total: string }>).reduce((acc, r) => acc + parseFloat(r.total || "0"), 0);

  res.json({ rows: rows.rows, summary: { total: rows.rows.length, totalGasto } });
});

/* ── Support: platform report ───────────────────────────────────────────── */
router.get("/support/report", authMiddleware, requireAdminOrSupport, async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const from = parseDate(req.query.from as string, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(parseDate(req.query.to as string, now));
  const type = (req.query.type as string) || "orders";

  if (type === "orders") {
    const rows = await db.execute(sql`
      SELECT
        o.id,
        TO_CHAR(o.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
        b.nome_fantasia AS comprador,
        s.nome_fantasia AS fornecedor,
        o.total,
        CASE o.status
          WHEN 'pendente' THEN 'Pendente'
          WHEN 'em_separacao' THEN 'Em Separação'
          WHEN 'enviado' THEN 'Enviado'
          WHEN 'entregue' THEN 'Entregue'
          WHEN 'cancelado' THEN 'Cancelado'
          ELSE o.status
        END AS status
      FROM orders o
      JOIN users b ON o.buyer_id = b.id
      JOIN users s ON o.supplier_id = s.id
      WHERE o.created_at >= ${from.toISOString()} AND o.created_at <= ${to.toISOString()}
      ORDER BY o.created_at DESC
    `);

    const gmv = (rows.rows as Array<{ total: string }>).reduce((acc, r) => acc + parseFloat(r.total || "0"), 0);
    res.json({ rows: rows.rows, summary: { total: rows.rows.length, gmv } });
  } else {
    const rows = await db.execute(sql`
      SELECT
        u.id,
        TO_CHAR(u.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data_cadastro,
        u.nome,
        u.email,
        CASE u.role WHEN 'buyer' THEN 'Comprador' WHEN 'supplier' THEN 'Fornecedor' ELSE u.role END AS tipo,
        CASE u.status WHEN 'approved' THEN 'Aprovado' WHEN 'pending' THEN 'Pendente' WHEN 'rejected' THEN 'Recusado' WHEN 'suspended' THEN 'Suspenso' ELSE u.status END AS status,
        u.cnpj
      FROM users u
      WHERE u.created_at >= ${from.toISOString()} AND u.created_at <= ${to.toISOString()}
      ORDER BY u.created_at DESC
    `);

    res.json({ rows: rows.rows, summary: { total: rows.rows.length } });
  }
});

export default router;
