-- ============================================================================
-- SafaKing — 010 Live Ops: Check-in & Emergency Replacement
--   (spec item 3 "Live Location System", item 7 "Emergency Replacement System")
--
-- Run AFTER 009_analytics_documents.sql, in the Supabase SQL Editor. Idempotent.
--
--   3. Artist Event पर पहुंचा या नहीं · Customer Track कर सके · Check-In / Check-Out
--   7. अगर कोई आर्टिस्ट नहीं पहुंचता → ऐप तुरंत नज़दीकी उपलब्ध आर्टिस्ट सुझाए
--
-- Replacement is only possible if the system knows an artist has NOT arrived,
-- so check-in comes first and the at-risk view is derived from its absence.
-- ============================================================================

do $$ begin
  create type checkin_stage as enum ('en_route','arrived','started','completed','no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type replacement_state as enum ('open','assigned','resolved','cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Timing rules (admin-controlled)
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, label, description) values
  ('checkin_expected_minutes', 60, 'Expected arrival (minutes before event)',
   'How early an artist should be marked arrived. Past this with no check-in, the booking is flagged at risk.'),
  ('event_start_hour', 17, 'Default event start hour (0-23)',
   'Used to judge lateness when a booking stores only a date. 17 = 5 PM.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Check-in trail
--
-- Append-only: every stage change is its own row, so the timeline of what
-- happened on the day survives even if someone later edits the booking.
-- Coordinates are optional — many artists will not grant location permission,
-- and the feature must work without it.
-- ---------------------------------------------------------------------------
create table if not exists public.booking_checkins (
  id          uuid primary key default gen_random_uuid(),
  rental_id   uuid references public.rental_bookings(id) on delete cascade,
  booking_id  uuid references public.artist_bookings(id) on delete cascade,
  artist_id   uuid not null references public.profiles(id) on delete cascade,
  stage       checkin_stage not null,
  latitude    numeric(9,6),
  longitude   numeric(9,6),
  note        text,
  created_at  timestamptz not null default now(),

  constraint checkin_needs_one_subject check (
    (rental_id is not null)::int + (booking_id is not null)::int = 1
  )
);

create index if not exists checkins_rental_idx  on public.booking_checkins (rental_id, created_at desc);
create index if not exists checkins_booking_idx on public.booking_checkins (booking_id, created_at desc);
create index if not exists checkins_artist_idx  on public.booking_checkins (artist_id, created_at desc);

-- Latest stage per booking, for the customer's tracking view.
create or replace view public.booking_checkin_latest
with (security_invoker = true)
as
select distinct on (coalesce(rental_id, booking_id))
  coalesce(rental_id, booking_id) as subject_id,
  rental_id,
  booking_id,
  artist_id,
  stage,
  latitude,
  longitude,
  note,
  created_at
from public.booking_checkins
order by coalesce(rental_id, booking_id), created_at desc;

-- ---------------------------------------------------------------------------
-- 3. Bookings at risk
--
-- An event today whose artist has not reached 'arrived' (or later) by the
-- expected time. Explicit no_show is always at risk regardless of clock.
-- ---------------------------------------------------------------------------
create or replace view public.bookings_at_risk
with (security_invoker = true)
as
with cfg as (
  select
    coalesce((select value from public.app_settings where key = 'checkin_expected_minutes'), 60)::int as lead_minutes,
    coalesce((select value from public.app_settings where key = 'event_start_hour'), 17)::int as start_hour
)
select
  r.id                as rental_id,
  null::uuid          as booking_id,
  r.customer_name,
  r.customer_phone,
  r.start_date        as event_date,
  r.pincode,
  r.venue_address,
  r.safa_count,
  r.artist_id,
  r.artist_name,
  coalesce(l.stage::text, 'no_checkin') as stage,
  l.created_at        as last_seen_at
from public.rental_bookings r
cross join cfg
left join public.booking_checkin_latest l on l.rental_id = r.id
where r.status in ('confirmed','dispatched','active')
  and r.needs_artist
  and r.start_date between current_date and current_date + 1
  and (
    l.stage is null
    or l.stage in ('en_route','no_show')
  )
  and (
    -- Past the point where they should already have arrived.
    now() >= (r.start_date + make_interval(hours => cfg.start_hour))
             - make_interval(mins => cfg.lead_minutes)
    or coalesce(l.stage::text, '') = 'no_show'
  )

union all

select
  null::uuid, b.id,
  b.customer_name, b.customer_phone,
  b.event_date, null, b.city_venue, null,
  b.artist_id, b.artist_name,
  coalesce(l.stage::text, 'no_checkin'), l.created_at
from public.artist_bookings b
cross join cfg
left join public.booking_checkin_latest l on l.booking_id = b.id
where b.status = 'assigned'
  and b.event_date between current_date and current_date + 1
  and (l.stage is null or l.stage in ('en_route','no_show'))
  and (
    now() >= (b.event_date + make_interval(hours => cfg.start_hour))
             - make_interval(mins => cfg.lead_minutes)
    or coalesce(l.stage::text, '') = 'no_show'
  );

-- ---------------------------------------------------------------------------
-- 4. Replacement requests
-- ---------------------------------------------------------------------------
create table if not exists public.replacement_requests (
  id                uuid primary key default gen_random_uuid(),
  rental_id         uuid references public.rental_bookings(id) on delete cascade,
  booking_id        uuid references public.artist_bookings(id) on delete cascade,
  original_artist_id uuid references public.profiles(id) on delete set null,
  replacement_artist_id uuid references public.profiles(id) on delete set null,
  reason            text not null,
  status            replacement_state not null default 'open',
  raised_by         uuid references public.profiles(id) on delete set null,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),

  constraint replacement_needs_one_subject check (
    (rental_id is not null)::int + (booking_id is not null)::int = 1
  )
);

