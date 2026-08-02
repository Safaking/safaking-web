-- ============================================================================
-- SafaKing — 002c: minimal RLS for the three tables still exposed
--
-- 002b did not take effect. This is the smallest possible script that closes
-- the hole: no functions, no triggers, no backfill, no loops — just RLS and
-- policies on orders, order_items and profiles.
--
-- Run in: Supabase Dashboard -> SQL Editor. Idempotent.
-- If a red error appears, copy it — each statement is independent, so the rest
-- can still be run.
--
-- Requires public.is_admin(), which already exists on this project.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: you see only yourself; admins see everyone
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

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

-- ---------------------------------------------------------------------------
-- orders: read your own, admins read all, nobody inserts from the browser
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;

-- Deliberately no INSERT policy: orders are created only by the checkout API
-- using the service role, which prices them from the products table.
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

-- ---------------------------------------------------------------------------
-- order_items: visible only with the parent order
-- ---------------------------------------------------------------------------
alter table public.order_items enable row level security;

drop policy if exists order_items_insert on public.order_items;

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Verification — all three must show rls_enabled = true
-- ---------------------------------------------------------------------------
select tablename,
       rowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public'
  and tablename in ('profiles', 'orders', 'order_items')
order by tablename;
