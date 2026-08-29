# CLAUDE.md — Seu Zuca (Marketplace B2B de Materiais de Construção)

Este arquivo define as convenções e restrições do projeto. Leia também `SPEC.md` (especificação funcional completa) e `ROADMAP.md` (plano de fases). Trabalhe sempre dentro da fase atual indicada pelo usuário — não implemente funcionalidades de fases futuras sem ser solicitado.

## Contexto do Produto

Marketplace B2B exclusivo para pessoas jurídicas (CNPJ ativo) que conecta fornecedores de materiais de construção a compradores (construtoras, empreiteiras). A plataforma intermedia pedidos e retém comissão sobre cada venda. Cadastros de compradores e fornecedores passam por aprovação manual (KYC com envio de documentos). Produtos cadastrados por fornecedores passam por moderação do admin antes de ir ao catálogo público.

## Restrições de Arquitetura (não negociáveis)

- **Deploy: Vercel.** Toda a arquitetura deve ser compatível com serverless/edge da Vercel. Nada de servidores long-running, WebSockets persistentes próprios ou dependência de filesystem local em produção.
- **Banco: Postgres gerenciado serverless** (Neon ou Supabase — escolha um e justifique). Usar connection pooling adequado para serverless.
- **Framework: Next.js (App Router) com TypeScript**, full-stack (rotas de API/Server Actions no próprio projeto).
- **Pagamentos: Stripe** (a integração com Mercado Pago foi pausada — ver decisão em `SPEC.md` §9 — e revertida para Stripe, numa etapa futura ainda não iniciada). Suporte a PIX, boleto e cartão. Webhooks de confirmação obrigatórios. Chaves via variáveis de ambiente, nunca hardcoded. Até a etapa do Stripe ser priorizada, não configurar, testar nem expandir a integração com Mercado Pago; o checkout deve funcionar de ponta a ponta sem depender de nenhum gateway real, parando de forma limpa em `aguardando_pagamento`.
- **Upload de arquivos (imagens de produto, documentos de KYC, banners): Vercel Blob** ou storage do Supabase, conforme o banco escolhido.

## Escolhas Técnicas Recomendadas (pode ajustar com justificativa)

- ORM: Drizzle (bom fit com Postgres serverless) ou Prisma.
- Autenticação: Auth.js (NextAuth v5) com credenciais (e-mail corporativo + senha) e sessão em banco, OU implementação própria com cookies httpOnly + hash argon2/bcrypt. Sem OAuth social — o produto é B2B com login por e-mail corporativo.
- UI: Tailwind CSS + shadcn/ui (Radix por baixo) + ícones Lucide. Gráficos com Recharts.
- Dados no cliente: TanStack React Query onde houver interatividade; Server Components para leitura simples.
- Validação: Zod em todas as entradas de API e formulários (compartilhar schemas entre client e server).
- E-mail transacional (aprovação de conta, pedido confirmado, redefinição de senha): Resend ou similar. Em desenvolvimento, apenas logar no console.

## Papéis e Autorização

Cinco papéis: `admin`, `suporte`, `fornecedor`, `comprador` e visitante (não autenticado).

- Autorização SEMPRE verificada no servidor (middleware + verificação por rota/action). UI condicional é apenas conveniência, nunca segurança.
- Regras principais:
  - Visitante: navega no catálogo e vê produtos; botões de compra viram "Entrar para comprar" / "Criar conta B2B".
  - Comprador: único papel com carrinho e checkout. Contas admin/suporte/fornecedor NÃO possuem carrinho (exibir mensagem explicativa se tentarem acessar `/carrinho`).
  - Fornecedor: gerencia apenas os próprios produtos e vê apenas os próprios pedidos/faturamento.
  - Suporte: somente leitura sobre fornecedores, compradores e pedidos. Não altera configurações.
  - Admin: acesso total, incluindo moderação de usuários, produtos, avaliações e configurações.
- Novos compradores e fornecedores nascem com status `pendente` e só operam após aprovação do admin. Admin pode criar fornecedor já aprovado diretamente.

## Convenções de Código

- TypeScript estrito (`strict: true`). Sem `any` implícito.
- Estrutura de pastas por domínio dentro de `src/`: `app/` (rotas), `components/`, `lib/` (utilitários, clientes), `server/` (lógica de negócio, acesso a dados), `db/` (schema e migrations).
- Nomes de rotas públicas em português (ex.: `/catalogo`, `/produto/[slug]`, `/cadastro`, `/carrinho`), conforme o mapa de rotas do `SPEC.md`. Código (variáveis, funções, tabelas) em inglês.
- Valores monetários sempre em centavos (inteiros) no banco e na API. Formatação BRL apenas na camada de apresentação.
- Migrations versionadas no repositório. Incluir script de seed com dados realistas (categorias oficiais, unidades, alguns produtos e contas de teste de cada papel).
- Toda mutação relevante (aprovação, suspensão, mudança de status de pedido) registra em uma tabela de auditoria (`audit_log`).

## Qualidade

- A cada fase concluída, o projeto deve buildar (`next build`) sem erros e as migrations devem aplicar limpo em banco vazio.
- Testes: no mínimo, testes de unidade para regras de negócio críticas (cálculo de comissão, quantidade mínima/múltiplo por categoria, transições de status de pedido) com Vitest.
- Acessibilidade básica: formulários com labels, navegação por teclado nos menus, contraste adequado.
- Não commitar segredos. Manter `.env.example` atualizado a cada variável nova.

## O que NÃO fazer

- Não implementar o "sistema de cotação" mencionado no marketing da home — está fora do escopo do MVP (apenas deixar o texto na home como está).
- Não criar painéis ou telas fora do mapa de rotas do `SPEC.md` sem alinhar antes.
- Não usar campo de texto livre para categoria de produto: categoria é sempre uma referência à árvore oficial (isso corrige uma inconsistência do sistema original).
