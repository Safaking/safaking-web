-- ============================================================================
-- SafaKing — 002 Production Hardening
--
-- Reconciles the LIVE database with what the application actually needs, and
-- closes the open-access hole (anon could read every order and PATCH them).
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Idempotent: safe to run more than once.
--
-- ORDER MATTERS: this file assumes the tables profiles / products / orders /
-- order_items / artist_bookings / supplier_applications / academy_enrollments
-- already exist (they do). It adds what is missing, then turns RLS on.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Enum types used by the newer tables
-- ---------------------------------------------------------------------------
do $$ begin create type application_status     as enum ('pending','approved','rejected');            exception when duplicate_object then null; end $$;
do $$ begin create type job_application_status as enum ('pending','shortlisted','hired','rejected');  exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. profiles — add email, backfill from auth.users
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- ---------------------------------------------------------------------------
-- 2. products — add every column the storefront renders.
--    Without these the shop cannot read the DB and silently falls back to the
--    hardcoded list in src/lib/products.ts, so admin edits are invisible.
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists code           text;
alter table public.products add column if not exists original_price integer;
alter table public.products add column if not exists color          text;
alter table public.products add column if not exists fabric         text;
alter table public.products add column if not exists style          text;
alter table public.products add column if not exists occasion       text;
alter table public.products add column if not exists rating         numeric(2,1) default 4.8;
alter table public.products add column if not exists reviews_count  integer      default 0;
alter table public.products add column if not exists is_new         boolean not null default false;
alter table public.products add column if not exists is_bestseller  boolean not null default false;
alter table public.products add column if not exists featured       boolean not null default false;
alter table public.products add column if not exists active         boolean not null default true;
alter table public.products add column if not exists sort_order     integer not null default 0;

create unique index if not exists products_code_key on public.products (code) where code is not null;

-- Give the existing rows sane values so the storefront renders them properly.
update public.products set
  code           = coalesce(code, 'SFA-' || upper(substr(replace(id::text,'-',''), 1, 6))),
  original_price = coalesce(original_price, round(price * 1.35)::integer),
  active         = coalesce(active, true),
  featured       = true,
  sort_order     = coalesce(nullif(sort_order, 0), 1)
where original_price is null or code is null;

-- ---------------------------------------------------------------------------
-- 3. Columns the newer checkout / booking flows write.
--    These exist so the app can stop using its "retry without the column"
--    fallbacks, which currently hide genuine failures.
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists advance_amount integer;
alter table public.orders add column if not exists balance_amount integer;
alter table public.orders add column if not exists payment_status text default 'unpaid';

alter table public.artist_bookings add column if not exists advance_amount integer;
alter table public.artist_bookings add column if not exists balance_amount integer;
alter table public.artist_bookings add column if not exists payment_status text default 'unpaid';
alter table public.artist_bookings add column if not exists artist_id      uuid references public.profiles(id) on delete set null;
alter table public.artist_bookings add column if not exists artist_name    text;
alter table public.artist_bookings add column if not exists notes          text;

alter table public.supplier_applications add column if not exists user_id  uuid references public.profiles(id) on delete set null;
alter table public.supplier_applications add column if not exists category text;
alter table public.supplier_applications add column if not exists message  text;
alter table public.supplier_applications add column if not exists email    text;

alter table public.academy_enrollments add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.academy_enrollments add column if not exists notes   text;

-- ---------------------------------------------------------------------------
-- 4. Missing tables the UI already writes to (all currently 404 -> data lost)
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

create table if not exists public.artist_applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete set null,
  full_name        text not null,
  phone            text not null,
  city             text,
  experience_years integer default 1,
  specialties      text[],
  team_size        integer default 1,
  per_safa_rate    integer default 50,
  portfolio_link   text,
  status           application_status not null default 'pending',
  created_at       timestamptz not null default now()
);

