-- ============================================================================
-- PHOENIX STORE — SCHEMA OFICIAL DO BANCO DE DADOS SUPABASE (POSTGRESQL + RLS)
-- ============================================================================
-- Como usar:
-- 1. No painel do Supabase (https://supabase.com/dashboard), crie seu projeto.
-- 2. Abra o menu "SQL Editor" -> "New query".
-- 3. Cole todo este conteúdo e clique em "Run".
-- ============================================================================

-- Extensão para UUIDs
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABELA DE PERFIS DE USUÁRIOS (3 Tipos: 'client', 'seller', 'admin')
--    OBS: Não armazena cartão de crédito nem dados sensíveis de pagamento.
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null check (char_length(email) <= 100),
  full_name text not null check (char_length(full_name) between 2 and 60),
  ign_default text default '' check (char_length(ign_default) <= 60),
  whatsapp text default '' check (char_length(whatsapp) <= 30),
  role text not null default 'client' check (role in ('client', 'seller', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Função auxiliar SECURITY DEFINER para checar o cargo do usuário logado sem recursão de RLS
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'client'
  );
$$;

-- Trigger automático: quando um usuário se cadastra no Supabase Auth, cria perfil 'client'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, ign_default, whatsapp, role)
  values (
    new.id,
    left(coalesce(new.email, ''), 100),
    left(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Cliente'), 60),
    left(coalesce(new.raw_user_meta_data->>'ign_default', ''), 60),
    left(coalesce(new.raw_user_meta_data->>'whatsapp', ''), 30),
    'client' -- Sempre inicia como cliente por segurança; apenas Admin promove para 'seller' ou 'admin'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- POLÍTICAS RLS DE PROFILES:
-- - Cliente e Vendedor só enxergam o PRÓPRIO perfil (Vendedor NÃO tem acesso à base de clientes!)
-- - Administrador enxerga e gerencia TODOS os perfis (base de clientes e vendedores)
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.get_my_role() = 'admin');

drop policy if exists "profiles_update_own_safe" on public.profiles;
create policy "profiles_update_own_safe"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ============================================================================
-- 2. TABELA DE PRODUTOS / CATÁLOGO (Currency, Itens & Services)
--    Permissão: Vendedor e Admin podem editar preços, quantidades e estoque.
-- ============================================================================
create table if not exists public.products (
  id text primary key check (char_length(id) <= 80),
  game_id text not null check (char_length(game_id) <= 40),
  category_id text not null check (category_id in ('currency', 'services', 'items')),
  name text not null check (char_length(name) <= 100),
  subtitle text default '' check (char_length(subtitle) <= 240),
  badge text default null check (char_length(badge) <= 40),
  featured boolean not null default false,
  price_per_unit numeric(12,2) not null default 0 check (price_per_unit >= 0),
  custom_price_label text default null check (char_length(custom_price_label) <= 40),
  unit_label text not null default '1x Unidade' check (char_length(unit_label) <= 60),
  min_qty integer not null default 1 check (min_qty >= 1),
  step_qty integer not null default 1 check (step_qty >= 1),
  stock_qty integer not null default 999 check (stock_qty >= 0),
  stock_status text not null default 'Em Estoque' check (char_length(stock_status) <= 80),
  icon_file text default null,
  image_url text default null,
  rarity_color text default 'orange',
  active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

-- Qualquer visitante ou cliente pode ver os produtos ativos da loja
drop policy if exists "products_public_select" on public.products;
create policy "products_public_select"
  on public.products for select
  using (true);

-- Vendedor e Administrador podem atualizar preços, quantidades e estoque ou cadastrar itens
drop policy if exists "products_seller_and_admin_write" on public.products;
create policy "products_seller_and_admin_write"
  on public.products for insert
  with check (public.get_my_role() in ('seller', 'admin'));

drop policy if exists "products_seller_and_admin_update" on public.products;
create policy "products_seller_and_admin_update"
  on public.products for update
  using (public.get_my_role() in ('seller', 'admin'))
  with check (public.get_my_role() in ('seller', 'admin'));

-- Apenas Administrador pode deletar produtos do banco
drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
  on public.products for delete
  using (public.get_my_role() = 'admin');

-- ============================================================================
-- 3. CONFIGURAÇÃO DO MEIO DE PAGAMENTO (BLINDADA — EXCLUSIVO ADMIN)
--    Protege a chave PIX e o link de gateway para que ninguém altere a conta destino.
-- ============================================================================
create table if not exists public.payment_settings (
  id integer primary key default 1 check (id = 1),
  pix_key text not null default 'pix@phoenixstore.com.br' check (char_length(pix_key) <= 140),
  pix_receiver_name text not null default 'PHOENIX STORE LTDA' check (char_length(pix_receiver_name) <= 100),
  pix_discount_percent numeric(5,2) not null default 5.00 check (pix_discount_percent between 0 and 50),
  external_gateway_name text not null default 'PIX Direto / Checkout Externo' check (char_length(external_gateway_name) <= 80),
  external_payment_url text default '' check (char_length(external_payment_url) <= 300),
  updated_at timestamptz not null default now()
);

alter table public.payment_settings enable row level security;

drop policy if exists "payment_settings_public_read" on public.payment_settings;
create policy "payment_settings_public_read"
  on public.payment_settings for select
  using (true);

-- SOMENTE O ADMINISTRADOR SUPREMO PODE ALTERAR DADOS DE RECEBIMENTO / PAGAMENTO
drop policy if exists "payment_settings_admin_only_write" on public.payment_settings;
create policy "payment_settings_admin_only_write"
  on public.payment_settings for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

insert into public.payment_settings (id, pix_key, pix_receiver_name, pix_discount_percent, external_gateway_name)
values (1, 'pix@phoenixstore.com.br', 'PHOENIX STORE OFICIAL', 5.00, 'PIX Instantâneo / Gateway Externo')
on conflict (id) do nothing;

-- ============================================================================
-- 4. TABELA DE PEDIDOS / COMPRAS (ORDERS)
--    Regras de Visibilidade (RLS):
--    - Cliente: vê APENAS os pedidos que ele mesmo comprou (client_id = auth.uid())
--    - Vendedor: vê pedidos pagos aguardando atendimento (seller_id IS NULL)
--      e APENAS as vendas que ELE mesmo realizou (seller_id = auth.uid()).
--      NÃO tem acesso ao histórico de outros vendedores nem ao balanço geral.
--    - Administrador: vê TODOS os pedidos e todo o balanço financeiro da loja.
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null check (char_length(order_code) <= 30),
  client_id uuid references public.profiles(id) on delete set null,
  client_name text not null check (char_length(client_name) <= 60),
  client_email text default '' check (char_length(client_email) <= 100),
  client_ign text not null check (char_length(client_ign) <= 60),
  game_id text not null default 'poe2' check (char_length(game_id) <= 40),
  game_name text not null default 'Path of Exile 2' check (char_length(game_name) <= 60),
  league_name text not null default 'Liga Atual — Softcore' check (char_length(league_name) <= 80),
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text not null default 'PIX (5% OFF)' check (char_length(payment_method) <= 60),
  payment_status text not null default 'paid' check (payment_status in ('pending', 'paid', 'refunded')),
  payment_reference text default '' check (char_length(payment_reference) <= 120),
  delivery_status text not null default 'paid_waiting_seller'
    check (delivery_status in ('awaiting_payment', 'paid_waiting_seller', 'seller_assigned', 'in_hideout', 'delivered', 'cancelled')),
  seller_id uuid references public.profiles(id) on delete set null,
  seller_name text default null check (char_length(seller_name) <= 60),
  created_at timestamptz not null default now(),
  delivered_at timestamptz default null
);

alter table public.orders enable row level security;

-- Cliente vê apenas suas próprias compras
drop policy if exists "orders_client_select_own" on public.orders;
create policy "orders_client_select_own"
  on public.orders for select
  using (client_id = auth.uid());

-- Cliente pode criar pedido em seu próprio nome
drop policy if exists "orders_client_insert_own" on public.orders;
create policy "orders_client_insert_own"
  on public.orders for insert
  with check (client_id = auth.uid());

-- Vendedor vê APENAS:
-- 1) Pedidos pagos na fila aguardando um vendedor assumir (seller_id is null)
-- 2) As vendas que ELE mesmo assumiu/entregou (seller_id = auth.uid())
drop policy if exists "orders_seller_select_assigned_or_queue" on public.orders;
create policy "orders_seller_select_assigned_or_queue"
  on public.orders for select
  using (
    public.get_my_role() = 'seller'
    and (seller_id = auth.uid() or (seller_id is null and payment_status = 'paid'))
  );

