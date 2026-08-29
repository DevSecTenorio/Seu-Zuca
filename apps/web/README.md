# Seu Zuca — Web (Next.js)

Marketplace B2B de materiais de construção, exclusivo para pessoas jurídicas. Ver `../../CLAUDE_1.md`
(renomeie/copie para `CLAUDE.md` na raiz) e `../../SPEC.md` na raiz do monorepo para o contexto
completo do produto e das convenções técnicas. Este pacote (`apps/web`) é a implementação em
Next.js — construída do zero, lado a lado com o app legado em `artifacts/` (Express + Vite), que
não foi tocado.

## Stack

- **Next.js 16** (App Router, TypeScript estrito, Turbopack)
- **Tailwind CSS v4** + **shadcn/ui** (estilo "new-york") + ícones Lucide, gráficos com Recharts
- **Postgres serverless: [Supabase](https://supabase.com)** — banco e storage no mesmo projeto,
  uma única credencial para provisionar. Driver `postgres` (postgres.js) via
  `drizzle-orm/postgres-js`, conectando na "Transaction pooler" do Supabase (Supavisor/PgBouncer)
  para não esgotar o limite de conexões diretas com as functions efêmeras da Vercel
  (`prepare: false` porque o pooler em modo transação não suporta prepared statements). O
  `proxy.ts` (convenção do Next 16 para middleware) sempre roda em runtime Node.js — nunca Edge —
  então reusa esse mesmo client TCP sem precisar de um driver HTTP separado.
- **ORM: Drizzle**, schema completo em `src/db/schema/`, migrations versionadas em
  `src/db/migrations/`
- **Autenticação própria**: sessões em banco (tabela `sessions`) + cookie `httpOnly`, senhas com
  bcrypt. Sem OAuth social (produto B2B, login por e-mail corporativo).
- **Upload de arquivos (KYC, produtos, banners)**: Supabase Storage (bucket público,
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) em produção; sem essas variáveis, cai para
  `public/uploads` em dev (nunca em produção — filesystem da Vercel não é persistente).
- **Pagamentos: Mercado Pago** (Checkout API) — PIX e boleto via criação direta de pagamento
  (QR code / código de barras exibidos em `/pagamento`), cartão via Checkout Pro (redirect
  hospedado pela Mercado Pago). Webhook em `/api/webhooks/mercadopago` com validação de
  assinatura HMAC.
- **E-mail transacional**: Resend se `RESEND_API_KEY` estiver definida; caso contrário, loga no
  console. Disparado em: aprovação/rejeição de cadastro, confirmação de pagamento e toda mudança
  de status de pedido.
- **Exportação de relatórios**: CSV (nativo), Excel (`exceljs`), PDF (`pdf-lib` — deliberadamente
  não `pdfkit`, que lê arquivos de fonte do disco em tempo de execução e é frágil sob bundlers
  serverless; `pdf-lib` embute tudo em memória).
- **Testes**: Vitest para regras de negócio puras (comissão, quantidade mínima/múltiplo, máquina
  de estados do pedido) — `src/lib/*.test.ts`.
- **Validação**: Zod, compartilhado entre formulário e server action.

## Setup

```bash
cd apps/web
cp .env.example .env.local
```

Preencha `.env.local` (ver tabela completa de variáveis abaixo). No mínimo para rodar localmente:
`DATABASE_URL`. Todo o resto tem fallback de desenvolvimento (uploads em `public/uploads`,
e-mails no console, checkout sem gateway real configurado).

### Banco de dados local — temporário

`DATABASE_URL` aponta oficialmente para o Supabase em produção (ver seção "Banco de dados"
abaixo), mas enquanto esse projeto Supabase não está conectado, o ambiente de desenvolvimento
usa um Postgres local. A aplicação não sabe (nem precisa saber) a diferença — ela só lê
`DATABASE_URL` como uma connection string Postgres genérica, sem depender de nada exclusivo do
Supabase (RLS, Supabase Auth, etc.), então trocar para a connection string do Supabase depois é
só editar `apps/web/.env.local`, sem mudar código.

**Setup atual desta máquina**: um role e banco `seuzuca` dedicados foram criados num Postgres 17
já instalado nativamente (não Docker — ver abaixo), para não interferir em outros projetos que
usam essa mesma instância:
`DATABASE_URL=postgresql://seuzuca:seuzuca_dev_password@localhost:5432/seuzuca`.

**Opção Docker (`docker-compose.yml` na raiz do monorepo)**: para quem não tem um Postgres local
já rodando, ou preferir isolamento total, o compose sobe um Postgres 16 dedicado.

```bash
# na raiz do monorepo
docker compose up -d      # sobe o Postgres em background (porta 5433 — não 5432, para não
                           # conflitar com um Postgres nativo já em uso nesta máquina)
docker compose down       # derruba o container (mantém os dados no volume)
docker compose down -v    # derruba e apaga o volume (reset completo do banco local)
```

Se optar pelo Docker, ajuste `apps/web/.env.local` para
`DATABASE_URL=postgresql://seuzuca:seuzuca_dev_password@localhost:5433/seuzuca` (mesmas
credenciais do compose, porta diferente).

Em qualquer um dos dois casos, depois de o banco estar de pé: `db:migrate` e `db:seed` (ver
comandos abaixo).

**Antes do deploy**, troque `DATABASE_URL` para a connection string real do Supabase e rode as
migrations contra ela — nenhuma das opções de banco local acima deve ser usada em produção.

Da raiz do monorepo (o workspace pnpm cobre `apps/*`):

```bash
pnpm install
pnpm --filter @workspace/web db:generate   # gera migrations a partir do schema (já rodado)
pnpm --filter @workspace/web db:migrate    # aplica as migrations no banco configurado em DATABASE_URL
pnpm --filter @workspace/web db:seed       # categorias, unidades, contas de teste, produtos, banners
pnpm --filter @workspace/web dev           # http://localhost:3000
```

## Variáveis de ambiente

Ver `.env.example` para os comentários completos (onde encontrar cada valor no respectivo
dashboard). Resumo:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | Connection string do Supabase (Transaction pooler, porta 6543) |
| `NEXT_PUBLIC_APP_URL` | Sim | URL pública do app (usada em links de e-mail e `back_urls`/`notification_url` do Mercado Pago) |
| `SUPABASE_URL` | Não* | Projeto Supabase, para upload de arquivos |
| `SUPABASE_SERVICE_ROLE_KEY` | Não* | Chave service role — só server-side, nunca no client |
| `SUPABASE_STORAGE_BUCKET` | Não | Nome do bucket (padrão `seu-zuca-uploads`) |
| `RESEND_API_KEY` | Não* | Envio real de e-mail transacional |
| `EMAIL_FROM` | Não | Remetente dos e-mails |
| `MERCADOPAGO_ACCESS_TOKEN` | Não* | Habilita pagamentos reais (sandbox ou produção) |
| `MERCADOPAGO_WEBHOOK_SECRET` | Não* | Valida a assinatura do webhook — obrigatória em produção |

\* Sem essas variáveis o app funciona em modo de desenvolvimento com fallback (ver Stack acima),
mas **produção real exige todas elas**.

**Pendência conhecida — `EMAIL_FROM`**: o domínio `seuzuca.com.br` ainda não está verificado no
Resend (resend.com/domains), então enviar com `EMAIL_FROM="Seu Zuca <no-reply@seuzuca.com.br>"`
retorna 403 ("domain is not verified"). Como fallback temporário de desenvolvimento, `.env.local`
está com `EMAIL_FROM=onboarding@resend.dev` (remetente sandbox do Resend) — mas esse sandbox só
entrega para o e-mail da própria conta Resend, nunca para destinatários arbitrários, então nem
todo fluxo de e-mail real dá pra testar localmente dessa forma. **Assim que o domínio for
verificado no Resend, troque `EMAIL_FROM` de volta para um endereço `@seuzuca.com.br`** (aqui e
nas env vars da Vercel) — sem essa troca, e-mails reais para usuários (aprovação de conta,
redefinição de senha) vão falhar em produção.

## Banco de dados

Schema completo (23 tabelas) cobrindo toda a seção "Modelo de Dados" do SPEC.md.

- `src/db/schema/*.ts` — schema Drizzle, um arquivo por domínio
- `src/db/migrations/` — SQL gerado, versionado no repositório
- `src/db/seed.ts` — idempotente (usa `onConflictDoNothing`/checagem por e-mail), pode rodar
  várias vezes sem duplicar dados; inclui 3 fornecedores, 24 produtos, 5 banners e 2 pedidos de
  exemplo (um entregue, um em separação)

### Contas de teste (após `db:seed`)

Senha de todas: `Teste@123`

| Papel | E-mail | Status |
|---|---|---|
| Admin | admin@seuzuca.com.br | aprovado |
| Suporte | suporte@seuzuca.com.br | aprovado |
| Fornecedor | fornecedor@seuzuca.com.br | aprovado |
| Fornecedor | fornecedor2@seuzuca.com.br | aprovado |
| Fornecedor | fornecedor3@seuzuca.com.br | aprovado |
| Comprador | comprador@seuzuca.com.br | aprovado |

Para testar o fluxo de aprovação pendente, cadastre uma nova conta em `/cadastro/comprador` ou
`/cadastro/fornecedor` — ela nasce com status `pendente` e cai em `/aguardando-aprovacao`.

## Autorização

`src/proxy.ts` (convenção que substitui `middleware.ts` no Next 16) bloqueia rotas por papel e por
status de conta no servidor, antes de qualquer render. Toda action/rota sensível também revalida
com `requireUser`/`requireApprovedUser` (`src/lib/auth/require-user.ts`) — defesa em profundidade,
já que autorização client-side nunca é a fonte da verdade. Nenhuma server action de mutação aceita
o papel `suporte`; o painel de suporte (`/suporte`) só importa consultas de leitura.

## Testando pagamentos (Mercado Pago)

1. Crie uma aplicação em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers)
   e pegue as credenciais de teste (sandbox).
