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

  res.json({ rows: rows.rows, summary: { total: rows.rows.length, gmv, comissoes } });
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
      o.status
    FROM orders o
    JOIN users s ON o.supplier_id = s.id
    WHERE o.created_at >= ${from.toISOString()} AND o.created_at <= ${to.toISOString()}
      AND o.comissao > 0
    ORDER BY o.created_at DESC
  `);

  const totalComissoes = (rows.rows as Array<{ comissao_plataforma: string }>).reduce((acc, r) => acc + parseFloat(r.comissao_plataforma || "0"), 0);
  const gmv = (rows.rows as Array<{ valor_pedido: string }>).reduce((acc, r) => acc + parseFloat(r.valor_pedido || "0"), 0);

  res.json({ rows: rows.rows, summary: { total: rows.rows.length, totalComissoes, gmv } });
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
