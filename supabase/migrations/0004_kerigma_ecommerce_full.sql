-- ============================================================
-- KERIGMA E-COMMERCE FULL - Migration 0004
-- Adiciona recursos completos de loja digital mantendo
-- compatibilidade com services/gallery/site_settings/sales.
-- Aplicar via SQL Editor do Supabase (projeto vkrtogskkhumqphiftcz)
-- ============================================================

begin;

-- ============================================================
-- 4.10 team_members (criada antes de categories p/ reuso)
-- ============================================================
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  role text not null default 'editor',
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ============================================================
-- 4.3 categories
-- ============================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  image text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ============================================================
-- 4.5 sellers (vendedoras - sem login proprio)
-- ============================================================
create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp text,
  email text,
  commission_percent numeric not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ============================================================
-- 4.4 customers
-- ============================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  whatsapp text,
  cpf text,
  address text,
  city text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ============================================================
-- 4.2 services - novas colunas
-- ============================================================
alter table public.services
  add column if not exists category uuid references public.categories(id) on delete set null,
  add column if not exists stock integer not null default 0,
  add column if not exists sku text,
  add column if not exists available boolean not null default true,
  add column if not exists featured boolean not null default false,
  add column if not exists seller_id uuid references public.sellers(id) on delete set null,
  add column if not exists views integer not null default 0;

-- ============================================================
-- 4.6 orders (pedido mestre)
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  customer_id uuid references public.customers(id) on delete set null,
  seller_id uuid references public.sellers(id) on delete set null,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  payment_method text default 'pix',
  payment_status text not null default 'pendente',
  shipping_method text,
  shipping_cost numeric not null default 0,
  tracking_code text,
  expedit_status text not null default 'a_expedir',
  frete_status text,
  status text not null default 'novo',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ============================================================
-- 4.7 order_items
-- ============================================================
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.services(id) on delete set null,
  product_title text not null,
  qty integer not null default 1,
  unit_price numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4.8 reviews (avaliacoes 1-5)
-- ============================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.services(id) on delete cascade,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ============================================================
-- 4.9 plans (assinatura)
-- ============================================================
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  plan_name text not null default 'Essencial',
  period text not null default 'mensal',
  price numeric not null default 0,
  status text not null default 'ativo',
  features jsonb not null default '[]'::jsonb,
  next_billing date,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ============================================================
-- 4.11 Indices
-- ============================================================
create index if not exists services_category_idx on public.services (category);
create index if not exists services_available_idx on public.services (available);
create index if not exists services_featured_idx on public.services (featured);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists reviews_product_idx on public.reviews (product_id);
create index if not exists reviews_approved_idx on public.reviews (approved);

-- ============================================================
-- 4.12 RLS
-- ============================================================

-- services / gallery / site_settings: read public + write autenticado (ja existente)
-- (policies ja criadas nas migrations 0001/0003)

-- categories: read public + write autenticado
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select using (true);
create policy "categories authenticated write" on public.categories for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- orders: somente autenticado
alter table public.orders enable row level security;
create policy "orders authenticated all" on public.orders for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- order_items: somente autenticado
alter table public.order_items enable row level security;
create policy "order_items authenticated all" on public.order_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- customers: somente autenticado
alter table public.customers enable row level security;
create policy "customers authenticated all" on public.customers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- sellers: somente autenticado
alter table public.sellers enable row level security;
create policy "sellers authenticated all" on public.sellers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- reviews: read public apenas approved; insert publico; update/delete autenticado
alter table public.reviews enable row level security;
create policy "reviews public read approved" on public.reviews for select using (approved = true);
create policy "reviews public insert" on public.reviews for insert with check (true);
create policy "reviews authenticated manage" on public.reviews for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "reviews authenticated delete" on public.reviews for delete using (auth.role() = 'authenticated');

-- plans: somente autenticado
alter table public.plans enable row level security;
create policy "plans authenticated all" on public.plans for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- team_members: somente autenticado
alter table public.team_members enable row level security;
create policy "team_members authenticated all" on public.team_members for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- RPC de view counting (incrementa views de um produto; acesso publico via SECURITY DEFINER,
-- usado pelo site publico para contabilizar visualizacoes sem expor escrita em services)
create or replace function public.web_increment_views(p_product_id uuid)
  returns void
  language sql
  security definer
  set search_path = public
  as $$
    update public.services set views = coalesce(views, 0) + 1 where id = p_product_id;
  $$;
revoke all on function public.web_increment_views(uuid) from public, anon, authenticated;
grant execute on function public.web_increment_views(uuid) to anon, authenticated;

commit;
