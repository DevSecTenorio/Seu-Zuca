import "./load-env";

import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "./index";
import type { OrderStatus } from "../lib/order-status";
import { PRODUCTS, SUPPLIERS } from "./seed-data";

// Not reusing src/lib/auth/password.ts / src/lib/slug.ts here: both import the "server-only"
// guard package, which throws unconditionally outside Next.js's bundler — this script runs
// standalone via tsx. slugify below is a small local copy of src/lib/slug.ts's logic.
function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return base || "item";
}

/** Deterministic picsum.photos URL — same seed always resolves to the same image, so re-running
 * the seed doesn't produce a different-looking catalog each time. Banner imagery only (marketing
 * carousel, where a generic scenic photo doesn't mislead about a specific item): real admin
 * uploads replace these through src/lib/storage.ts (Vercel Blob). */
function placeholderImage(seed: string, width: number, height: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

/** Branded, category-correct placeholder for seed products — generated once via
 * scripts/generate-placeholder-images.ts into public/placeholders/<slug>.svg. Unlike a random
 * stock photo, this always matches the product's real category (Blocks icon for Alvenaria, etc.)
 * until real fornecedores/admin upload actual photos through src/lib/storage.ts. */
function productPlaceholderImage(categorySlug: string): string {
  return `/placeholders/${categorySlug}.svg`;
}

const TEST_PASSWORD = "Teste@123";

/** Rough per-unit-sold weight/dimensions by category, for realistic freight quotes in dev/demo
 * data (SPEC.md §10, LOG-02) — not per-product precision, just plausible enough that the cubic-
 * weight and per-kg freight math has real numbers to chew on instead of the schema's flat default. */
const CATEGORY_SHIPPING_DEFAULTS: Record<string, { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number }> = {
  argamassa: { weightGrams: 25000, lengthCm: 60, widthCm: 40, heightCm: 10 },
  estrutura: { weightGrams: 12000, lengthCm: 300, widthCm: 15, heightCm: 15 },
  acabamento: { weightGrams: 3000, lengthCm: 45, widthCm: 45, heightCm: 5 },
  instalacoes: { weightGrams: 1500, lengthCm: 30, widthCm: 30, heightCm: 30 },
  ferramentas: { weightGrams: 2500, lengthCm: 40, widthCm: 20, heightCm: 15 },
  hidraulica: { weightGrams: 800, lengthCm: 100, widthCm: 10, heightCm: 10 },
  eletrica: { weightGrams: 5000, lengthCm: 30, widthCm: 30, heightCm: 20 },
  madeira: { weightGrams: 8000, lengthCm: 220, widthCm: 20, heightCm: 3 },
  alvenaria: { weightGrams: 2500, lengthCm: 20, widthCm: 10, heightCm: 10 },
};

const UNITS: { name: string; abbreviation: string }[] = [
  { name: "Unidade", abbreviation: "un" },
  { name: "Caixa", abbreviation: "cx" },
  { name: "Saco", abbreviation: "sc" },
  { name: "Barra", abbreviation: "br" },
  { name: "Metro", abbreviation: "m" },
  { name: "Metro quadrado", abbreviation: "m²" },
  { name: "Metro cúbico", abbreviation: "m³" },
  { name: "Litro", abbreviation: "l" },
  { name: "Quilograma", abbreviation: "kg" },
  { name: "Tonelada", abbreviation: "t" },
  { name: "Pacote", abbreviation: "pct" },
  { name: "Rolo", abbreviation: "rl" },
  { name: "Peça", abbreviation: "pç" },
  { name: "Par", abbreviation: "par" },
  { name: "Jogo", abbreviation: "jg" },
  { name: "Galão", abbreviation: "gal" },
  { name: "Lata", abbreviation: "lt" },
];

const CATEGORIES: { name: string; slug: string; icon: string; defaultUnit: string }[] = [
  { name: "Argamassa", slug: "argamassa", icon: "Layers", defaultUnit: "Saco" },
  { name: "Estrutura", slug: "estrutura", icon: "Building2", defaultUnit: "Barra" },
  { name: "Acabamento", slug: "acabamento", icon: "Paintbrush", defaultUnit: "Metro quadrado" },
  { name: "Instalações", slug: "instalacoes", icon: "PlugZap", defaultUnit: "Unidade" },
  { name: "Ferramentas", slug: "ferramentas", icon: "Wrench", defaultUnit: "Unidade" },
  { name: "Hidráulica", slug: "hidraulica", icon: "Droplets", defaultUnit: "Unidade" },
  { name: "Elétrica", slug: "eletrica", icon: "Zap", defaultUnit: "Unidade" },
  { name: "Madeira", slug: "madeira", icon: "TreeDeciduous", defaultUnit: "Metro cúbico" },
  { name: "Alvenaria", slug: "alvenaria", icon: "Blocks", defaultUnit: "Unidade" },
];

const BANNERS: {
  title: string;
  highlight: string;
  subtitle: string;
  seed: string;
  link: string;
  order: number;
}[] = [
  {
    title: "Grandes obras, grandes economias",
    highlight: "Até 15% off",
    subtitle: "Cimento, argamassa e estrutura para sua obra com condições exclusivas PJ.",
    seed: "banner-argamassa",
    link: "/catalogo?categoria=argamassa",
    order: 0,
  },
  {
    title: "Linha completa de acabamento",
    highlight: "Novidade",
    subtitle: "Porcelanatos, tintas e revestimentos com entrega para todo o Brasil.",
    seed: "banner-acabamento",
    link: "/catalogo?categoria=acabamento",
    order: 1,
  },
  {
    title: "Ferramentas profissionais para sua equipe",
    highlight: "Garantia de fábrica",
    subtitle: "Furadeiras, betoneiras e kits completos com os melhores preços PJ.",
    seed: "banner-ferramentas",
    link: "/catalogo?categoria=ferramentas",
    order: 2,
  },
  {
    title: "Hidráulica e elétrica sem complicação",
    highlight: "Tudo em um só lugar",
    subtitle: "Tubos, conexões, fiação e quadros de distribuição prontos para sua obra.",
    seed: "banner-hidraulica",
    link: "/catalogo?categoria=hidraulica",
    order: 3,
  },
  {
    title: "Seja um fornecedor Seu Zuca",
    highlight: "Cadastro gratuito",
    subtitle: "Alcance construtoras e empreiteiras de todo o país sem mensalidade fixa.",
    seed: "banner-fornecedor",
    link: "/seja-fornecedor",
    order: 4,
  },
];

async function seedUnits() {
  await db.insert(schema.units).values(UNITS).onConflictDoNothing({ target: schema.units.name });
  console.log(`✓ ${UNITS.length} unidades`);
}

async function seedCategories() {
  const allUnits = await db.select().from(schema.units);
  const unitIdByName = new Map(allUnits.map((u) => [u.name, u.id]));

  for (const category of CATEGORIES) {
    await db
      .insert(schema.categories)
      .values({
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        defaultUnitId: unitIdByName.get(category.defaultUnit) ?? null,
        active: true,
      })
      .onConflictDoNothing({ target: schema.categories.slug });
  }
  console.log(`✓ ${CATEGORIES.length} categorias`);
}

async function seedMinQuantityRules() {
  const rules: { categorySlug: string; minQuantity: number; multiple: number }[] = [
    { categorySlug: "argamassa", minQuantity: 50, multiple: 10 },
    { categorySlug: "alvenaria", minQuantity: 100, multiple: 50 },
  ];
  for (const rule of rules) {
    const category = await db.query.categories.findFirst({ where: eq(schema.categories.slug, rule.categorySlug) });
    if (!category) continue;
    await db
      .insert(schema.minQuantityRules)
      .values({ categoryId: category.id, minQuantity: rule.minQuantity, multiple: rule.multiple })
      .onConflictDoNothing({ target: schema.minQuantityRules.categoryId });
  }
  console.log(`✓ ${rules.length} regras de quantidade mínima`);
}

async function seedSettings() {
  await db
    .insert(schema.settings)
    .values({ key: "commission_percent", value: 5 })
    .onConflictDoNothing({ target: schema.settings.key });
  console.log("✓ configurações padrão (comissão 5%)");
}

async function upsertInternalUser(email: string, role: "admin" | "suporte") {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return existing.id;

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash, role, status: "aprovado" })
    .returning({ id: schema.users.id });
  return user.id;
}

