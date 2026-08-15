# Seu Zuca — Web (Next.js)

Marketplace B2B de materiais de construção. Ver `../../CLAUDE_1.md` (renomeie/copie para
`CLAUDE.md` na raiz) e `../../SPEC.md` na raiz do monorepo para o contexto completo do produto.
Este pacote (`apps/web`) é a implementação em Next.js definida como arquitetura não-negociável do
projeto — construída do zero, lado a lado com o app legado em `artifacts/` (Express + Vite), que
não foi tocado.

## Stack

- **Next.js 16** (App Router, TypeScript estrito, Turbopack)
- **Tailwind CSS v4** + **shadcn/ui** (estilo "new-york") + ícones Lucide
- **Postgres serverless: [Neon](https://neon.tech)** — escolhido em vez de Supabase porque o
  projeto já usa Vercel Blob para upload de arquivos (não precisamos do storage do Supabase), e o
  driver `@neondatabase/serverless` tem dois modos que encaixam bem no modelo serverless da
  Vercel: HTTP sem estado (usado no `proxy.ts`, roda em qualquer runtime, sem overhead de conexão)
  e um Pool sobre WebSocket (usado no restante do app, com suporte a transações reais).
- **ORM: Drizzle**, schema completo em `src/db/schema/`, migrations versionadas em
  `src/db/migrations/`
- **Autenticação própria**: sessões em banco (tabela `sessions`) + cookie `httpOnly`, senhas com
  bcrypt. Sem OAuth social (produto B2B, login por e-mail corporativo).
- **Upload de arquivos (KYC)**: Vercel Blob em produção; sem `BLOB_READ_WRITE_TOKEN`, cai para
  `public/uploads` em dev (nunca em produção — filesystem da Vercel não é persistente).
- **E-mail transacional**: Resend se `RESEND_API_KEY` estiver definida; caso contrário, loga no
  console (redefinição de senha, etc.).
- **Validação**: Zod, compartilhado entre formulário e server action.

## Setup

```bash
cd apps/web
cp .env.example .env.local
# preencha DATABASE_URL com a connection string do Neon (aba "Connection string" do dashboard)
```

Da raiz do monorepo (o workspace pnpm cobre `apps/*`):

```bash
pnpm install
pnpm --filter @workspace/web db:generate   # gera migrations a partir do schema (já rodado uma vez)
pnpm --filter @workspace/web db:migrate    # aplica as migrations no banco configurado em DATABASE_URL
pnpm --filter @workspace/web db:seed       # categorias, unidades e contas de teste
pnpm --filter @workspace/web dev           # http://localhost:3000
```

## Banco de dados

Schema completo (23 tabelas) cobrindo toda a seção "Modelo de Dados" do SPEC.md, incluindo as
tabelas ainda não usadas por nenhuma tela desta fase (produtos, carrinho, pedidos, pagamentos,
avaliações, banners, wishlist) — elas existem desde já para que as próximas fases só precisem
implementar UI/regras de negócio, sem migrations retroativas.

- `src/db/schema/*.ts` — schema Drizzle, um arquivo por domínio
- `src/db/migrations/` — SQL gerado, versionado no repositório
- `src/db/seed.ts` — idempotente (usa `onConflictDoNothing`/checagem por e-mail), pode rodar
  várias vezes sem duplicar dados

### Contas de teste (após `db:seed`)

Senha de todas: `Teste@123`

| Papel | E-mail | Status |
|---|---|---|
| Admin | admin@seuzuca.com.br | aprovado |
| Suporte | suporte@seuzuca.com.br | aprovado |
| Fornecedor | fornecedor@seuzuca.com.br | aprovado |
| Comprador | comprador@seuzuca.com.br | aprovado |

Para testar o fluxo de aprovação pendente, cadastre uma nova conta em `/cadastro/comprador` ou
`/cadastro/fornecedor` — ela nasce com status `pendente` e cai em `/aguardando-aprovacao`.

## Autorização

`src/proxy.ts` (convenção que substitui `middleware.ts` no Next 16) bloqueia rotas por papel e por
status de conta no servidor, antes de qualquer render. Toda action/rota sensível também
revalida com `requireUser`/`requireApprovedUser` (`src/lib/auth/require-user.ts`) — defesa em
profundidade, já que autorização client-side nunca é a fonte da verdade.

## O que esta fase (Fase 1) entrega

- Schema completo do banco + migrations
- Login, logout, redefinição de senha (e-mail logado no console em dev)
- Cadastro em duas etapas (dados da empresa + documentos KYC) para comprador e fornecedor
- `/aguardando-aprovacao`, bloqueio de contas pendentes/suspensas/rejeitadas
- Header (logo, menu de categorias placeholder, busca, área de login) e footer institucional
- Páginas placeholder por papel (`/admin`, `/suporte`, `/fornecedor/painel`) só para validar o
  redirecionamento — o conteúdo real de cada painel é das Fases 2, 5 e 6

Catálogo, carrinho, pedidos, pagamentos e o conteúdo real dos painéis **não** fazem parte desta
fase — ver `../../ROADMAP.md`.

## Comandos úteis

```bash
pnpm --filter @workspace/web build       # next build
pnpm --filter @workspace/web lint        # eslint
pnpm --filter @workspace/web db:studio   # Drizzle Studio
```
