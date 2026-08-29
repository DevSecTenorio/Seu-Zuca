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
- Checkout: confirmação de endereço de entrega (endereço da empresa como padrão, com possibilidade de outro endereço), resumo dos itens, frete calculado pelo Motor de Frete e modalidade de entrega/retirada (ver §10 — Módulo LOG), total.
- Pagamento via **Stripe** (decisão revertida de Mercado Pago para Stripe, integração ainda não iniciada — ver §9): PIX, boleto e cartão. Confirmação assíncrona via webhook. Estados de pagamento: `aguardando_pagamento`, `pago`, `falhou`, `expirado`, `estornado`. Até o Stripe ser integrado, o checkout cria o pedido e para de forma limpa em `aguardando_pagamento`, sem chamar nenhum gateway real.
- Status do pedido: `aguardando_pagamento` → `pago` → `em_separacao` → `enviado` → `entregue`; ramificações: `cancelado`, `em_disputa`, `devolvido`. Fornecedor atualiza status operacionais (separação, envio com código de rastreio, entrega); comprador e admin podem abrir disputa/cancelamento conforme regras.
- Comissão: percentual da plataforma calculado sobre cada pedido no momento da criação (percentual configurável globalmente pelo admin; armazenar o percentual aplicado no pedido para histórico). Painéis exibem GMV (valor total dos pedidos) e receita de comissões.
- `/pedidos` lista os pedidos do comprador com status e totais; `/pedidos/[id]` mostra itens, pagamentos, linha do tempo de status e dados de entrega.

## 6. Painel do Fornecedor (`/fornecedor/painel`)

- Indicadores: número de pedidos, pedidos por mês, faturamento (líquido de comissão e bruto).
- Abas: **Pedidos** (lista com atualização de status e rastreio), **Analytics** (gráficos de vendas por período), **Relatórios** (exportação dos próprios dados), **Produtos**, **Logística** (cobertura de entrega e frete — ver §10, LOG-01 e LOG-02).
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

## 9. Decisões de Negócio Registradas

Log de decisões de negócio que não são óbvias a partir do código e que substituem/complementam o texto das seções acima. Ordem cronológica; a decisão mais recente sobre um tema é a que vale.

| Data | Decisão | Onde se aplica |
|---|---|---|
| 2026-08-25 | A **base de cálculo da comissão** da plataforma sobre um pedido — apenas o valor da mercadoria, ou mercadoria + frete — é **configurável pelo admin em Settings**, não fixa no código. Vale para todos os pedidos criados após a mudança de configuração; pedidos já criados mantêm a base vigente no momento em que a comissão foi congelada (mesmo princípio do percentual, §5). Expor no mesmo mecanismo de configuração usado hoje pelo percentual de comissão (`lib/settings.ts` / tabela `setting`). | §5 (Comissão), §10 (LOG-02) |
| 2026-08-29 | A integração de pagamento com **Mercado Pago foi pausada** e a decisão revertida para **Stripe**, numa etapa futura ainda não iniciada. Não configurar, testar, validar chaves nem expandir o código do Mercado Pago existente (`lib/mercadopago.ts`, webhook, `checkout-form.tsx`, etc.) até essa etapa ser priorizada — o código fica como está, sem ser removido, para eventual reaproveitamento/generalização quando o Stripe for integrado. Até lá, o checkout deve continuar funcionando de ponta a ponta (carrinho, frete, endereço, criação do pedido) e parar de forma limpa em `aguardando_pagamento`, sem depender de nenhum gateway real. | §5 (Carrinho, Checkout e Pedidos), §11 (payment) |

## 10. Logística e Frete — Módulo LOG, Onda 1

Primeira onda do módulo de logística e frete. Numeração `LOG-01` a `LOG-10` é do backlog completo do módulo; **apenas LOG-01 a LOG-05 fazem parte desta onda** e devem ser implementados nesta ordem (cada um com build e testes antes do próximo). LOG-06 a LOG-10 ficam registrados como backlog no final desta seção — dependem de um módulo de Obras/Centro de Custo e de um mecanismo de repasse ao fornecedor que ainda não existem no produto, e não devem ser implementados nesta onda.

Fora de escopo do módulo inteiro (todas as ondas): qualquer forma de "carrinho comparativo" ou cotação — o texto de marketing da home que menciona cotação (§4, Home) continua sendo apenas texto, sem funcionalidade por trás.

### LOG-01 — Cobertura de entrega por fornecedor e produto

- Novo CRUD na aba **Logística** do painel do fornecedor (`/fornecedor/painel`) para declarar a área de entrega, por uma das formas: lista/faixa de CEP, município (código IBGE), ou raio em km a partir de uma origem.
- Exceção possível no nível de produto ou categoria (um produto pode ter cobertura diferente da cobertura padrão do fornecedor).
- Áreas de exclusão explícitas (CEP/município/raio que o fornecedor recusa mesmo dentro de uma cobertura mais ampla).
- Efeito no catálogo e checkout: quando o comprador tem um endereço de entrega definido, produtos cujo fornecedor não cobre aquele endereço **simplesmente não aparecem** — sem aviso, sem produto desabilitado visível.
- Importação de malha de CEPs via planilha (upload), com uma **tela de simulação** mostrando o que mudaria (quantos CEPs entram/saem de cobertura) antes de confirmar a aplicação.
- Mudança de cobertura não é retroativa: pedidos já confirmados não são afetados mesmo que a cobertura do fornecedor mude depois.

### LOG-02 — Motor de cálculo de frete

