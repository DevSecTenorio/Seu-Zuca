# SPEC.md — Especificação Funcional do Seu Zuca

Marketplace B2B de materiais de construção, exclusivo para pessoas jurídicas. Este documento descreve o que o sistema deve fazer. As restrições técnicas estão em `CLAUDE.md` e a ordem de construção em `ROADMAP.md`.

## 1. Papéis de Usuário

| Papel | Descrição |
|---|---|
| Visitante | Navega na loja e vê produtos. Não compra. |
| Comprador | Empresa que compra. Único papel com carrinho e checkout. Requer aprovação. |
| Fornecedor | Empresa que vende. Cadastra produtos (sujeitos a moderação), acompanha pedidos e faturamento. Requer aprovação. |
| Suporte | Equipe interna. Consulta compradores, fornecedores e pedidos. Somente leitura. |
| Admin | Equipe interna. Acesso total: moderação, configurações, relatórios. |

## 2. Autenticação e Onboarding

- Login em `/login` com e-mail corporativo e senha. Link "Esqueci minha senha" com fluxo de redefinição por e-mail (token com expiração).
- Cadastro público em `/cadastro`: o visitante escolhe entre conta de **Comprador** ou **Fornecedor**.
- Cada fluxo de cadastro tem duas etapas:
  1. **Dados da empresa**: razão social, nome fantasia, CNPJ (validar dígitos), e-mail, telefone, ramo de atividade, endereço completo, senha.
  2. **Documentos**: upload de documentação (cartão CNPJ, contrato social etc.) para análise.
- Após o cadastro, a conta fica com status `pendente` e o usuário é direcionado para `/aguardando-aprovacao`, uma tela de espera explicando o processo.
- Admin aprova ou rejeita cadastros pelo painel. Aprovação/rejeição dispara e-mail ao usuário.
- Admin pode suspender contas (status `suspenso`) e redefinir senhas.
- Admin pode criar um fornecedor já aprovado diretamente (tela "Criar Fornecedor"), definindo dados da empresa e credenciais iniciais; a interface avisa que a senha gerada não poderá ser recuperada depois.

## 3. Mapa de Rotas

### Públicas / institucionais
`/` (home), `/login`, `/cadastro` (escolha do tipo), `/cadastro/comprador`, `/cadastro/fornecedor`, `/aguardando-aprovacao`, `/catalogo`, `/produto/[slug]`, `/fornecedor/[slug]` (vitrine pública do fornecedor), `/quem-somos`, `/como-funciona`, `/seja-fornecedor`, página 404.

### Comprador autenticado
`/carrinho`, `/checkout`, `/pagamento`, `/pedidos`, `/pedidos/[id]`, `/favoritos` (wishlist), `/minha-conta`, `/minha-conta/trocar-senha`.

### Fornecedor autenticado
`/fornecedor/painel` (dashboard), `/fornecedor/produtos/novo` e `/fornecedor/produtos/[id]/editar` (formulário de produto).

### Interno
`/admin` (painel com 11 seções via sidebar), `/suporte` (painel do papel Suporte).

## 4. Loja (Storefront)

### Home (`/`)
- Carrossel de banners promocionais no topo, gerenciado pelo admin (ordem, ativo/inativo, título, destaque, subtítulo, imagem, link).
- Faixa de selos de confiança: entrega em todo o Brasil, preços exclusivos PJ, compra segura, exclusivo pessoa jurídica.
- Grade de categorias com ícones (Lucide).
- Três blocos de destaque temáticos (ex.: atacado de cimento/estrutura com pedido mínimo, acabamento e pisos, infraestrutura hidráulica e elétrica).
- Seção "Produtos em destaque".
- Bloco final de conversão convidando a criar conta B2B gratuita. (O texto pode citar "sistema de cotação", mas essa funcionalidade está fora do escopo do MVP.)

### Navegação
- Menu "Todas as Categorias" abre mega menu com as 9 categorias oficiais: **Argamassa, Estrutura, Acabamento, Instalações, Ferramentas, Hidráulica, Elétrica, Madeira, Alvenaria** — mais atalhos: Todos os produtos, Lançamentos, Promoções, Mais vendidos, e link "Vender no Seu Zuca" (→ `/seja-fornecedor`).

### Catálogo (`/catalogo`)
- Lista de produtos aprovados com filtro por categoria (abas horizontais), busca por texto e ordenação (padrão: mais recentes; incluir preço e mais vendidos).
- Paginação via query params (`page`, `limit`).
- Cartão de produto: imagem, categoria oficial, nome, preço por unidade de venda, status de estoque.

