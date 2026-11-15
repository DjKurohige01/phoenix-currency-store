# Guia Oficial — PhoenixStore (Loja de Currency, Itens, Services, 3 Perfis & Supabase)

Este guia explica toda a estrutura da **PhoenixStore — Loja de Currency, Itens & Services** e como funcionam os **3 perfis de usuários (`Cliente`, `Vendedor` e `Administrador`)**, a **Ponte de Meio de Pagamento**, a **Página de Pós-Compra com Chat Direto** e o banco de dados **Supabase**.

---

## 1. Arquivos Principais do Projeto

- [`index.html`](./index.html) — Página principal da loja com o Catálogo (PoE 2, PoE 1 e futuros jogos), Carrinho, Barra de Troca Rápida de Perfil e Painéis do Vendedor e Administrador.
- [`pos-compra.html`](./pos-compra.html) — Página dedicada de **Pós-Compra**, para onde o cliente é encaminhado automaticamente após confirmar o pagamento. Exibe o agradecimento, status em tempo real da entrega em 4 etapas e o **Chat Direto com o Vendedor logado ou Administrador**.
- [`supabase-schema.sql`](./supabase-schema.sql) — Script SQL completo com todas as tabelas PostgreSQL (`profiles`, `products`, `payment_settings`, `orders`, `order_messages`), políticas de segurança **Row Level Security (RLS)**, limites de caracteres contra injeção de scripts e ativação do **Supabase Realtime**.
- [`phoenix-backend.js`](./phoenix-backend.js) — Motor de autenticação, controle de permissões por perfil, sanitização anti-XSS, ponte de pagamento e chat em tempo real.
- [`phoenix-panels.js`](./phoenix-panels.js) — Interface dos modais de Login/Cadastro (sem cartão), Painel do Vendedor, Painel Supremo do Administrador e Checkout.
- [`catalog-config.js`](./catalog-config.js) — Catálogo base de Jogos, Ligas, Categorias e Produtos com ícones oficiais em alta qualidade (`assets/icons/`).

---

## 2. Como Funcionam os 3 Perfis de Usuários (Com RLS Ativo)

### 👤 1. Perfil Cliente (`client`)
- **Cadastro sem cartão:** Informa apenas Nome/Apelido, E-mail, Senha, Nick do Personagem (`IGN`) e WhatsApp opcional.
- **Compra e Pós-Compra:** Escolhe as Currencies, Itens ou Services, passa pela Ponte de Pagamento e é redirecionado automaticamente para `pos-compra.html?order=PHX-...`.
- **Chat Direto no Site:** Na página de Pós-Compra, conversa ao vivo com o Vendedor responsável ou Administrador para alinhar os detalhes da entrega no Hideout.

### 🛠️ 2. Perfil Vendedor (`seller`) — Funcionário
- **O que PODE fazer:**
  - Editar preços unitários (`R$`), quantidades mínimas e status de estoque dos produtos no catálogo (ou pelo botão `✏️ Editar Preço / Estoque` direto nos cards da loja).
  - Cadastrar novos produtos/services no catálogo.
  - Receber aviso sonoro e visual imediato quando cai uma nova compra paga.
  - Assumir a entrega na fila, mudar o status (`Separando no Stash` → `No Hideout (Party Enviada)` → `Entregue`) e conversar com o comprador no **Chat Direto**.
  - Visualizar na aba **"Minhas Vendas"** **apenas as vendas que ELE mesmo atendeu/entregou**.
- **O que NÃO PODE fazer (Bloqueado no Front-end e no RLS do Supabase):**
  - **Não tem acesso à base geral de clientes** (e-mails, cadastros gerais).
  - **Não vê vendas de outros vendedores**.
  - **Não tem acesso ao Balanço de Valores / Faturamento Global da loja**.
  - **Não pode alterar a Chave PIX ou o link do meio de pagamento**.

### 👑 3. Perfil Administrador (`admin`) — Dono da Loja (Permissão Suprema)
- **Acesso Total Irrestrito:**
  - **Balanço Geral & Valores:** Faturamento Líquido Confirmado, Faturamento Bruto, Descontos PIX, Ticket Médio, Ranking de Vendas por Vendedor e Faturamento por Jogo (PoE 2 vs PoE 1).
  - **Histórico Geral de Compras & Todos os Chats:** Vê todos os pedidos da loja inteira e pode entrar e responder em qualquer chat de pós-compra.
  - **Catálogo Completo:** Edita preços/estoque e adiciona novos itens.
  - **Base de Clientes & Equipe:** Vê todos os clientes e vendedores cadastrados, altera permissões (`Cliente` ↔ `Vendedor` ↔ `Administrador`) e cadastra novos funcionários.
  - **Meio de Pagamento Blindado & Conexão Supabase:** Altera a Chave PIX / Titular / Link de Gateway externo e configura a URL + Anon Key do Supabase.

---

## 4. Como Conectar seu Projeto no Supabase (`DjKurohige01`)

1. No painel do Supabase (`https://supabase.com/dashboard`), clique em **New organization** e depois em **New project** (ex: `phoenix-currency-store`).
2. No menu lateral esquerdo do Supabase, abra **SQL Editor** → **New query**.
3. Copie todo o conteúdo do arquivo [`supabase-schema.sql`](./supabase-schema.sql), cole no editor e clique em **Run**.
4. Vá em **Project Settings → API**, copie a **Project URL** e a chave **anon public** e cole na aba **"🔐 Meio de Pagamento & Supabase"** dentro do **Painel Supremo do Administrador** (ou conecte o plugin oficial do Supabase aqui no Antigravity para que eu configure tudo automaticamente na sua conta!).
