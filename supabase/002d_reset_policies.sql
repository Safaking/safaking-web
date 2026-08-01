-- ============================================================================
-- SafaKing — 002d: reset ALL policies on the exposed tables
--
-- Why the previous scripts appeared to do nothing:
--
-- Postgres combines permissive policies with OR. If a policy such as Supabase's
-- "Enable read access for all users" (USING (true)) already exists on a table,
-- adding a restrictive policy next to it changes nothing — the permissive one
-- still grants access to everybody.
--
-- Earlier scripts only dropped policies by the names THEY created, so any
-- policy added through the dashboard's Table Editor survived untouched.
--
-- This script drops EVERY policy on the three tables, then recreates only the
-- correct ones.
--
-- Run in: Supabase Dashboard -> SQL Editor. Idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1 — see what is actually there right now.
-- Read this output: it names the policy that has been granting public access.
-- ---------------------------------------------------------------------------
select tablename,
       policyname,
       cmd,
       roles::text,
       coalesce(qual, '(none)')       as using_expression,
       coalesce(with_check, '(none)') as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items', 'profiles')
order by tablename, policyname;

-- ---------------------------------------------------------------------------
-- STEP 2 — drop every policy on these three tables, whatever it is called.
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('orders', 'order_items', 'profiles')
  loop
    execute format('drop policy if exists %I on %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
    raise notice 'Dropped policy % on %', pol.policyname, pol.tablename;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- STEP 3 — force RLS on. Without this, policies are ignored entirely.
-- ---------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- ---------------------------------------------------------------------------
-- STEP 4 — the only policies these tables should have.
-- ---------------------------------------------------------------------------

-- profiles: yourself, or an admin.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- orders: your own, or an admin. No INSERT policy anywhere — orders are
-- created only by the checkout API using the service role, which bypasses RLS
-- and prices every line from the products table.
create policy orders_select on public.orders
  for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());

create policy orders_update on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy orders_delete on public.orders
  for delete to authenticated
  using (public.is_admin());

-- order_items: visible only alongside the parent order.
create policy order_items_select on public.order_items
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- STEP 5 — verify. Expect exactly this:
--
--   order_items | true | 1
--   orders      | true | 3
--   profiles    | true | 3
--
-- and NO policy below whose roles include "anon" or whose using_expression
-- is "true".
-- ---------------------------------------------------------------------------
select tablename,
       rowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.schemaname = 'public'
                                             and p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public'
  and tablename in ('profiles', 'orders', 'order_items')
order by tablename;

select tablename, policyname, cmd, roles::text, qual as using_expression
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items', 'profiles')
order by tablename, policyname;
