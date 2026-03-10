
-- Profiles
create table if not exists public.profiles (
  id uuid primary key,
  email text unique not null,
  full_name text,
  role text not null default 'worker' check (role in ('admin','manager','worker')),
  store_id uuid null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Stores
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  name text not null,
  manager_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Catalog shared for all stores
create table if not exists public.catalog (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Inventory entries per store
create table if not exists public.inventory_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  name text not null,
  expiry_date date not null,
  quantity integer not null check (quantity > 0),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived boolean not null default false
);

-- Expired aggregated list
create table if not exists public.expired_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  name text not null,
  quantity integer not null default 0,
  unique(store_id, code)
);

-- Monthly report rows
create table if not exists public.expired_monthly (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  name text not null,
  month_key text not null,
  quantity integer not null default 0
);

-- Join requests
create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.catalog enable row level security;
alter table public.inventory_entries enable row level security;
alter table public.expired_items enable row level security;
alter table public.expired_monthly enable row level security;
alter table public.join_requests enable row level security;

-- MVP policies (intentionally permissive for quick pilot)
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update all auth" on public.profiles for update to authenticated using (true);

create policy "stores all auth read" on public.stores for select to authenticated using (true);
create policy "stores insert auth" on public.stores for insert to authenticated with check (true);
create policy "stores update auth" on public.stores for update to authenticated using (true);

create policy "catalog all auth" on public.catalog for select to authenticated using (true);
create policy "catalog insert auth" on public.catalog for insert to authenticated with check (true);
create policy "catalog update auth" on public.catalog for update to authenticated using (true);

create policy "inventory read auth" on public.inventory_entries for select to authenticated using (true);
create policy "inventory insert auth" on public.inventory_entries for insert to authenticated with check (true);
create policy "inventory update auth" on public.inventory_entries for update to authenticated using (true);
create policy "inventory delete auth" on public.inventory_entries for delete to authenticated using (true);

create policy "expired read auth" on public.expired_items for select to authenticated using (true);
create policy "expired insert auth" on public.expired_items for insert to authenticated with check (true);
create policy "expired update auth" on public.expired_items for update to authenticated using (true);

create policy "expired monthly read auth" on public.expired_monthly for select to authenticated using (true);
create policy "expired monthly insert auth" on public.expired_monthly for insert to authenticated with check (true);
create policy "expired monthly update auth" on public.expired_monthly for update to authenticated using (true);

create policy "join read auth" on public.join_requests for select to authenticated using (true);
create policy "join insert auth" on public.join_requests for insert to authenticated with check (true);
create policy "join update auth" on public.join_requests for update to authenticated using (true);
