-- ============================================================================
-- SafaKing — full database schema
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run (idempotent).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('customer', 'artist', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('pending', 'assigned', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type enrollment_status as enum ('pending', 'contacted', 'enrolled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_application_status as enum ('pending', 'shortlisted', 'hired', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, created automatically on signup
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default '',
  phone      text,
  email      text,
  city       text,
  role       user_role not null default 'customer',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  code           text unique,
  name           text not null,
  description    text,
  price          integer not null default 0,
  original_price integer,
  category       text,
  color          text,
  fabric         text,
  style          text,
  occasion       text,
  image          text,
  rating         numeric(2,1) default 4.8,
  reviews_count  integer default 0,
  stock          integer not null default 0,
  is_new         boolean not null default false,
  is_bestseller  boolean not null default false,
  featured       boolean not null default false,
  active         boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

-- Top-ups, so re-running against an older install still converges.
alter table public.products add column if not exists featured boolean not null default false;

-- ---------------------------------------------------------------------------
-- orders + order_items
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid references public.profiles(id) on delete set null,
  customer_name    text not null,
  customer_phone   text not null,
  customer_email   text,
  shipping_address text not null,
  total_amount     integer not null default 0,
  status           order_status not null default 'pending',
  created_at       timestamptz not null default now()
);

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  price        integer not null default 0,
  quantity     integer not null default 1
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists orders_customer_id_idx on public.orders(customer_id);

-- ---------------------------------------------------------------------------
-- artist_bookings
-- ---------------------------------------------------------------------------
create table if not exists public.artist_bookings (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references public.profiles(id) on delete set null,
  customer_name  text not null,
  customer_phone text not null,
  city_venue     text not null,
  event_date     date not null,
  safa_style     text not null,
  artist_id      uuid references public.profiles(id) on delete set null,
  artist_name    text,
  amount         integer not null default 50,
  status         booking_status not null default 'pending',
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists artist_bookings_artist_id_idx on public.artist_bookings(artist_id);
create index if not exists artist_bookings_customer_id_idx on public.artist_bookings(customer_id);

-- ---------------------------------------------------------------------------
-- supplier_applications
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  business_name text not null,
  contact_name  text not null,
  phone         text not null,
  email         text,
  city          text,
  category      text,
  message       text,
  status        application_status not null default 'pending',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- academy_enrollments
-- ---------------------------------------------------------------------------
create table if not exists public.academy_enrollments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  full_name  text not null,
  phone      text not null,
  city       text,
  center     text not null,
  status     enrollment_status not null default 'pending',
  notes      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- job_applications (careers page)
-- ---------------------------------------------------------------------------
create table if not exists public.job_applications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  job_id     text not null,
  job_title  text not null,
  full_name  text not null,
  phone      text not null,
  email      text not null,
  city       text,
  experience text,
  message    text,
  status     job_application_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- wishlists
-- ---------------------------------------------------------------------------
create table if not exists public.wishlists (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ============================================================================
-- Helper functions (security definer so they can read profiles without
-- re-triggering RLS on the profiles table)
-- ============================================================================
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false);
$$;

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever an auth user signs up.
-- Role comes from signup metadata but 'admin' is never self-assignable.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
begin
  if requested not in ('customer', 'artist') then
    requested := 'customer';
  end if;

  insert into public.profiles (id, full_name, phone, email, city, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    new.email,
    new.raw_user_meta_data ->> 'city',
    requested::user_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for anyone who signed up before this schema was applied.
insert into public.profiles (id, full_name, phone, email, city, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data ->> 'phone',
  u.email,
  u.raw_user_meta_data ->> 'city',
  case when u.raw_user_meta_data ->> 'role' = 'artist' then 'artist' else 'customer' end::user_role
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Block privilege escalation: only an admin may change a profile's role.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the SQL editor / service_role, which is how the
  -- first admin gets promoted. Anonymous web requests never reach this
  -- trigger: the profiles UPDATE policy rejects them first.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an administrator can change a user role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles              enable row level security;
alter table public.products              enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.artist_bookings       enable row level security;
alter table public.supplier_applications enable row level security;
alter table public.academy_enrollments   enable row level security;
alter table public.job_applications      enable row level security;
alter table public.wishlists             enable row level security;

-- ---- profiles --------------------------------------------------------------
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

-- ---- products: world-readable when active, admin-managed -------------------
drop policy if exists products_select_public on public.products;
create policy products_select_public on public.products
  for select using (active or public.is_admin());

drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- orders: guest checkout allowed, read own or admin ---------------------
drop policy if exists orders_insert_any on public.orders;
create policy orders_insert_any on public.orders
  for insert with check (customer_id is null or customer_id = auth.uid());

drop policy if exists orders_select_own_or_admin on public.orders;
create policy orders_select_own_or_admin on public.orders
  for select using (customer_id = auth.uid() or public.is_admin());

drop policy if exists orders_update_admin on public.orders;
create policy orders_update_admin on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_delete_admin on public.orders;
create policy orders_delete_admin on public.orders
  for delete using (public.is_admin());

-- ---- order_items -----------------------------------------------------------
drop policy if exists order_items_insert_any on public.order_items;
create policy order_items_insert_any on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.customer_id is null or o.customer_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists order_items_select_own_or_admin on public.order_items;
create policy order_items_select_own_or_admin on public.order_items
  for select using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

-- ---- artist_bookings -------------------------------------------------------
drop policy if exists bookings_insert_any on public.artist_bookings;
create policy bookings_insert_any on public.artist_bookings
  for insert with check (customer_id is null or customer_id = auth.uid());

drop policy if exists bookings_select_scoped on public.artist_bookings;
create policy bookings_select_scoped on public.artist_bookings
  for select using (
    public.is_admin()
    or customer_id = auth.uid()
    or artist_id = auth.uid()
  );

drop policy if exists bookings_update_admin_or_artist on public.artist_bookings;
create policy bookings_update_admin_or_artist on public.artist_bookings
  for update using (public.is_admin() or artist_id = auth.uid())
  with check (public.is_admin() or artist_id = auth.uid());

drop policy if exists bookings_delete_admin on public.artist_bookings;
create policy bookings_delete_admin on public.artist_bookings
  for delete using (public.is_admin());

-- ---- lead forms: anyone may submit, only admins may read/manage ------------
drop policy if exists suppliers_insert_any on public.supplier_applications;
create policy suppliers_insert_any on public.supplier_applications
  for insert with check (true);

drop policy if exists suppliers_admin_read on public.supplier_applications;
create policy suppliers_admin_read on public.supplier_applications
  for select using (public.is_admin() or user_id = auth.uid());

drop policy if exists suppliers_admin_write on public.supplier_applications;
create policy suppliers_admin_write on public.supplier_applications
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists enrollments_insert_any on public.academy_enrollments;
create policy enrollments_insert_any on public.academy_enrollments
  for insert with check (true);

drop policy if exists enrollments_admin_read on public.academy_enrollments;
create policy enrollments_admin_read on public.academy_enrollments
  for select using (public.is_admin() or user_id = auth.uid());

drop policy if exists enrollments_admin_write on public.academy_enrollments;
create policy enrollments_admin_write on public.academy_enrollments
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists jobs_insert_any on public.job_applications;
create policy jobs_insert_any on public.job_applications
  for insert with check (true);

drop policy if exists jobs_admin_read on public.job_applications;
create policy jobs_admin_read on public.job_applications
  for select using (public.is_admin() or user_id = auth.uid());

drop policy if exists jobs_admin_write on public.job_applications;
create policy jobs_admin_write on public.job_applications
  for update using (public.is_admin()) with check (public.is_admin());

-- ---- wishlists -------------------------------------------------------------
drop policy if exists wishlists_own on public.wishlists;
create policy wishlists_own on public.wishlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
