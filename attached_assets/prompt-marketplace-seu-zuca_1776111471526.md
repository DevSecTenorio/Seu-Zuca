# 🏗️ Prompt Final — Marketplace B2B de Materiais de Construção
# Seu Zuca

---

> **Você é um agente de desenvolvimento fullstack sênior.** Sua tarefa é construir do zero um marketplace **B2B** de materiais de construção chamado **Seu Zuca**, voltado para o mercado brasileiro, com foco em vendas em grande escala para empresas. Siga rigorosamente as especificações abaixo.

---

## 🎯 Objetivo
Conectar fornecedores e lojas de materiais de construção a compradores corporativos (construtoras, empreiteiras e arquitetos/engenheiros), com venda exclusiva em grandes volumes, quantidade mínima por categoria, preços visíveis apenas para usuários autenticados e cadastrados como pessoa jurídica.

---

## 🛠️ Stack tecnológica
- **Framework:** Next.js 14+ (App Router, fullstack)
- **Banco de dados:** Supabase (PostgreSQL + Auth + Storage)
- **Pagamentos:** Stripe Connect (split automático + comissão por venda)
- **E-mail transacional:** Resend + React Email
- **Estilização:** Tailwind CSS + shadcn/ui
- **Validação:** Zod
- **Gráficos/Analytics:** Recharts
- **ORM:** Prisma
- **Linguagem da interface:** Português do Brasil

---

## 👥 Perfis de usuário
1. **Admin** — controle total da plataforma
2. **Fornecedor** — cadastra produtos, define regras de venda por categoria, gerencia estoque e pedidos
3. **Comprador B2B** — construtoras, empreiteiras, arquitetos e engenheiros (somente PJ)

---

## 🔒 Regras B2B — Acesso e Visibilidade
- O catálogo de produtos é **público** (nome, foto, descrição, categoria), mas **preços, quantidade mínima e botão de compra ficam ocultos** para visitantes não autenticados
- Ao tentar ver preço ou comprar sem login, exibir CTA: *"Faça login ou cadastre-se para ver preços e realizar pedidos"*
- Somente usuários com perfil **Comprador aprovado** pelo Admin podem finalizar pedidos
- Cadastro de comprador exige CNPJ válido — validar formato e dígitos verificadores no frontend e backend
- Admin pode aprovar, recusar ou suspender contas de compradores

---

## 📦 Funcionalidades do MVP

### Autenticação e Cadastro
- Login/logout com e-mail e senha via Supabase Auth
- Cadastro separado para Compradores (PJ obrigatório) e Fornecedores com campos: CNPJ, razão social, nome fantasia, endereço completo, telefone, ramo de atuação
- Validação de CNPJ com dígitos verificadores
- Verificação de e-mail obrigatória antes do primeiro acesso
- Recuperação de senha por e-mail
- Conta de comprador entra em status **"aguardando aprovação"** até o Admin liberar

### Catálogo de Produtos
- Listagem pública com busca por nome e categoria e filtros (categoria, fornecedor, disponibilidade)
- **Preços e quantidades visíveis apenas para compradores autenticados e aprovados**
- Página de detalhe do produto com fotos, descrição, SKU, unidade de medida (ex: saco, m², pallet, tonelada), quantidade mínima da categoria, estoque disponível e prazo de frete estimado pelo fornecedor
- Categorias hierárquicas (ex: Estrutura > Cimento, Acabamento > Porcelanato)
- URLs amigáveis por produto e categoria
- Meta tags dinâmicas (Open Graph, title, description) por página
- `sitemap.xml` e `robots.txt` gerados automaticamente
- Structured data (JSON-LD) nas páginas de produto para rich snippets no Google

### Regras de Quantidade Mínima por Categoria
- Cada categoria possui uma **quantidade mínima de compra** configurável pelo Admin
- O fornecedor **não pode** vender abaixo da quantidade mínima da categoria do produto
- No carrinho, exibir claramente a quantidade mínima exigida por item
- Bloquear finalização do pedido se qualquer item estiver abaixo do mínimo da categoria
- Quantidade só pode ser alterada em múltiplos da unidade definida (ex: pacotes de 10, pallets de 50)
- Exibir mensagem de erro clara ao tentar adicionar quantidade inválida: *"Este produto exige no mínimo X unidades nesta categoria"*

### Sistema de Cotação / Orçamento
- Comprador monta lista de itens e solicita cotação a um ou mais fornecedores
- Cotação também respeita as regras de quantidade mínima por categoria
- Fornecedor recebe notificação por e-mail e responde com preço, prazo de entrega, condições e valor do frete
- Comprador compara cotações lado a lado e aceita a melhor oferta
- Histórico completo de cotações no painel do comprador

### Carrinho e Checkout
- Carrinho persistente por sessão, visível apenas para compradores aprovados
- Validação de quantidade mínima por categoria em tempo real no carrinho
- Checkout via Stripe com suporte a múltiplos fornecedores no mesmo pedido
- Cobrança de comissão automática via Stripe Connect (percentual configurável pelo Admin)
- Frete definido manualmente pelo fornecedor por produto ou região de entrega
- Confirmação de pedido por e-mail para comprador e fornecedor
- Webhooks Stripe para atualização de status em tempo real

