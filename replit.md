# Workspace — Seu Zuca B2B Marketplace

## Overview

pnpm workspace monorepo using TypeScript. B2B marketplace for construction materials in Brazil.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS v4 + shadcn/ui
- **Routing**: wouter
- **State**: TanStack Query

## Project Structure

```
lib/
  api-spec/openapi.yaml          # OpenAPI spec (source of truth)
  api-client-react/              # Generated React query hooks (Orval)
  db/src/schema/index.ts         # Drizzle schema (all tables)
artifacts/
  api-server/                    # Express backend
    src/routes/                  # auth, products, cart, orders, quotes, reviews, wishlist, admin, dashboard
  seu-zuca/                      # React frontend (Vite)
    src/
      App.tsx                    # All routes
      contexts/AuthContext.tsx   # User auth state
      components/Layout.tsx      # Global navbar/footer
      pages/
        home.tsx, catalog.tsx, product.tsx
        login.tsx, register.tsx, awaiting-approval.tsx
        cart.tsx, checkout.tsx, orders.tsx
        wishlist.tsx, quotes.tsx
        supplier/dashboard.tsx, supplier/product-form.tsx
        admin/dashboard.tsx
```

## Database Tables

- users (id, email, password_hash, nome, role, status, cnpj, razao_social, nome_fantasia, telefone, ramo, stripe_account_id, email_verificado)
- categories (id, nome, slug, descricao, parentId, imagemUrl, unidadeMedida, ativo)
- products (id, supplierId, categoryId, nome, slug, descricao, sku, preco, unidadeMedida, estoque, alerta_estoque, prazo_frete, disponivel)
- product_images (id, productId, url, ordem)
- cart_items (id, userId, productId, quantidade)
- orders (id, buyerId, supplierId, total, status, payment_method, payment_id, comissao)
- order_items (id, orderId, productId, quantidade, preco_unitario)
- quotes / quote_items / quote_responses
- reviews (id, productId, buyerId, nota, titulo, comentario, aprovado)
- wishlists (id, userId, productId)
- addresses (id, userId, cep, logradouro, numero, complemento, bairro, cidade, estado)
- commissions (id, percentual)
- category_minimum_rules (id, categoryId, quantidadeMinima, multiplo)

## Seed Data

- Admin: admin@seuzuca.com.br / Admin@2024
- Supplier: fornecedor@constrosul.com.br / Fornecedor@2024 (auto-approved)
- Buyer: comprador@construtora.com.br / Comprador@2024 (approved)
- 4 parent categories + 4 subcategories seeded
- 5 products seeded (cimento, porcelanato, vergalhão, tinta, bloco)

## Business Rules

- Three roles: admin, buyer, supplier
- Buyers require admin approval (status=pending by default); suppliers auto-approved
- Prices hidden from visitors/unapproved buyers
- CNPJ validation: 14 digits, check digits algorithm
- Category minimum quantity rules (quantidadeMinima + multiplo)
- Commission stored in `commissions` table (default 5%)
- JWT stored in httpOnly cookie (`token`)
- CEP lookup via ViaCEP API at `/api/cep/:cep`
- Order creation splits by supplier + decrements stock

## API Routes (backend prefix: /api)

- POST /auth/register, /auth/login, /auth/logout, GET /auth/me
- GET/POST /categories, GET /categories/:id
- GET /products, GET /products/:id
- GET/POST/PATCH/DELETE /cart/items
- POST /orders, GET /orders
- GET/POST /quotes, GET /quotes/:id, POST /quotes/:id/responses
- GET/POST /wishlist, DELETE /wishlist/:productId
- GET/POST/PUT/DELETE /addresses
- GET /cep/:cep
- GET /supplier/stats, GET/POST /supplier/products, GET /supplier/orders
- GET /admin/users, PATCH /admin/users/:id/approve|reject|suspend
- GET /dashboard/stats, /dashboard/sales-chart, /dashboard/recent-orders, /dashboard/top-products

## Environment Variables

- DATABASE_URL (PostgreSQL connection string)
- SESSION_SECRET (JWT signing secret)
- NODE_ENV
