-- ============================================================================
-- SafaKing — 002b: finish what 002 could not
--
-- 002 stopped partway. Its trigger function cast to ::user_role, an enum that
-- only exists in schema.sql (never run on this project), so Postgres aborted
-- before reaching the RLS section. Columns and tables landed; the security did
-- not — anonymous users can still read and write orders.
--
-- This script contains ONLY the missing parts and makes no assumption about
-- whether profiles.role is an enum or plain text.
--
-- Run in: Supabase Dashboard -> SQL Editor. Idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Signup trigger — no hard cast.
--    Assigning a text literal works whether profiles.role is text or an enum;
--    an invalid value is rejected by the column itself.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
begin
  -- 'admin' is never self-assignable, whatever the signup payload claims.
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
    requested
  )
  on conflict (id) do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before the trigger existed.
insert into public.profiles (id, full_name, phone, email, city, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data ->> 'phone',
  u.email,
  u.raw_user_meta_data ->> 'city',
  case when u.raw_user_meta_data ->> 'role' = 'artist' then 'artist' else 'customer' end
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Role-escalation guard
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null in the SQL editor / service_role, which is how the first
  -- admin is promoted. Anonymous web requests never reach this trigger because
  -- the UPDATE policy below rejects them first.
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

-- ---------------------------------------------------------------------------
-- 3. Helper used by the order_items / payments policies
-- ---------------------------------------------------------------------------
create or replace function public.owns_order(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o where o.id = target and o.customer_id = auth.uid()
  );
$$;

-- ============================================================================
-- 4. ROW LEVEL SECURITY  <-- the part that never ran
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

-- ---- profiles --------------------------------------------------------------
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

-- ---- orders ----------------------------------------------------------------
-- No INSERT policy on purpose: orders are created only by the service-role
-- checkout route, which prices them from the products table.
drop policy if exists orders_insert on public.orders;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (customer_id = auth.uid() or public.is_admin());

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete using (public.is_admin());

-- ---- order_items -----------------------------------------------------------
drop policy if exists order_items_insert on public.order_items;

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (public.is_admin() or public.owns_order(order_id));

-- ---- artist_bookings -------------------------------------------------------
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

-- ---- public lead forms: anyone may submit, only admins may read ------------
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

-- ---- wishlists -------------------------------------------------------------
drop policy if exists wishlists_own on public.wishlists;
create policy wishlists_own on public.wishlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- 5. Verification — rls_enabled must be true for every row below
-- ============================================================================
select tablename,
       rowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public'
  and tablename in (
    'profiles','products','orders','order_items','artist_bookings',
    'artist_applications','supplier_applications','academy_enrollments',
    'job_applications','deliverable_pincodes','artist_pincodes','wishlists'
  )
order by tablename;