create table if not exists public.deliverable_pincodes (
  id             uuid primary key default gen_random_uuid(),
  pincode        text not null unique,
  city_state     text not null,
  estimated_days integer not null default 3,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.artist_pincodes (
  id             uuid primary key default gen_random_uuid(),
  pincode        text not null unique,
  city_state     text not null,
  estimated_days integer not null default 1,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.wishlists (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- Seed the pincode tables from the list currently hardcoded in src/lib/pincodes.ts
insert into public.deliverable_pincodes (pincode, city_state, estimated_days) values
  ('302001','Jaipur, Rajasthan',2), ('302012','Jaipur, Rajasthan',2), ('302015','Jaipur, Rajasthan',2),
  ('110001','Delhi NCR',3),         ('110011','Delhi NCR',3),         ('400001','Mumbai, Maharashtra',3),
  ('313001','Udaipur, Rajasthan',2),('342001','Jodhpur, Rajasthan',2),('500001','Hyderabad, Telangana',3),
  ('560001','Bengaluru, Karnataka',3)
on conflict (pincode) do nothing;

insert into public.artist_pincodes (pincode, city_state, estimated_days)
select pincode, city_state, 1 from public.deliverable_pincodes
on conflict (pincode) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Helper functions. SECURITY DEFINER so a policy on profiles can read
--    profiles without recursing into its own policy.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text from public.profiles where id = auth.uid()) = 'admin', false);
$$;

create or replace function public.owns_order(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders o where o.id = target and o.customer_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 6. Signup trigger: create the profile row, and never honour role = 'admin'
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare requested text := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
begin
  if requested not in ('customer','artist') then requested := 'customer'; end if;

  insert into public.profiles (id, full_name, phone, email, city, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data ->> 'phone',
    new.email,
    new.raw_user_meta_data ->> 'city',
    requested::user_role
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Only an admin may change a role. auth.uid() is null in the SQL editor /
-- service_role, which is how the first admin is promoted; anonymous web
-- requests never reach this trigger because the UPDATE policy rejects them.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an administrator can change a user role';
  end if;
  return new;
end; $$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles for each row execute function public.guard_profile_role();

-- ============================================================================
-- 7. ROW LEVEL SECURITY  <-- the actual fix
-- ============================================================================
alter table public.profiles              enable row level security;
alter table public.products              enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.artist_bookings       enable row level security;
alter table public.artist_applications   enable row level security;
alter table public.supplier_applications enable row level security;
alter table public.academy_enrollments   enable row level security;
alter table public.job_applications      enable row level security;
alter table public.deliverable_pincodes  enable row level security;
alter table public.artist_pincodes       enable row level security;
alter table public.wishlists             enable row level security;

-- ---- profiles: you see yourself; admins see everyone -----------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---- products: world-readable when active, admin-managed -------------------
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using (active or public.is_admin());

drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- orders: guest checkout allowed; read only your own; admin manages -----
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (customer_id is null or customer_id = auth.uid());

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (customer_id = auth.uid() or public.is_admin());

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete using (public.is_admin());

-- ---- order_items: follow the parent order ---------------------------------
drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert with check (
    exists (select 1 from public.orders o
            where o.id = order_id
              and (o.customer_id is null or o.customer_id = auth.uid() or public.is_admin()))
  );

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (public.is_admin() or public.owns_order(order_id));

-- ---- artist_bookings: customer sees own, artist sees assigned -------------
drop policy if exists bookings_insert on public.artist_bookings;
create policy bookings_insert on public.artist_bookings
  for insert with check (customer_id is null or customer_id = auth.uid());

drop policy if exists bookings_select on public.artist_bookings;
create policy bookings_select on public.artist_bookings
  for select using (public.is_admin() or customer_id = auth.uid() or artist_id = auth.uid());

drop policy if exists bookings_update on public.artist_bookings;
create policy bookings_update on public.artist_bookings
  for update using (public.is_admin() or artist_id = auth.uid())
  with check (public.is_admin() or artist_id = auth.uid());

drop policy if exists bookings_delete on public.artist_bookings;
create policy bookings_delete on public.artist_bookings
  for delete using (public.is_admin());

-- ---- public lead forms: anyone may submit, only admin may read/manage -----
do $$
declare t text;
begin
  foreach t in array array[
    'artist_applications','supplier_applications','academy_enrollments','job_applications'
  ] loop
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (true)', t, t);

    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (public.is_admin() or user_id = auth.uid())', t, t);

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update using (public.is_admin()) with check (public.is_admin())', t, t);

    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.is_admin())', t, t);
  end loop;
end $$;

-- ---- pincodes: public read (checkout needs it), admin write ---------------
do $$
declare t text;
begin
  foreach t in array array['deliverable_pincodes','artist_pincodes'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (true)', t, t);

    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- ---- wishlists: strictly your own ----------------------------------------
drop policy if exists wishlists_own on public.wishlists;
create policy wishlists_own on public.wishlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- 8. Verification — every table below must report rowsecurity = true
-- ============================================================================
select tablename, rowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.tablename = t.tablename) as policy_count
from pg_tables t
where schemaname = 'public'
order by tablename;
