# ROADMAP.md — Plano de Construção em Fases

Construa uma fase por vez. Ao final de cada fase: `next build` sem erros, migrations aplicando limpo, seed atualizado e um resumo do que foi feito + o que ficou pendente. Só avance com autorização do usuário.

Os prompts abaixo estão prontos para colar no Claude Code, um por sessão de trabalho.

---

## Fase 1 — Fundação: projeto, banco, autenticação e papéis

**Prompt:**

> Leia CLAUDE.md e SPEC.md. Inicie a Fase 1 do ROADMAP.md: crie o projeto Next.js (App Router, TypeScript, Tailwind, shadcn/ui), configure o Postgres serverless com ORM e migrations, e implemente o schema completo do banco conforme a seção "Modelo de Dados" do SPEC.md. Implemente autenticação por e-mail e senha com sessões, os 5 papéis, middleware de autorização por rota, e os fluxos: login, logout, redefinição de senha (logando o e-mail no console em dev), cadastro em duas etapas para comprador e fornecedor (incluindo upload de documentos de KYC), tela /aguardando-aprovacao e bloqueio de contas pendentes/suspensas. Crie o script de seed com as 9 categorias oficiais, as 17 unidades e uma conta de teste de cada papel. Layout base: header com logo, menu de categorias (placeholder), busca e área de login; footer institucional.

**Critérios de aceite:** consigo criar uma conta de comprador e uma de fornecedor, ambas caem em pendente; login com cada papel de teste redireciona para a área correta; rotas protegidas bloqueiam papéis errados no servidor.

---

## Fase 2 — Catálogo interno: categorias, unidades, produtos e moderação

**Prompt:**

> Leia CLAUDE.md, SPEC.md e ROADMAP.md. Inicie a Fase 2: implemente no painel admin as seções Categorias (CRUD com hierarquia, slug, unidade padrão e ícone Lucide), Unidades (CRUD) e Produtos (fila de moderação com abas Aguardando/Aprovados/Todos, aprovar/rejeitar com motivo). No lado do fornecedor, implemente a lista de produtos próprios e o formulário completo de criação/edição de produto (categoria obrigatória da árvore oficial, unidade da lista oficial, preço em centavos, upload de imagens, prazo de entrega, descrição). Produto novo ou com edição sensível volta para aguardando_aprovacao. Registre ações de moderação no audit_log.

**Critérios de aceite:** fornecedor cadastra produto → aparece na fila do admin → admin aprova → status ativo. Rejeição exibe motivo ao fornecedor.

---

## Fase 3 — Storefront público

**Prompt:**

> Leia CLAUDE.md, SPEC.md e ROADMAP.md. Inicie a Fase 3: implemente a home completa (carrossel de banners lendo do banco, selos de confiança, grade de categorias, três blocos de destaque, produtos em destaque, bloco de conversão), o mega menu de categorias com os atalhos, o catálogo /catalogo (filtros por categoria, busca, ordenação, paginação), a página de produto /produto/[slug] (galeria, dados do fornecedor, SKU, preço, estoque, prazo, descrição, avaliações aprovadas) e a vitrine pública do fornecedor /fornecedor/[slug]. Inclua as páginas institucionais /quem-somos, /como-funciona e /seja-fornecedor com conteúdo placeholder bem escrito, e a página 404. Visitantes veem "Entrar para comprar" / "Criar conta B2B" no lugar do botão de compra. Apenas produtos aprovados e de fornecedores aprovados aparecem publicamente. Atualize o seed com ~20 produtos realistas distribuídos nas categorias e 5 banners.

**Critérios de aceite:** navegação completa como visitante; nenhum produto pendente ou de fornecedor suspenso vaza no catálogo; Lighthouse sem erros graves de acessibilidade.

---

## Fase 4 — Carrinho, checkout, pagamentos e pedidos

**Prompt:**

> Leia CLAUDE.md, SPEC.md e ROADMAP.md. Inicie a Fase 4: implemente carrinho persistido por comprador (com validação de estoque, quantidade mínima e múltiplo por categoria — inclua também a seção admin "Qtd. Mínimas"), a divisão do checkout em um pedido por fornecedor sob um checkout_group, o fluxo de checkout com endereço e frete, e a integração com Mercado Pago (PIX, boleto e cartão) com webhook de confirmação. Implemente a máquina de estados do pedido conforme SPEC.md, com linha do tempo de eventos, cálculo e congelamento da comissão por pedido (percentual vindo de settings), páginas /pedidos e /pedidos/[id] do comprador, aba Pedidos do painel do fornecedor (atualizar status e rastreio) e a mensagem de carrinho bloqueado para papéis não-compradores. Adicione /favoritos (wishlist). Escreva testes Vitest para: cálculo de comissão, validação de mínimo/múltiplo e transições de status.

**Critérios de aceite:** compra completa em sandbox do Mercado Pago com PIX; webhook muda o pedido para pago; carrinho com itens de 2 fornecedores gera 2 pedidos; testes passando.

---

## Fase 5 — Painéis: fornecedor, admin e suporte

**Prompt:**

> Leia CLAUDE.md, SPEC.md e ROADMAP.md. Inicie a Fase 5: complete o painel do fornecedor (indicadores de pedidos e faturamento, aba Analytics com gráficos Recharts por período, aba Relatórios com exportação dos próprios dados). No admin, implemente Visão Geral, Usuários (com filtros, aprovação/rejeição de cadastros, visualização de documentos KYC, suspensão e redefinição de senha), Criar Fornecedor (com aviso sobre a senha), Usuários Internos (com último acesso) e a aba Analytics completa conforme SPEC.md (períodos 7d/30d/3m/6m, alertas operacionais, indicadores de qualidade, ecossistema; exibir "--" sem dados). Implemente o painel /suporte somente leitura com suas 4 abas, garantindo no servidor que o papel suporte não executa mutações.

**Critérios de aceite:** admin aprova um cadastro pendente de ponta a ponta; suporte navega mas qualquer tentativa de mutação é rejeitada no servidor; analytics refletem os pedidos de teste da Fase 4.

---

## Fase 6 — Banners, avaliações, relatórios e polimento

**Prompt:**

> Leia CLAUDE.md, SPEC.md e ROADMAP.md. Inicie a Fase 6: implemente a seção admin Banners (CRUD com drag-and-drop de ordenação, ativar/desativar) alimentando o carrossel da home; o fluxo de avaliações (comprador com pedido entregue avalia o produto → fila de moderação no admin → exibição na página do produto e nota média); e a seção Relatórios do admin com os 7 relatórios exportáveis em PDF, Excel e CSV por período. Finalize com uma passada de polimento: estados de loading e vazio em todas as listas, tratamento de erros consistente, revisão de responsividade mobile, e-mails transacionais dos eventos principais e atualização do README com instruções de setup, variáveis de ambiente e deploy na Vercel.

**Critérios de aceite:** review só é possível com pedido entregue; os 3 formatos de exportação abrem corretamente; deploy de preview na Vercel funcional.

---

## Backlog pós-MVP (não implementar sem pedido explícito)

- Sistema de cotação (RFQ) citado no marketing da home.
- Repasses automáticos a fornecedores (split de pagamento do Mercado Pago).
- Cálculo de frete integrado (Correios/transportadoras).
- Notificações in-app e centro de mensagens comprador↔fornecedor.
- Promoções, cupons e "Mais vendidos" com ranking real.