create index if not exists replacements_status_idx on public.replacement_requests (status);

/**
 * Artists who could step in RIGHT NOW for this pincode and date.
 *
 * Reuses the normal matching ranking (exact pincode, then base city, then any
 * verified free artist) but excludes the artist who failed to show, and anyone
 * already committed that day.
 *
 * "Nearest" here means pincode then city — SafaKing does not hold artist
 * coordinates, so this is administrative proximity, not GPS distance.
 */
create or replace function public.emergency_matches(
  p_pincode text,
  p_date    date,
  p_exclude uuid
)
returns table (
  id uuid, display_name text, base_city text, phone text,
  safas_per_day integer, per_safa_rate integer,
  rating numeric, total_events integer, verified boolean, match_rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.display_name, m.base_city, a.phone,
         m.safas_per_day, m.per_safa_rate,
         m.rating, m.total_events, m.verified, m.match_rank
  from public.match_artists(p_pincode, p_date) m
  join public.artist_profiles a on a.id = m.id
  where p_exclude is null or m.id <> p_exclude
  order by m.match_rank, m.verified desc, m.rating desc nulls last;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.booking_checkins      enable row level security;
alter table public.replacement_requests  enable row level security;

-- The assigned artist writes their own check-ins; the customer, the artist and
-- an admin can read them (that is the "Customer Track कर सके" requirement).
drop policy if exists checkins_insert on public.booking_checkins;
create policy checkins_insert on public.booking_checkins
  for insert with check (artist_id = auth.uid() or public.is_admin());

drop policy if exists checkins_select on public.booking_checkins;
create policy checkins_select on public.booking_checkins
  for select using (
    public.is_admin()
    or artist_id = auth.uid()
    or exists (select 1 from public.rental_bookings r
               where r.id = rental_id and r.customer_id = auth.uid())
    or exists (select 1 from public.artist_bookings b
               where b.id = booking_id and b.customer_id = auth.uid())
  );

-- Append-only: no update or delete policy, so the timeline cannot be rewritten
-- after the fact.

drop policy if exists replacements_select on public.replacement_requests;
create policy replacements_select on public.replacement_requests
  for select using (
    public.is_admin()
    or original_artist_id = auth.uid()
    or replacement_artist_id = auth.uid()
  );

drop policy if exists replacements_write on public.replacement_requests;
create policy replacements_write on public.replacement_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Verification
-- ---------------------------------------------------------------------------
select key, value, label from public.app_settings
where key in ('checkin_expected_minutes','event_start_hour');

select count(*) as bookings_at_risk_now from public.bookings_at_risk;