-- Vendedor pode assumir pedido da fila ou atualizar status da entrega que ele mesmo atende
drop policy if exists "orders_seller_update_delivery" on public.orders;
create policy "orders_seller_update_delivery"
  on public.orders for update
  using (
    public.get_my_role() = 'seller'
    and (seller_id = auth.uid() or seller_id is null)
  )
  with check (
    public.get_my_role() = 'seller'
    and seller_id = auth.uid()
  );

-- Administrador tem acesso total irrestrito a todos os pedidos e balanço financeiro
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all"
  on public.orders for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ============================================================================
-- 5. TABELA DE CHAT DIRETO PÓS-COMPRA (ORDER_MESSAGES)
--    Conecta o Cliente diretamente ao Vendedor responsável ou ao Administrador.
-- ============================================================================
create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_code text not null check (char_length(order_code) <= 30),
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text not null check (char_length(sender_name) <= 60),
  sender_role text not null check (sender_role in ('client', 'seller', 'admin', 'system')),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.order_messages enable row level security;

-- Leitura e envio liberados apenas para:
-- - O cliente dono do pedido
-- - O vendedor responsável pelo pedido (ou vendedor vendo pedido na fila)
-- - O administrador da loja
drop policy if exists "order_messages_select_participants" on public.order_messages;
create policy "order_messages_select_participants"
  on public.order_messages for select
  using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.orders o
      where o.id = order_messages.order_id
        and (
          o.client_id = auth.uid()
          or (public.get_my_role() = 'seller' and (o.seller_id = auth.uid() or o.seller_id is null))
        )
    )
  );

drop policy if exists "order_messages_insert_participants" on public.order_messages;
create policy "order_messages_insert_participants"
  on public.order_messages for insert
  with check (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.orders o
      where o.id = order_messages.order_id
        and (
          o.client_id = auth.uid()
          or (public.get_my_role() = 'seller' and (o.seller_id = auth.uid() or o.seller_id is null))
        )
    )
  );

-- Ativa Realtime para Pedidos e Chat Pós-Compra no Supabase
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_messages;
exception when others then null;
end $$;
