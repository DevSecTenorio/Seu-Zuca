import "./load-env";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "./index";

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
 * the seed doesn't produce a different-looking catalog each time. Placeholder imagery only: real
 * fornecedores/admin upload actual photos through src/lib/storage.ts (Vercel Blob). */
function placeholderImage(seed: string, width: number, height: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

const TEST_PASSWORD = "Teste@123";

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

const SUPPLIERS: {
  email: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  ramoAtividade: string;
}[] = [
  {
    email: "fornecedor@seuzuca.com.br",
    razaoSocial: "Construsul Materiais Ltda.",
    nomeFantasia: "Construsul Materiais",
    cnpj: "11222333000181",
    telefone: "(11) 4000-1234",
    ramoAtividade: "Distribuição de materiais de construção",
  },
  {
    email: "fornecedor2@seuzuca.com.br",
    razaoSocial: "Ferragens Silva & Cia Ltda.",
    nomeFantasia: "Ferragens Silva",
    cnpj: "22333444000162",
    telefone: "(11) 4000-2345",
    ramoAtividade: "Ferramentas e ferragens para construção civil",
  },
  {
    email: "fornecedor3@seuzuca.com.br",
    razaoSocial: "Elétrica Total Distribuidora Ltda.",
    nomeFantasia: "Elétrica Total",
    cnpj: "33444555000143",
    telefone: "(11) 4000-3456",
    ramoAtividade: "Materiais elétricos e hidráulicos",
  },
];

// Distributed across the 9 official categories; supplier index refers to SUPPLIERS above.
const PRODUCTS: {
  name: string;
  categorySlug: string;
  unitName: string;
  sku: string;
  priceCents: number;
  stock: number;
  leadTimeDays: number;
  description: string;
  supplierIndex: number;
  images: number;
}[] = [
  {
    name: "Argamassa Colante AC-III 20kg",
    categorySlug: "argamassa",
    unitName: "Saco",
    sku: "ARG-AC3-20",
    priceCents: 2890,
    stock: 500,
    leadTimeDays: 2,
    description:
      "Argamassa colante flexível tipo AC-III, indicada para porcelanatos e áreas externas sujeitas a variação térmica. Pedido mínimo de 20 sacos por categoria (Argamassa), em múltiplos de 5. Frete grátis para pedidos acima de 100 sacos na região metropolitana.",
    supplierIndex: 0,
    images: 3,
  },
  {
    name: "Cimento CP-II-32 50kg",
    categorySlug: "argamassa",
    unitName: "Saco",
    sku: "CIM-CPII-50",
    priceCents: 3450,
    stock: 800,
    leadTimeDays: 2,
    description:
      "Cimento Portland composto CP-II-32, uso geral em concretos, argamassas e contrapisos. Estoque em grande volume para atender obras de médio e grande porte.",
    supplierIndex: 0,
    images: 2,
  },
  {
    name: "Rejunte Cimentício Cinza Platina 1kg",
    categorySlug: "argamassa",
    unitName: "Pacote",
    sku: "REJ-CINZ-1",
    priceCents: 1290,
    stock: 300,
    leadTimeDays: 3,
    description: "Rejunte cimentício com resistência a fungos e mofo, ideal para pisos e revestimentos internos e externos.",
    supplierIndex: 1,
    images: 2,
  },
  {
    name: "Vergalhão CA-50 10mm 12m",
    categorySlug: "estrutura",
    unitName: "Barra",
    sku: "VRG-CA50-10",
    priceCents: 4590,
    stock: 250,
    leadTimeDays: 5,
    description: "Vergalhão de aço CA-50 nervurado, diâmetro 10mm, barras de 12 metros, certificado conforme norma ABNT NBR 7480.",
    supplierIndex: 0,
    images: 2,
  },
  {
    name: "Bloco de Concreto Estrutural 14x19x39",
    categorySlug: "estrutura",
    unitName: "Peça",
    sku: "BLC-EST-1419",
    priceCents: 350,
    stock: 5000,
    leadTimeDays: 4,
    description: "Bloco de concreto estrutural para alvenaria armada, dimensões 14x19x39cm, resistência 6 MPa. Pedido mínimo de 100 unidades.",
    supplierIndex: 1,
    images: 2,
  },
  {
    name: "Tela Soldada Nervurada 15x15 2,45x6m",
    categorySlug: "estrutura",
    unitName: "Rolo",
    sku: "TEL-SLD-1515",
    priceCents: 18900,
    stock: 60,
    leadTimeDays: 6,
    description: "Tela soldada nervurada para lajes e contrapisos, malha 15x15cm, painel de 2,45 x 6 metros.",
    supplierIndex: 0,
    images: 2,
  },
  {
    name: "Porcelanato Acetinado 60x60 Cinza",
    categorySlug: "acabamento",
    unitName: "Metro quadrado",
    sku: "POR-ACT-6060",
    priceCents: 4990,
    stock: 1200,
    leadTimeDays: 5,
    description: "Porcelanato acetinado retificado 60x60cm, tonalidade cinza, PEI 4 — indicado para tráfego intenso. Frete grátis acima de 200m².",
    supplierIndex: 1,
    images: 3,
  },
  {
    name: "Tinta Acrílica Fosca Branca 18L",
    categorySlug: "acabamento",
    unitName: "Lata",
    sku: "TNT-ACR-18",
    priceCents: 25900,
    stock: 90,
    leadTimeDays: 3,
    description: "Tinta acrílica fosca premium, rendimento aproximado de 300m² por demão, lata de 18 litros.",
    supplierIndex: 2,
    images: 2,
  },
  {
    name: "Massa Corrida PVA 25kg",
    categorySlug: "acabamento",
    unitName: "Saco",
    sku: "MSS-PVA-25",
    priceCents: 8900,
    stock: 150,
    leadTimeDays: 3,
    description: "Massa corrida PVA para nivelamento e acabamento de paredes internas antes da pintura.",
    supplierIndex: 2,
    images: 2,
  },
  {
    name: "Caixa de Passagem PVC 4x2",
    categorySlug: "instalacoes",
    unitName: "Unidade",
    sku: "CXP-PVC-42",
    priceCents: 350,
    stock: 2000,
    leadTimeDays: 2,
    description: "Caixa de passagem em PVC 4x2 polegadas para instalações elétricas embutidas, com tampa cega.",
    supplierIndex: 1,
    images: 2,
  },
  {
    name: "Eletroduto Corrugado 25mm 25m",
    categorySlug: "instalacoes",
    unitName: "Rolo",
    sku: "ELT-COR-25",
    priceCents: 6900,
    stock: 200,
    leadTimeDays: 3,
    description: "Eletroduto corrugado flexível 25mm, rolo com 25 metros, próprio para embutir em laje e parede.",
    supplierIndex: 2,
    images: 2,
  },
  {
    name: "Furadeira de Impacto 750W",
    categorySlug: "ferramentas",
    unitName: "Unidade",
    sku: "FRD-IMP-750",
    priceCents: 34900,
    stock: 40,
    leadTimeDays: 4,
    description: "Furadeira de impacto profissional 750W, mandril de 13mm, com maleta e garantia de fábrica de 12 meses.",
    supplierIndex: 0,
    images: 3,
  },
  {
    name: "Betoneira 400L Monofásica",
    categorySlug: "ferramentas",
    unitName: "Unidade",
    sku: "BET-400-MF",
    priceCents: 289900,
    stock: 8,
    leadTimeDays: 10,
    description: "Betoneira 400 litros, motor monofásico 1,5cv, ideal para obras de médio porte. Entrega combinada com transportadora.",
    supplierIndex: 0,
    images: 2,
  },
  {
    name: "Kit Ferramentas Manuais 129 peças",
    categorySlug: "ferramentas",
    unitName: "Jogo",
    sku: "KIT-FRM-129",
    priceCents: 45900,
    stock: 25,
    leadTimeDays: 5,
    description: "Kit com 129 peças para manutenção geral: chaves, alicates, soquetes e acessórios em maleta organizadora.",
    supplierIndex: 1,
    images: 2,
  },
  {
    name: "Tubo PVC Soldável 100mm 6m",
    categorySlug: "hidraulica",
    unitName: "Barra",
    sku: "TUB-PVC-100",
    priceCents: 8900,
    stock: 300,
    leadTimeDays: 4,
    description: "Tubo de PVC soldável 100mm, barra de 6 metros, para redes de esgoto e águas pluviais.",
    supplierIndex: 2,
    images: 2,
  },
  {
    name: "Registro de Gaveta Bruto 3/4\"",
    categorySlug: "hidraulica",
    unitName: "Unidade",
    sku: "REG-GAV-34",
    priceCents: 2190,
    stock: 400,
    leadTimeDays: 3,
    description: "Registro de gaveta bruto em latão, rosca de 3/4 polegada, para instalações hidráulicas prediais.",
    supplierIndex: 2,
    images: 2,
  },
  {
    name: "Caixa d'Água Polietileno 1000L",
    categorySlug: "hidraulica",
    unitName: "Unidade",
    sku: "CXA-POL-1000",
    priceCents: 65900,
    stock: 30,
    leadTimeDays: 7,
    description: "Caixa d'água em polietileno com proteção UV, capacidade de 1000 litros, tampa com vedação rosqueável.",
    supplierIndex: 1,
    images: 2,
  },
  {
    name: "Cabo Flexível 2,5mm² 100m",
    categorySlug: "eletrica",
    unitName: "Rolo",
    sku: "CBO-FLX-25",
    priceCents: 19900,
    stock: 120,
    leadTimeDays: 4,
    description: "Cabo flexível 2,5mm², rolo com 100 metros, isolação antichama 750V, conforme norma NBR NM 247-3.",
    supplierIndex: 0,
    images: 2,
  },
  {
    name: "Disjuntor Bipolar 40A",
    categorySlug: "eletrica",
    unitName: "Unidade",
    sku: "DIS-BIP-40",
    priceCents: 3490,
    stock: 300,
    leadTimeDays: 2,
    description: "Disjuntor termomagnético bipolar 40A, padrão DIN, curva C — proteção para circuitos residenciais e comerciais.",
    supplierIndex: 2,
    images: 2,
  },
  {
    name: "Quadro de Distribuição 12 Disjuntores",
    categorySlug: "eletrica",
    unitName: "Unidade",
    sku: "QDR-DIST-12",
    priceCents: 15900,
    stock: 60,
    leadTimeDays: 5,
    description: "Quadro de distribuição de embutir para até 12 disjuntores, em chapa metálica com pintura eletrostática.",
    supplierIndex: 1,
    images: 2,
  },
  {
    name: "Compensado Naval 18mm 2,20x1,60m",
    categorySlug: "madeira",
    unitName: "Peça",
    sku: "CMP-NAV-18",
    priceCents: 32900,
    stock: 70,
    leadTimeDays: 6,
    description: "Chapa de compensado naval 18mm, resistente à umidade, indicada para formas de concreto e mobiliário externo.",
    supplierIndex: 0,
    images: 2,
  },
  {
    name: "Sarrafo de Pinus 5x2,5cm 3m",
    categorySlug: "madeira",
    unitName: "Peça",
    sku: "SRF-PIN-3M",
    priceCents: 1290,
    stock: 800,
    leadTimeDays: 3,
    description: "Sarrafo de pinus tratado, 5x2,5cm, comprimento de 3 metros, ideal para estruturas de forro e acabamentos.",
    supplierIndex: 1,
    images: 2,
  },
  {
    name: "Tijolo Baiano 8 Furos",
    categorySlug: "alvenaria",
    unitName: "Unidade",
    sku: "TJL-BAI-8F",
    priceCents: 120,
    stock: 20000,
    leadTimeDays: 3,
    description: "Tijolo cerâmico baiano de 8 furos, dimensões 9x19x19cm, para vedação de alvenaria. Pedido mínimo de 100 unidades, em múltiplos de 50.",
    supplierIndex: 2,
    images: 2,
  },
  {
    name: "Bloco Cerâmico de Vedação 9x19x19",
    categorySlug: "alvenaria",
    unitName: "Unidade",
    sku: "BLC-CER-919",
    priceCents: 145,
    stock: 15000,
    leadTimeDays: 3,
    description: "Bloco cerâmico de vedação, dimensões 9x19x19cm, ideal para paredes internas e externas não estruturais.",
    supplierIndex: 2,
    images: 2,
  },
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

  await upsertCompanyAccount({
    email: "comprador@seuzuca.com.br",
    role: "comprador",
    razaoSocial: "Construtora Horizonte Ltda.",
    nomeFantasia: "Construtora Horizonte",
    cnpj: "44555666000181",
    telefone: "(11) 4000-5678",
    ramoAtividade: "Construção civil",
  });

  console.log(`✓ ${2 + SUPPLIERS.length + 1} contas de teste (admin, suporte, ${SUPPLIERS.length} fornecedores, comprador)`);
  return supplierIds;
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
        moderationStatus: "ativo",
      })
      .returning({ id: schema.products.id });

    await db.insert(schema.productImages).values(
      Array.from({ length: product.images }, (_, i) => ({
        productId: row.id,
        url: placeholderImage(`${product.sku}-${i}`, 800, 800),
        order: i,
      })),
    );
    createdCount += 1;
  }
  console.log(`✓ ${createdCount} produtos novos (${PRODUCTS.length} no catálogo de seed)`);
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
  const supplierIds = await seedTestAccounts();
  await seedProducts(supplierIds);
  await seedBanners();
  console.log("\nSeed concluído. Senha de todas as contas de teste: " + TEST_PASSWORD);
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed falhou:", error);
  process.exit(1);
});
