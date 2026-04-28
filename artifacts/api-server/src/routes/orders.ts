import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, cartItemsTable, productsTable, addressesTable, usersTable, commissionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, requireApprovedBuyer, requireSupplier, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

async function buildOrderResponse(order: typeof ordersTable.$inferSelect) {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, order.buyerId));
  const [supplier] = await db.select().from(usersTable).where(eq(usersTable.id, order.supplierId));
  const address = order.addressId
    ? (await db.select().from(addressesTable).where(eq(addressesTable.id, order.addressId)))[0] || null
    : null;

  const detailedItems = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    return { ...item, productName: product?.nome || "Produto" };
  }));

  return {
    ...order,
    buyerName: buyer?.nomeFantasia || buyer?.nome,
    supplierName: supplier?.nomeFantasia || supplier?.nome,
    address,
    items: detailedItems,
  };
}

router.get("/orders", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const orders = await db.select().from(ordersTable)
    .where(eq(ordersTable.buyerId, req.userId!))
    .orderBy(desc(ordersTable.createdAt));

  const result = await Promise.all(orders.map(buildOrderResponse));
  res.json(result);
});

router.get("/orders/:id", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) {
    res.status(404).json({ message: "Pedido não encontrado" });
    return;
  }

  if (order.buyerId !== req.userId && order.supplierId !== req.userId && req.userRole !== "admin") {
    res.status(403).json({ message: "Acesso negado" });
    return;
  }

  const result = await buildOrderResponse(order);
  res.json(result);
});

router.post("/orders", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const { addressId, observacoes } = req.body;

  if (!addressId) {
    res.status(400).json({ message: "Endereço de entrega é obrigatório" });
    return;
  }

  const cartItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.userId, req.userId!));
  if (cartItems.length === 0) {
    res.status(400).json({ message: "Carrinho vazio" });
    return;
  }

  const [address] = await db.select().from(addressesTable).where(and(eq(addressesTable.id, addressId), eq(addressesTable.userId, req.userId!)));
  if (!address) {
    res.status(400).json({ message: "Endereço não encontrado" });
    return;
  }

  const [commissionConfig] = await db.select().from(commissionsTable);
  const globalRate = (commissionConfig?.percentualGlobal ?? 5) / 100;

  const itemsWithProducts = await Promise.all(cartItems.map(async (item) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    return { ...item, product };
  }));

  const supplierGroups = new Map<number, typeof itemsWithProducts>();
  itemsWithProducts.forEach((item) => {
    if (!item.product) return;
    const existing = supplierGroups.get(item.product.supplierId) || [];
    supplierGroups.set(item.product.supplierId, [...existing, item]);
  });

  const createdOrders = [];
  for (const [supplierId, items] of supplierGroups) {
    const [supplier] = await db.select({ comissao: usersTable.comissao }).from(usersTable).where(eq(usersTable.id, supplierId));
    const supplierRate = supplier?.comissao != null ? supplier.comissao / 100 : null;

    let total = 0;
    let comissao = 0;
    for (const item of items) {
      const itemTotal = (item.product?.preco || 0) * item.quantidade;
      total += itemTotal;
      const productComissao = item.product?.comissao;
      const rate = productComissao != null ? productComissao / 100 : (supplierRate ?? globalRate);
      comissao += itemTotal * rate;
    }

    const [order] = await db.insert(ordersTable).values({
      buyerId: req.userId!,
      supplierId,
      status: "pendente",
      total: Math.round(total * 100) / 100,
      comissao: Math.round(comissao * 100) / 100,
      addressId,
      observacoes,
    }).returning();

    await db.insert(orderItemsTable).values(items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      quantidade: item.quantidade,
      precoUnitario: item.product?.preco || 0,
      subtotal: Math.round((item.product?.preco || 0) * item.quantidade * 100) / 100,
    })));

    for (const item of items) {
      if (item.product) {
        const newStock = Math.max(0, item.product.estoque - item.quantidade);
        await db.update(productsTable)
          .set({ estoque: newStock, disponivel: newStock > 0 })
          .where(eq(productsTable.id, item.productId));
      }
    }

    const result = await buildOrderResponse(order);
    createdOrders.push(result);
  }

  await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, req.userId!));

  const primaryOrder = createdOrders[0];
  res.status(201).json({ ...primaryOrder, checkoutUrl: `/pedidos/${primaryOrder.id}` });
});

// BUYER — cancel own pending order
router.put("/orders/:id/cancel", authMiddleware, requireApprovedBuyer, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, id), eq(ordersTable.buyerId, req.userId!)));
  if (!order) {
    res.status(404).json({ message: "Pedido não encontrado" });
    return;
  }

  const cancellable = ["pendente"];
  if (!cancellable.includes(order.status)) {
    res.status(400).json({ message: "Apenas pedidos pendentes podem ser cancelados pelo comprador" });
    return;
  }

  const [updated] = await db.update(ordersTable).set({ status: "cancelado" }).where(eq(ordersTable.id, id)).returning();

  // Restore stock
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  for (const item of items) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (product) {
      const newStock = product.estoque + item.quantidade;
      await db.update(productsTable).set({ estoque: newStock, disponivel: true }).where(eq(productsTable.id, item.productId));
    }
  }

  const result = await buildOrderResponse(updated);
  res.json(result);
});

// SUPPLIER
router.get("/supplier/orders", authMiddleware, requireSupplier, async (req: AuthRequest, res): Promise<void> => {
  const orders = await db.select().from(ordersTable)
    .where(eq(ordersTable.supplierId, req.userId!))
    .orderBy(desc(ordersTable.createdAt));

  const result = await Promise.all(orders.map(buildOrderResponse));
  res.json(result);
});

router.put("/supplier/orders/:id/status", authMiddleware, requireSupplier, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status } = req.body;

  const validStatuses = ["pendente", "em_separacao", "enviado", "entregue", "cancelado"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ message: "Status inválido" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, id), eq(ordersTable.supplierId, req.userId!)));
  if (!order) {
    res.status(404).json({ message: "Pedido não encontrado" });
    return;
  }

  const [updated] = await db.update(ordersTable).set({ status }).where(eq(ordersTable.id, id)).returning();
  const result = await buildOrderResponse(updated);
  res.json(result);
});

export default router;
