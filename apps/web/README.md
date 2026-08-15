# Seu Zuca — Web (Next.js)

Marketplace B2B de materiais de construção. Ver `../../CLAUDE_1.md` (renomeie/copie para
`CLAUDE.md` na raiz) e `../../SPEC.md` na raiz do monorepo para o contexto completo do produto.
Este pacote (`apps/web`) é a implementação em Next.js definida como arquitetura não-negociável do
projeto — construída do zero, lado a lado com o app legado em `artifacts/` (Express + Vite), que
não foi tocado.

## Stack

- **Next.js 16** (App Router, TypeScript estrito, Turbopack)
- **Tailwind CSS v4** + **shadcn/ui** (estilo "new-york") + ícones Lucide
- **Postgres serverless: [Supabase](https://supabase.com)** — banco e storage no mesmo projeto,
  uma única credencial para provisionar. Driver `postgres` (postgres.js) via
  `drizzle-orm/postgres-js`, conectando na "Transaction pooler" do Supabase (Supavisor/PgBouncer)
  para não esgotar o limite de conexões diretas com as functions efêmeras da Vercel
  (`prepare: false` porque o pooler em modo transação não suporta prepared statements). O
  `proxy.ts` (convenção do Next 16 para middleware) sempre roda em runtime Node.js — nunca Edge —
  então reusa esse mesmo client TCP sem precisar de um driver HTTP separado (que a Neon tinha e a
  Supabase não).
- **ORM: Drizzle**, schema completo em `src/db/schema/`, migrations versionadas em
  `src/db/migrations/`
- **Autenticação própria**: sessões em banco (tabela `sessions`) + cookie `httpOnly`, senhas com
  bcrypt. Sem OAuth social (produto B2B, login por e-mail corporativo).
- **Upload de arquivos (KYC, produtos, banners)**: Supabase Storage (bucket público,
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) em produção; sem essas variáveis, cai para
  `public/uploads` em dev (nunca em produção — filesystem da Vercel não é persistente).
- **E-mail transacional**: Resend se `RESEND_API_KEY` estiver definida; caso contrário, loga no
  console (redefinição de senha, etc.).
- **Validação**: Zod, compartilhado entre formulário e server action.

## Setup

```bash
cd apps/web
cp .env.example .env.local
# preencha DATABASE_URL com a connection string do Supabase (Project Settings > Database >
# Connection string > "Transaction pooler"), e SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (Project
# Settings > API) para o upload de arquivos. Crie um bucket público chamado "seu-zuca-uploads"
# em Storage (ou outro nome, ajustando SUPABASE_STORAGE_BUCKET).
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