async function upsertCompanyAccount(input: {
  email: string;
  role: "comprador" | "fornecedor";
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  ramoAtividade: string;
}): Promise<{ userId: string; companyId: string }> {
  const existingUser = await db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
  if (existingUser) {
    const existingCompany = await db.query.companies.findFirst({ where: eq(schema.companies.userId, existingUser.id) });
    // Backfills the slug for suppliers seeded before companies.slug existed (Phase 3 migration)
    // — otherwise their /fornecedor/[slug] page would never resolve.
    if (existingCompany && input.role === "fornecedor" && !existingCompany.slug) {
      const slug = slugify(input.nomeFantasia);
      await db.update(schema.companies).set({ slug }).where(eq(schema.companies.id, existingCompany.id));
    }
    return { userId: existingUser.id, companyId: existingCompany!.id };
  }

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const [user] = await db
    .insert(schema.users)
    .values({ email: input.email, passwordHash, role: input.role, status: "aprovado" })
    .returning({ id: schema.users.id });

  // Only suppliers get a public storefront slug (/fornecedor/[slug]) — mirrors
  // src/server/actions/register-actions.ts's real signup flow.
  const slug = input.role === "fornecedor" ? slugify(input.nomeFantasia) : null;

  const [company] = await db
    .insert(schema.companies)
    .values({
      userId: user.id,
      razaoSocial: input.razaoSocial,
      nomeFantasia: input.nomeFantasia,
      cnpj: input.cnpj,
      telefone: input.telefone,
      ramoAtividade: input.ramoAtividade,
      slug,
    })
    .returning({ id: schema.companies.id });

  await db.insert(schema.addresses).values({
    companyId: company.id,
    type: "empresa",
    cep: "01310200",
    logradouro: "Avenida Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
    isDefault: true,
  });

  return { userId: user.id, companyId: company.id };
}

