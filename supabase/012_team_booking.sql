-- ============================================================================
-- SafaKing — 012 Team Booking  (spec item 17)
--
-- Run AFTER 011_training.sql, in the Supabase SQL Editor. Idempotent.
--
--   बड़ी शादी में एक आर्टिस्ट पर्याप्त नहीं होता
--   Team Leader · Team Members · 5, 10, 20 आर्टिस्ट एक साथ बुक
--
-- rental_bookings.artist_id already names ONE artist. That column stays as the
-- point of contact, and is kept pointing at the team leader — every existing
-- screen, availability check and payout path keeps working unchanged, while the
-- team table carries the rest of the crew.
-- ============================================================================

do $$ begin
  create type team_member_state as enum ('invited','accepted','declined','removed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Teams
-- ---------------------------------------------------------------------------
create table if not exists public.booking_teams (
  id          uuid primary key default gen_random_uuid(),
  rental_id   uuid references public.rental_bookings(id) on delete cascade,
  booking_id  uuid references public.artist_bookings(id) on delete cascade,
  leader_id   uuid references public.profiles(id) on delete set null,
  target_size integer not null default 1 check (target_size > 0),
  safa_count  integer not null default 0,
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint team_needs_one_subject check (
    (rental_id is not null)::int + (booking_id is not null)::int = 1
  )
);

-- One team per booking. Two teams for one wedding would mean two crews turning
-- up and nobody knowing who is in charge.
create unique index if not exists teams_one_per_rental
  on public.booking_teams (rental_id) where rental_id is not null;
create unique index if not exists teams_one_per_booking
  on public.booking_teams (booking_id) where booking_id is not null;

create table if not exists public.booking_team_members (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.booking_teams(id) on delete cascade,
  artist_id    uuid not null references public.profiles(id) on delete cascade,
  is_leader    boolean not null default false,
  safas_assigned integer not null default 0,
  per_safa_rate  integer not null default 0,
  payout_amount  integer not null default 0,
  status       team_member_state not null default 'invited',
  responded_at timestamptz,
  created_at   timestamptz not null default now()
);

create unique index if not exists team_members_unique
  on public.booking_team_members (team_id, artist_id);
create index if not exists team_members_artist_idx
  on public.booking_team_members (artist_id);

-- Exactly one leader. A crew of ten with no named leader is how a wedding ends
-- up with nobody answering the customer's phone.
create unique index if not exists team_members_one_leader
  on public.booking_team_members (team_id) where is_leader;

-- ---------------------------------------------------------------------------
-- 2. Availability: an artist cannot be on two jobs the same day
-- ---------------------------------------------------------------------------
create or replace function public.team_event_date(p_team_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select r.start_date from public.rental_bookings r
     join public.booking_teams t on t.rental_id = r.id where t.id = p_team_id),
    (select b.event_date from public.artist_bookings b
     join public.booking_teams t on t.booking_id = b.id where t.id = p_team_id)
  );
$$;

create or replace function public.guard_team_member_free()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_day date;
  clash     boolean;
begin
  if new.status = 'declined' or new.status = 'removed' then
    return new;
  end if;

  event_day := public.team_event_date(new.team_id);
  if event_day is null then
    return new;
  end if;

  -- Already on another team that day?
  select exists (
    select 1
    from public.booking_team_members m
    join public.booking_teams t on t.id = m.team_id
    where m.artist_id = new.artist_id
      and m.team_id <> new.team_id
      and m.status in ('invited','accepted')
      and public.team_event_date(t.id) = event_day
  ) into clash;

  if clash then
    raise exception 'That artist is already on another team for %', event_day;
  end if;

  return new;
end;
$$;

drop trigger if exists team_members_guard_free on public.booking_team_members;
create trigger team_members_guard_free
  before insert or update on public.booking_team_members
  for each row execute function public.guard_team_member_free();

-- Keep the booking's single artist_id pointing at the leader, so every existing
-- screen and availability check continues to work without change.
create or replace function public.sync_team_leader()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  leader_name text;
begin
  if not new.is_leader then
    return new;
  end if;

  select * into t from public.booking_teams where id = new.team_id;
  select display_name into leader_name from public.artist_profiles where id = new.artist_id;

  if t.rental_id is not null then
    update public.rental_bookings
    set artist_id = new.artist_id, artist_name = leader_name
    where id = t.rental_id;
  elsif t.booking_id is not null then
    update public.artist_bookings
    set artist_id = new.artist_id, artist_name = leader_name, status = 'assigned'
    where id = t.booking_id;
  end if;

  update public.booking_teams set leader_id = new.artist_id where id = new.team_id;
  return new;
end;
$$;

drop trigger if exists team_members_sync_leader on public.booking_team_members;
create trigger team_members_sync_leader
  after insert or update on public.booking_team_members
  for each row execute function public.sync_team_leader();

