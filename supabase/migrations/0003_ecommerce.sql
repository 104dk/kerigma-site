-- ============================================================
-- KERIGMA - Ecommerce: colunas de produto + tabela de vendas
-- Adiciona campos de produto (tipo, preço, link de pagamento) em
-- public.services e cria public.sales (vendas/pedidos) com RLS.
-- Aplicar via SQL Editor do Supabase (projeto vkrtogskkhumqphiftcz)
-- ============================================================

begin;

-- ---------- services: campos de produto ----------
alter table public.services
  add column if not exists product_type text not null default 'ebook',
  add column if not exists price numeric,
  add column if not exists payment_link text;

-- ---------- sales: vendas / pedidos ----------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid,
  product_title text not null,
  customer_name text,
  customer_whatsapp text,
  amount numeric,
  payment_method text default 'pix',
  status text not null default 'novo',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists sales_created_at_idx on public.sales (created_at desc);

alter table public.sales enable row level security;

-- vendas NÃO devem ser públicas (só o admin autenticado vê)
create policy "sales authenticated all" on public.sales
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

commit;