async function seedTestAccounts() {
  await upsertInternalUser("admin@seuzuca.com.br", "admin");
  await upsertInternalUser("suporte@seuzuca.com.br", "suporte");

  const supplierIds: string[] = [];
  for (const supplier of SUPPLIERS) {
    const { userId } = await upsertCompanyAccount({ ...supplier, role: "fornecedor" });
    supplierIds.push(userId);
  }

  const buyer = await upsertCompanyAccount({
    email: "comprador@seuzuca.com.br",
    role: "comprador",
    razaoSocial: "Construtora Horizonte Ltda.",
    nomeFantasia: "Construtora Horizonte",
    cnpj: "44555666000181",
    telefone: "(11) 4000-5678",
    ramoAtividade: "Construção civil",
  });

  console.log(`✓ ${2 + SUPPLIERS.length + 1} contas de teste (admin, suporte, ${SUPPLIERS.length} fornecedores, comprador)`);
  return { supplierIds, buyerId: buyer.userId, buyerCompanyId: buyer.companyId };
}

async function seedProducts(supplierIds: string[]) {
  const [allCategories, allUnits] = await Promise.all([
    db.select().from(schema.categories),
    db.select().from(schema.units),
  ]);
  const categoryIdBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));
  const unitIdByName = new Map(allUnits.map((u) => [u.name, u.id]));

  let createdCount = 0;
  for (const product of PRODUCTS) {
    const existing = await db.query.products.findFirst({ where: eq(schema.products.sku, product.sku) });
    if (existing) continue;

    const categoryId = categoryIdBySlug.get(product.categorySlug);
    const unitId = unitIdByName.get(product.unitName);
    const supplierId = supplierIds[product.supplierIndex];
    if (!categoryId || !unitId || !supplierId) continue;

    const shippingDefaults = CATEGORY_SHIPPING_DEFAULTS[product.categorySlug];

    const [row] = await db
      .insert(schema.products)
      .values({
        supplierId,
        categoryId,
        unitId,
        name: product.name,
        slug: slugify(product.name),
        sku: product.sku,
        description: product.description,
        priceCents: product.priceCents,
        stock: product.stock,
        leadTimeDays: product.leadTimeDays,
        ...shippingDefaults,
        moderationStatus: "ativo",
      })
      .returning({ id: schema.products.id });

    // One illustrative placeholder per product, matching its real category (see
    // productPlaceholderImage above) — not a random unrelated stock photo per gallery slot.
    await db.insert(schema.productImages).values([
      { productId: row.id, url: productPlaceholderImage(product.categorySlug), order: 0 },
    ]);
    createdCount += 1;
  }
  console.log(`✓ ${createdCount} produtos novos (${PRODUCTS.length} no catálogo de seed)`);
}

/**
 * Two sample orders for the seed buyer account (one delivered, one still in separation) so
 * /pedidos, the supplier "Pedidos" tab, and (later) the review flow have something real to show
 * right after `db:seed` — without this, those screens are only exercisable by clicking through a
 * full checkout first.
 */