- Novo CRUD na aba **Logística** do painel do fornecedor para parâmetros de frete: valor fixo, R$/km, R$/kg, R$/km×kg, e piso mínimo.
- Faixas de distância e de peso com valores distintos por faixa (tabela, não fórmula única).
- Peso cubado: usa o maior entre peso real e peso volumétrico (fator de cubagem configurável pelo fornecedor).
- Adicionais configuráveis por fornecedor, aplicáveis por pedido: descarga, munck, ajudante, andar (sem elevador), fim de semana, difícil acesso, pedágio.
- Frete grátis condicional por valor mínimo do pedido e/ou peso máximo, configurável por fornecedor.
- No checkout, a composição do frete é exibida de forma auditável: o comprador vê de onde vem cada valor (base por distância/peso, cada adicional aplicado, desconto de frete grátis se houver) — nunca só o total.
- Base de cálculo da comissão sobre o frete: ver decisão em §9.

### LOG-03 — Cálculo de distância e geocodificação

- Converte o CEP do endereço (origem do fornecedor e destino do comprador) em coordenadas, e calcula a **distância real de rota** (não linha reta) entre os dois pontos, para uso pelo Motor de Frete (LOG-02) e pela Cobertura por raio (LOG-01).
- Cache por par origem-destino, para não recalcular a mesma rota repetidamente.
- Fallback: se o serviço de rotas falhar, usar distância geodésica (linha reta) com um fator de correção configurável, em vez de falhar o cálculo de frete inteiro.
- CEP genérico de cidade do interior (sem numeração detalhada) resolve para o centroide do município.
- O comprador pode ajustar manualmente o ponto exato no mapa a partir do endereço geocodificado; essa coordenada ajustada passa a valer para os pedidos futuros feitos com aquele endereço (fica salva junto ao endereço, não é perguntada de novo a cada pedido).
- Escolha de provedor de geocoding/rotas: decidida durante a implementação deste item (ver anotação de implementação abaixo — requer avaliação de cobertura/custo para uso comercial no Brasil e, dependendo do provedor, uma chave de API do usuário).

### LOG-04 — Consolidação de frete no carrinho multi-fornecedor

- Quando o carrinho tem itens de fornecedores diferentes, o frete é calculado **por fornecedor** (um cálculo de frete por fornecedor, nunca ratear o valor de um frete entre os itens de fornecedores diferentes).
- Checkout mostra: custo total (soma de produtos + soma de todos os fretes) e o número de entregas separadas que o pedido vai gerar.
- Sugestão de consolidação: se trocar o fornecedor de um item do carrinho reduzir o número de entregas/fretes separados, o checkout mostra essa sugestão ao comprador (não troca automaticamente).

### LOG-05 — Modalidade de entrega e retirada

- No checkout, o comprador escolhe entre: entrega pelo fornecedor, retirada em centro de distribuição, ou transportadora contratada.
- Tela de retirada mostra: endereço do centro de distribuição, horário de funcionamento, prazo de disponibilização (quando o pedido fica pronto para retirar) e documento exigido na retirada.
- Retirada gera um código/senha de retirada de **uso único**, apresentado ao comprador e conferido no momento da retirada.

### Backlog do módulo (fora desta onda — não implementar agora)

`LOG-06` a `LOG-10`: itens do módulo de Logística e Frete que dependem de um módulo de Obras/Centro de Custo (ainda não existe no produto) e de um mecanismo de repasse ao fornecedor (ainda não existe no produto). Ficam registrados aqui como backlog até que esses dois pré-requisitos existam; escopo detalhado de cada um a definir quando essa fase for priorizada.

## 11. Modelo de Dados (entidades centrais)

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
- **payment**: pedido/grupo, método (PIX, boleto, cartão), status, IDs do gateway de pagamento (colunas atualmente nomeadas para o Mercado Pago — `mp_payment_id`/`mp_preference_id` — a generalizar quando o Stripe for integrado, ver §9), payload de webhook.
- **review**: produto, comprador, pedido de origem, nota, comentário, status de moderação.
- **banner**: título, destaque, subtítulo, imagem, link, ordem, ativo.
- **wishlist_item**: comprador + produto.
- **audit_log**: quem, quando, ação, entidade, dados antes/depois (para ações administrativas e mudanças de status).
- **setting**: chave/valor para configurações globais (ex.: percentual de comissão, base de cálculo da comissão — mercadoria ou mercadoria + frete).
- **delivery_coverage_area**: fornecedor (e opcionalmente produto/categoria como exceção), tipo (faixa de CEP, município IBGE, raio em km), valores do tipo escolhido, se é área de cobertura ou de exclusão.
- **freight_rule**: fornecedor, tipo de cobrança (fixo, R$/km, R$/kg, R$/km×kg), piso mínimo, fator de cubagem.
- **freight_range**: regra de frete, faixa de distância e/ou peso, valor da faixa.
- **freight_surcharge**: fornecedor, tipo de adicional (descarga, munck, ajudante, andar, fim de semana, difícil acesso, pedágio), valor.
- **pickup_location**: fornecedor, endereço, horário de funcionamento, prazo de disponibilização, documento exigido.
- **pickup_code**: pedido, código de uso único, usado/não usado, data de uso.
- **address**: (extensão) latitude/longitude geocodificadas e flag de ajuste manual pelo comprador no mapa (ver LOG-03).
- **route_distance_cache**: par origem-destino (coordenadas ou CEPs), distância de rota calculada, data de cálculo, se veio do provedor de rotas ou do fallback geodésico.