-- ---------------------------------------------------------------------------
-- 3. Suggest a team
--
-- Walks the normal match ranking, accumulating artists until their combined
-- daily capacity covers the safa count. The first (best-ranked) artist is
-- proposed as leader.
-- ---------------------------------------------------------------------------
create or replace function public.suggest_team(
  p_pincode    text,
  p_date       date,
  p_safa_count integer
)
returns table (
  id uuid, display_name text, base_city text, phone text,
  safas_per_day integer, per_safa_rate integer,
  rating numeric, total_events integer, verified boolean,
  match_rank integer,
  suggested_leader boolean,
  safas_assigned integer,
  running_capacity integer
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select m.*, a.phone,
           row_number() over () as position,
           sum(m.safas_per_day) over (rows between unbounded preceding and current row) as running
    from public.match_artists(p_pincode, p_date) m
    join public.artist_profiles a on a.id = m.id
  )
  select
    r.id, r.display_name, r.base_city, r.phone,
    r.safas_per_day, r.per_safa_rate,
    r.rating, r.total_events, r.verified,
    r.match_rank,
    (r.position = 1) as suggested_leader,
    -- The last artist only takes the remainder, so nobody is asked to tie
    -- safas that do not exist.
    least(r.safas_per_day, greatest(0, p_safa_count - (r.running - r.safas_per_day)))::integer
      as safas_assigned,
    r.running::integer as running_capacity
  from ranked r
  -- Keep every artist needed to reach the count, and stop at the first one that
  -- completes it.
  where r.running - r.safas_per_day < p_safa_count
  order by r.position;
$$;

-- ---------------------------------------------------------------------------
-- 4. What an artist sees about their own team work
-- ---------------------------------------------------------------------------
create or replace view public.my_team_assignments
with (security_invoker = true)
as
select
  m.id            as member_id,
  m.artist_id,
  m.is_leader,
  m.safas_assigned,
  m.payout_amount,
  m.status,
  t.id            as team_id,
  t.target_size,
  t.safa_count,
  t.rental_id,
  t.booking_id,
  coalesce(r.start_date, b.event_date)     as event_date,
  coalesce(r.venue_address, b.city_venue)  as venue,
  coalesce(r.customer_name, b.customer_name) as customer_name,
  coalesce(r.customer_phone, b.customer_phone) as customer_phone,
  leader.display_name as leader_name
from public.booking_team_members m
join public.booking_teams t on t.id = m.team_id
left join public.rental_bookings r on r.id = t.rental_id
left join public.artist_bookings b on b.id = t.booking_id
left join public.artist_profiles leader on leader.id = t.leader_id;

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.booking_teams        enable row level security;
alter table public.booking_team_members enable row level security;

-- These lookups go through SECURITY DEFINER helpers rather than inline
-- sub-selects. A policy on booking_teams that reads booking_team_members, whose
-- own policy reads booking_teams, is mutual recursion and Postgres aborts with
-- 42P17. A definer function runs as its owner and does not re-enter RLS.
create or replace function public.is_team_member(p_team_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.booking_team_members m
                 where m.team_id = p_team_id and m.artist_id = p_user);
$fn$;

create or replace function public.is_team_leader(p_team_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.booking_teams t
                 where t.id = p_team_id and t.leader_id = p_user);
$fn$;

create or replace function public.owns_rental(p_rental_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.rental_bookings r
                 where r.id = p_rental_id and r.customer_id = p_user);
$fn$;

drop policy if exists teams_select on public.booking_teams;
create policy teams_select on public.booking_teams
  for select using (
    public.is_admin()
    or leader_id = auth.uid()
    or public.is_team_member(id, auth.uid())
    or (rental_id is not null and public.owns_rental(rental_id, auth.uid()))
  );

drop policy if exists teams_write on public.booking_teams;
create policy teams_write on public.booking_teams
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists team_members_select on public.booking_team_members;
create policy team_members_select on public.booking_team_members
  for select using (
    public.is_admin()
    or artist_id = auth.uid()
    or public.is_team_leader(team_id, auth.uid())
  );

-- Admins build the crew. An artist may only answer their own invitation, which
-- is enforced by the trigger below rather than by the policy alone.
drop policy if exists team_members_write on public.booking_team_members;
create policy team_members_write on public.booking_team_members
  for all using (public.is_admin() or artist_id = auth.uid())
  with check (public.is_admin() or artist_id = auth.uid());

create or replace function public.guard_team_member_self_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    -- An artist may accept or decline, and nothing else.
    if new.artist_id is distinct from old.artist_id
       or new.is_leader is distinct from old.is_leader
       or new.safas_assigned is distinct from old.safas_assigned
       or new.payout_amount is distinct from old.payout_amount then
      raise exception 'You may only accept or decline your own invitation';
    end if;
    if new.status not in ('accepted','declined') then
      raise exception 'Invalid response to a team invitation';
    end if;
    new.responded_at := now();
  end if;
  return new;
end; $$;

drop trigger if exists team_members_guard_self on public.booking_team_members;
create trigger team_members_guard_self
  before update on public.booking_team_members
  for each row execute function public.guard_team_member_self_edit();

-- ---------------------------------------------------------------------------
-- 6. Verification
-- ---------------------------------------------------------------------------
-- Replace the pincode/date with a real one to see a suggested crew of 100 safas:
-- select * from public.suggest_team('302001', current_date + 7, 100);
select count(*) as teams from public.booking_teams;
