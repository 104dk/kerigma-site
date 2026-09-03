-- ============================================================
-- KERIGMA - Estrutura inicial do banco
-- Tabelas: services, gallery, site_settings + RLS
-- Aplicar via SQL Editor do Supabase (projeto vkrtogskkhumqphiftcz)
-- ============================================================

begin;

-- ---------- services ----------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  title text not null,
  description text,
  icon text default 'fa-image',
  whatsapp text,
  items jsonb default '[]'::jsonb,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.services enable row level security;

create policy "services public read" on public.services
  for select using (true);

create policy "services authenticated write" on public.services
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- gallery ----------
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  title text,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.gallery enable row level security;

create policy "gallery public read" on public.gallery
  for select using (true);

create policy "gallery authenticated write" on public.gallery
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- site_settings ----------
create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  hero_title text,
  hero_subtitle text,
  whatsapp text,
  email text,
  cta_title text,
  cta_text text,
  address text,
  whatsapp_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.site_settings enable row level security;

create policy "site_settings public read" on public.site_settings
  for select using (true);

create policy "site_settings authenticated write" on public.site_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

commit;