2. Preencha `MERCADOPAGO_ACCESS_TOKEN` com o access token de teste.
3. Configure a notificação webhook apontando para
   `https://<seu-domínio>/api/webhooks/mercadopago` e copie o segredo gerado para
   `MERCADOPAGO_WEBHOOK_SECRET`. Em desenvolvimento local, use um túnel (ngrok, Cloudflare Tunnel)
   para expor `localhost:3000`.
4. Sem essas variáveis, o checkout continua funcionando (pedido é criado), mas `/pagamento` avisa
   que o Mercado Pago não está configurado em vez de mostrar QR code/boleto/redirect.

## Deploy na Vercel

1. Importe o repositório na Vercel, apontando o **Root Directory** para `apps/web`.
2. Configure todas as variáveis de ambiente da tabela acima em Project Settings → Environment
   Variables (Production e Preview).
3. Build command e output ficam nos padrões do Next.js (a Vercel detecta automaticamente); não é
   necessário configurar nada extra.
4. Antes do primeiro deploy, aplique as migrations no banco de produção:
   `DATABASE_URL=<produção> pnpm --filter @workspace/web db:migrate` (rode localmente, apontando
   para o banco de produção, ou via um passo de CI).
5. Rode o seed **apenas em ambientes novos** (`db:seed` é idempotente, mas cria contas de teste
   com senha conhecida — não rode em produção com dados reais sem revisar `src/db/seed.ts`
   primeiro).
6. No dashboard do Mercado Pago, aponte o webhook para a URL de produção
   (`https://<seu-domínio>/api/webhooks/mercadopago`).

## Comandos úteis

```bash
pnpm --filter @workspace/web build       # next build
pnpm --filter @workspace/web lint        # eslint
pnpm --filter @workspace/web test        # vitest run
pnpm --filter @workspace/web db:studio   # Drizzle Studio
```

## Limitações conhecidas do MVP

- Frete: regra simples fixa/grátis-acima-de-limite por pedido (`src/lib/shipping.ts`) — sem
  integração com transportadoras (backlog pós-MVP, ver `../../ROADMAP.md`).
- Sistema de cotação (RFQ) citado no texto de marketing da home **não** é implementado, por
  decisão explícita do escopo (CLAUDE.md).
- Repasses automáticos a fornecedores (split de pagamento) não são feitos — comissão é calculada
  e registrada, mas o repasse em si é operação manual/futura.
