-- ============================================================================
-- SafaKing — 014 Fix: infinite recursion in team and marketplace policies
--
-- Run AFTER 013_lead_marketplace.sql, in the Supabase SQL Editor. Idempotent.
--
-- BUG THIS FIXES
-- 012 and 013 shipped policies that referenced each other's tables directly:
--
--   booking_teams.teams_select        -> reads booking_team_members
--   booking_team_members.*_select     -> reads booking_teams
--   leads.leads_select                -> reads lead_quotes
--   lead_quotes.quotes_select         -> reads leads
--
-- Evaluating either policy triggers the other, so Postgres aborts with
-- 42P17 "infinite recursion detected in policy". Every read on those four
-- tables returned HTTP 500.
--
-- The fix is the pattern already used by is_admin() and owns_order(): move the
-- cross-table lookup into a SECURITY DEFINER function. Such a function runs as
-- its owner and therefore does NOT re-enter RLS, breaking the cycle.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helpers — each reads ONE table, as owner, so no policy re-enters another
-- ---------------------------------------------------------------------------
create or replace function public.is_team_member(p_team_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.booking_team_members m
    where m.team_id = p_team_id and m.artist_id = p_user
  );
$$;

create or replace function public.is_team_leader(p_team_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.booking_teams t
    where t.id = p_team_id and t.leader_id = p_user
  );
$$;

create or replace function public.owns_rental(p_rental_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rental_bookings r
    where r.id = p_rental_id and r.customer_id = p_user
  );
$$;

create or replace function public.owns_lead(p_lead_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id and l.customer_id = p_user
  );
$$;

create or replace function public.has_quoted_on(p_lead_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lead_quotes q
    where q.lead_id = p_lead_id and q.artist_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Teams — same access rules, expressed without recursion
-- ---------------------------------------------------------------------------
drop policy if exists teams_select on public.booking_teams;
create policy teams_select on public.booking_teams
  for select using (
    public.is_admin()
    or leader_id = auth.uid()
    or public.is_team_member(id, auth.uid())
    or (rental_id is not null and public.owns_rental(rental_id, auth.uid()))
  );

drop policy if exists team_members_select on public.booking_team_members;
create policy team_members_select on public.booking_team_members
  for select using (
    public.is_admin()
    or artist_id = auth.uid()
    or public.is_team_leader(team_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Marketplace — same access rules, expressed without recursion
--
-- The sealed bid is unchanged: an artist still reads only their own quote, and
-- only the customer who posted the lead reads all of them.
-- ---------------------------------------------------------------------------
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select using (
    public.is_admin()
    or customer_id = auth.uid()
    or public.has_quoted_on(id, auth.uid())
  );

drop policy if exists quotes_select on public.lead_quotes;
create policy quotes_select on public.lead_quotes
  for select using (
    public.is_admin()
    or artist_id = auth.uid()
    or public.owns_lead(lead_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Verification — all four must return a row count, not an error
-- ---------------------------------------------------------------------------
select 'booking_teams'        as relation, count(*) from public.booking_teams
union all select 'booking_team_members', count(*) from public.booking_team_members
union all select 'leads',                 count(*) from public.leads
union all select 'lead_quotes',           count(*) from public.lead_quotes;

-- And the sealed bid still holds — an artist must not see a rival's amount.
-- Check as a signed-in artist in the app, not here (this runs as the owner).