### Página de produto (`/produto/[slug]`)
- Breadcrumb, nome e link do fornecedor, SKU, preço por unidade, estoque disponível, prazo de entrega, selos de compra segura, descrição rica (regras comerciais como pedido mínimo e frete grátis acima de certo volume podem constar na descrição).
- Galeria de imagens.
- Avaliações aprovadas de compradores (nota média + comentários).
- Visitante ou papel sem carrinho: botões "Entrar para comprar" e "Criar conta B2B" no lugar do botão de compra.
- Comprador aprovado: seletor de quantidade (respeitando mínimo e múltiplo da categoria) e botão adicionar ao carrinho; botão de favoritar.

### Visibilidade de preço

Preços de produtos só são visíveis para usuários com papel Comprador e status `aprovado`.
Nenhum outro público — visitante não autenticado, conta pendente/rejeitada/suspensa, Fornecedor,
Suporte ou Admin — vê o valor do preço na exibição do storefront (cartões de produto no catálogo,
resultados de busca, página de produto, vitrine do fornecedor, wishlist, blocos de "produtos em
destaque" na home). No lugar do valor, exibir "Faça login para ver o preço" com link para
`/login`, mantendo as demais informações do produto (nome, categoria, imagem, estoque) visíveis
normalmente. A checagem acontece no servidor: a query que busca os produtos não inclui o campo de
preço na resposta quando o usuário não for um comprador aprovado, em vez de buscar o preço e
apenas escondê-lo no cliente.

## 5. Carrinho, Checkout e Pedidos

- Jornada: carrinho → checkout → pagamento → confirmação → acompanhamento em `/pedidos`.
- Carrinho: exclusivo do comprador (persistido em banco, por usuário). Demais papéis autenticados veem mensagem "Administradores não possuem carrinho de compras" (adaptar por papel). Validação de estoque, quantidade mínima e múltiplo por categoria ao adicionar e ao finalizar.
- Um carrinho pode conter itens de múltiplos fornecedores; ao finalizar, o pedido é dividido em um pedido por fornecedor (padrão marketplace), todos vinculados a um mesmo grupo de checkout.
- Checkout: confirmação de endereço de entrega (endereço da empresa como padrão, com possibilidade de outro endereço), resumo dos itens, frete (MVP: valor informado por fornecedor por pedido ou tabela simples — decidir e documentar), total.
- Pagamento via **Mercado Pago**: PIX, boleto e cartão. Confirmação assíncrona via webhook. Estados de pagamento: `aguardando_pagamento`, `pago`, `falhou`, `expirado`, `estornado`.
- Status do pedido: `aguardando_pagamento` → `pago` → `em_separacao` → `enviado` → `entregue`; ramificações: `cancelado`, `em_disputa`, `devolvido`. Fornecedor atualiza status operacionais (separação, envio com código de rastreio, entrega); comprador e admin podem abrir disputa/cancelamento conforme regras.
- Comissão: percentual da plataforma calculado sobre cada pedido no momento da criação (percentual configurável globalmente pelo admin; armazenar o percentual aplicado no pedido para histórico). Painéis exibem GMV (valor total dos pedidos) e receita de comissões.
- `/pedidos` lista os pedidos do comprador com status e totais; `/pedidos/[id]` mostra itens, pagamentos, linha do tempo de status e dados de entrega.

## 6. Painel do Fornecedor (`/fornecedor/painel`)

- Indicadores: número de pedidos, pedidos por mês, faturamento (líquido de comissão e bruto).
- Abas: **Pedidos** (lista com atualização de status e rastreio), **Analytics** (gráficos de vendas por período), **Relatórios** (exportação dos próprios dados), **Produtos**.
- Lista de produtos do fornecedor: categoria, preço, estoque, status (`ativo`, `aguardando_aprovacao`, `rejeitado`, `inativo`).
- Formulário de produto: nome, categoria (obrigatoriamente da árvore oficial), SKU, preço, unidade de venda (da lista oficial de unidades), estoque, prazo de entrega, descrição rica, imagens (upload). Ao criar ou editar campos sensíveis, o produto volta para a fila de moderação.

## 7. Painel Administrativo (`/admin`) — 11 seções

1. **Visão Geral**: cartões com compradores aprovados, fornecedores ativos, total de pedidos, GMV total, pedidos pendentes, comissões geradas.
2. **Usuários**: todas as contas com empresa, CNPJ, tipo, status e data de cadastro. Ações: aprovar, rejeitar, suspender, redefinir senha. Filtros: Todos, Pendentes, Aprovados, Fornecedores, Compradores, Suspensos. Visualização dos documentos de KYC enviados.
3. **Criar Fornecedor**: criação direta de fornecedor aprovado com credenciais iniciais.
4. **Usuários Internos**: gerencia contas Admin e Suporte, com descrição dos papéis na interface e coluna de último acesso.
5. **Categorias**: CRUD de categorias e subcategorias (categoria pai opcional), com slug, unidade de medida padrão e ícone Lucide. Seed inicial: as 9 categorias oficiais.
6. **Unidades**: CRUD das unidades de medida usadas no formulário de produto. Seed inicial com 17 unidades (ex.: unidade, caixa, saco, barra, metro, m², m³, litro, kg, tonelada, pacote, rolo, peça, par, jogo, galão, lata).
7. **Produtos**: fila de moderação com abas Aguardando, Aprovados, Todos. Ações: aprovar, rejeitar (com motivo), desativar.
8. **Banners**: CRUD do carrossel da home com reordenação por drag-and-drop, ativar/desativar, título, destaque, subtítulo, imagem e link.
9. **Qtd. Mínimas**: regras de pedido mínimo e múltiplo de compra por categoria (ex.: Cimento, mínimo 50, múltiplo 10). Aplicadas no carrinho e checkout.
10. **Avaliações**: fila de moderação de reviews de compradores (aprovar/rejeitar). Apenas compradores com pedido entregue do produto podem avaliar.
11. **Relatórios**: exportação por período em PDF, Excel e CSV, cobrindo 7 relatórios: saúde financeira (GMV, comissão, ticket médio); comissões e repasses por pedido; top fornecedores (volume, comissão, avaliação); qualidade por fornecedor (cancelamentos, avaliações); vendas por categoria; comportamento de compradores (recompra, LTV); novos cadastros no período.
12. *(Aba adicional)* **Analytics**: dashboard com filtro de período (7d, 30d, 3m, 6m) exibindo GMV, receita de comissões, comissão média, total de pedidos, ticket médio, gráfico de evolução financeira, ranking de fornecedores por receita, alertas operacionais (fornecedores mal avaliados, pedidos em disputa, comissões em atraso, taxa de cancelamento acima da meta, fornecedores inativos), indicadores de qualidade (avaliação média, taxa de devolução, taxa de cancelamento, tempo médio de entrega, NPS estimado) e dados do ecossistema (fornecedores ativos, compradores ativos, categorias ativas, produtos publicados). Exibir "--" quando não houver dados suficientes.

## 8. Painel de Suporte (`/suporte`)

Versão somente leitura do painel admin com abas: **Visão Geral** (contagens de compradores/fornecedores cadastrados e aprovados, total de pedidos e pendentes), **Fornecedores**, **Compradores** e **Relatórios**. A própria tela deixa claro que o papel Suporte consulta dados para atendimento sem alterar configurações.

## 9. Modelo de Dados (entidades centrais)

- **user**: e-mail, hash de senha, papel, status (`pendente`, `aprovado`, `rejeitado`, `suspenso`), último acesso.
- **company**: razão social, nome fantasia, CNPJ (único), telefone, ramo de atividade; vinculada ao user comprador/fornecedor.
- **address**: endereço da empresa e endereços de entrega.
- **kyc_document**: arquivos enviados no cadastro, com status de análise.
- **category**: nome, slug, categoria pai (opcional), unidade padrão, ícone, ativa.
- **unit**: nome, abreviação.
- **product**: fornecedor, nome, slug, SKU, categoria (FK obrigatória — nunca texto livre), preço em centavos, unidade de venda, estoque, prazo de entrega, descrição, status de moderação, imagens.
- **min_quantity_rule**: categoria, quantidade mínima, múltiplo.
- **cart / cart_item**: por comprador.
- **checkout_group**: agrupa os pedidos gerados num mesmo checkout.
- **order / order_item**: fornecedor, comprador, itens com preço congelado, frete, total, percentual e valor de comissão, status, código de rastreio; linha do tempo de status (`order_status_event`).
- **payment**: pedido/grupo, método (PIX, boleto, cartão), status, IDs do Mercado Pago, payload de webhook.
- **review**: produto, comprador, pedido de origem, nota, comentário, status de moderação.
- **banner**: título, destaque, subtítulo, imagem, link, ordem, ativo.
- **wishlist_item**: comprador + produto.
- **audit_log**: quem, quando, ação, entidade, dados antes/depois (para ações administrativas e mudanças de status).
- **setting**: chave/valor para configurações globais (ex.: percentual de comissão).