async function seedSampleOrders(buyerId: string, buyerCompanyId: string, supplierIds: string[]) {
  const existing = await db.query.orders.findFirst({ where: eq(schema.orders.buyerId, buyerId) });
  if (existing) {
    console.log("✓ pedidos de exemplo já existem, seed ignorado");
    return;
  }

  const address = await db.query.addresses.findFirst({ where: eq(schema.addresses.companyId, buyerCompanyId) });
  if (!address) return;

  const commissionPercent = await db.query.settings.findFirst({ where: eq(schema.settings.key, "commission_percent") });
  const commission = typeof commissionPercent?.value === "number" ? commissionPercent.value : 5;

  async function createSampleOrder(input: {
    supplierId: string;
    skus: string[];
    quantities: number[];
    statuses: OrderStatus[];
    trackingCode?: string;
  }) {
    const products = await db.query.products.findMany({ where: inArray(schema.products.sku, input.skus) });
    if (products.length !== input.skus.length) return;

    const items = input.skus.map((sku, i) => {
      const product = products.find((p) => p.sku === sku)!;
      return { product, quantity: input.quantities[i] };
    });
    const subtotalCents = items.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);
    const shippingCents = subtotalCents >= 50000 ? 0 : 2990;
    const totalCents = subtotalCents + shippingCents;
    const commissionCents = Math.round(subtotalCents * (commission / 100));

    const [checkoutGroup] = await db
      .insert(schema.checkoutGroups)
      .values({ buyerId, deliveryAddressId: address!.id, totalCents })
      .returning({ id: schema.checkoutGroups.id });

    const finalStatus = input.statuses[input.statuses.length - 1];
    const [order] = await db
      .insert(schema.orders)
      .values({
        checkoutGroupId: checkoutGroup.id,
        buyerId,
        supplierId: input.supplierId,
        status: finalStatus,
        subtotalCents,
        shippingCents,
        totalCents,
        commissionPercent: commission.toFixed(2),
        commissionCents,
        trackingCode: input.trackingCode ?? null,
      })
      .returning({ id: schema.orders.id });

    await db.insert(schema.orderItems).values(
      items.map((i) => ({
        orderId: order.id,
        productId: i.product.id,
        productNameSnapshot: i.product.name,
        unitPriceCents: i.product.priceCents,
        quantity: i.quantity,
        totalCents: i.product.priceCents * i.quantity,
      })),
    );

    const eventNotes: Record<string, string> = {
      aguardando_pagamento: "Pedido criado no checkout.",
      pago: "Pagamento confirmado via webhook do Mercado Pago.",
      em_separacao: "Pedido em separação.",
      enviado: `Enviado. Código de rastreio: ${input.trackingCode ?? ""}`,
      entregue: "Entrega confirmada pelo comprador.",
    };
    await db.insert(schema.orderStatusEvents).values(
      input.statuses.map((status) => ({ orderId: order.id, status, note: eventNotes[status] })),
    );

    await db.insert(schema.payments).values({
      checkoutGroupId: checkoutGroup.id,
      method: "pix",
      status: finalStatus === "aguardando_pagamento" ? "aguardando_pagamento" : "pago",
    });

    return order.id;
  }

  await createSampleOrder({
    supplierId: supplierIds[0],
    skus: ["ARG-AC3-20", "CIM-CPII-50"],
    quantities: [50, 30],
    statuses: ["aguardando_pagamento", "pago", "em_separacao", "enviado", "entregue"],
    trackingCode: "BR123456789SZ",
  });

  await createSampleOrder({
    supplierId: supplierIds[1],
    skus: ["POR-ACT-6060"],
    quantities: [40],
    statuses: ["aguardando_pagamento", "pago", "em_separacao"],
  });

  console.log("✓ 2 pedidos de exemplo (1 entregue, 1 em separação)");
}

async function seedBanners() {
  const existingCount = await db.select({ id: schema.banners.id }).from(schema.banners);
  if (existingCount.length > 0) {
    console.log("✓ banners já existem, seed ignorado");
    return;
  }
  await db.insert(schema.banners).values(
    BANNERS.map((banner) => ({
      title: banner.title,
      highlight: banner.highlight,
      subtitle: banner.subtitle,
      imageUrl: placeholderImage(banner.seed, 1600, 500),
      link: banner.link,
      order: banner.order,
      active: true,
    })),
  );
  console.log(`✓ ${BANNERS.length} banners`);
}

async function main() {
  console.log("Seeding database...\n");
  await seedUnits();
  await seedCategories();
  await seedMinQuantityRules();
  await seedSettings();
  const { supplierIds, buyerId, buyerCompanyId } = await seedTestAccounts();
  await seedProducts(supplierIds);
  await seedBanners();
  await seedSampleOrders(buyerId, buyerCompanyId, supplierIds);
  console.log("\nSeed concluído. Senha de todas as contas de teste: " + TEST_PASSWORD);
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed falhou:", error);
  process.exit(1);
});