### Geolocalização
- Validação de CEP via ViaCEP para verificar se o fornecedor entrega na região do comprador
- Exibir apenas fornecedores que atendem o CEP informado

### Controle de Estoque
- Fornecedor define e atualiza quantidade em estoque por produto (em unidades da categoria)
- Estoque decrementado automaticamente a cada pedido confirmado
- Alerta por e-mail ao fornecedor quando estoque atingir quantidade mínima configurável
- Produto marcado como *"Indisponível"* automaticamente ao zerar estoque

### Painel do Fornecedor
- CRUD completo de produtos (nome, fotos, preço, estoque, categorias, SKU, unidade de medida, prazo de frete, regiões atendidas)
- Visualização da quantidade mínima vigente para cada categoria (definida pelo Admin, somente leitura)
- Gestão de pedidos com status: pendente → em separação → enviado → entregue
- Visualização e resposta de cotações
- Extrato de vendas com comissões descontadas
- Configuração de frete por faixa de CEP ou estado

### Painel do Comprador
- Histórico completo de pedidos com status
- Histórico de cotações enviadas e respostas recebidas
- Lista de favoritos (wishlist) com produtos salvos
- Gerenciamento de endereços de entrega

### Avaliações e Reviews
- Comprador avalia fornecedor e produto após entrega confirmada
- Nota de 1 a 5 estrelas + comentário obrigatório
- Média de avaliação exibida no perfil do fornecedor e na página do produto

### Notificações por E-mail (Resend + React Email)
Disparar e-mail automático nos seguintes eventos:
- Cadastro recebido — aguardando aprovação (comprador)
- Conta aprovada ou recusada pelo Admin (comprador)
- Nova cotação recebida (fornecedor)
- Resposta de cotação disponível (comprador)
- Pedido confirmado (comprador e fornecedor)
- Status do pedido atualizado (comprador)
- Estoque baixo (fornecedor)
- Novo review recebido (fornecedor)

### Área Admin
- Dashboard analytics com gráficos (Recharts): GMV total, número de pedidos, ticket médio, fornecedores ativos, compradores aprovados, evolução mensal de vendas
- Gestão de usuários: aprovar, recusar, suspender, visualizar perfil completo
- **Gestão de quantidade mínima por categoria** (criar, editar, ativar/desativar regras)
- Configuração da taxa de comissão global e por categoria
- Moderação de avaliações (aprovar/remover)
- Gestão de categorias de produtos (criar, editar, reordenar, definir unidade de medida padrão)
- Relatórios exportáveis em CSV (pedidos, comissões, usuários)

---

## 🗄️ Modelagem do banco (Supabase/PostgreSQL)
Crie as seguintes tabelas com relacionamentos e índices adequados:

`users`, `profiles`, `suppliers`, `buyers`, `products`, `product_images`, `categories`, `category_minimum_rules`, `stock_alerts`, `orders`, `order_items`, `quotes`, `quote_items`, `quote_responses`, `reviews`, `addresses`, `commissions`, `wishlists`, `shipping_zones`, `notifications_log`

Aplicar **Row Level Security (RLS)** em todas as tabelas, garantindo isolamento total entre perfis. Compradores com status `pending` ou `suspended` não devem acessar preços nem criar pedidos — enforce via RLS e middleware Next.js.

---

## 💳 Integração Stripe Connect
- Cada fornecedor vincula sua conta Stripe Connect no onboarding
- Split automático: valor líquido ao fornecedor + comissão retida pela plataforma
- Suporte a múltiplos fornecedores no mesmo checkout
- Webhooks para: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`

---

## 🔍 SEO
- Metadata dinâmica por página (title, description, Open Graph, Twitter Card)
- URLs semânticas para produtos, categorias e fornecedores
- `sitemap.xml` dinâmico e `robots.txt` configurado
- JSON-LD nas páginas de produto para rich snippets
- Páginas de preço bloqueadas para crawlers (noindex em rotas autenticadas)

---

## 📐 Padrões de desenvolvimento
- Interface, mensagens de erro e e-mails em **Português do Brasil**
- Código e comentários em português
- **Server Actions** do Next.js para mutações
- Validação com **Zod** em todos os formulários
- Responsivo, mobile-first
- Feedback sempre visível: toasts, loading states, mensagens inline
- Variáveis de ambiente documentadas em `.env.example`

---

## 🚀 Ordem de execução sugerida
1. Setup do projeto (Next.js + Supabase + Stripe + Tailwind + Resend)
2. Modelagem do banco, RLS e seeds iniciais
3. Autenticação, cadastro PJ, validação de CNPJ e fluxo de aprovação
4. Middleware de proteção de rotas por perfil e status
5. Catálogo público + lógica de ocultação de preços para visitantes
6. Gestão de categorias e regras de quantidade mínima (Admin)
7. Controle de estoque e alertas
8. Painel do fornecedor (produtos, pedidos, frete, cotações)
9. Painel do comprador (histórico, wishlist, endereços)
10. Carrinho com validação de quantidade mínima em tempo real
11. Checkout e integração Stripe Connect
12. Sistema de cotação e comparação
13. Geolocalização por CEP (ViaCEP)
14. Avaliações e reviews
15. Notificações por e-mail (Resend)
16. Área Admin com dashboard analytics e relatórios
