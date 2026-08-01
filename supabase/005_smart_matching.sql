-- ============================================================================
-- SafaKing — 005 Smart Matching Engine  (spec STEP 6)
--
-- Run AFTER 004_rentals.sql, in the Supabase SQL Editor. Idempotent.
--
--   जयपुर  ->  100 मेहमान  ->  100 साफा चाहिए  ->  2 आर्टिस्ट चाहिए  ->  कुल कीमत
--
-- To turn a guest count into a real quotation the engine needs three things
-- the database did not have yet:
--   1. which artists serve which pincodes, and how many safas each can tie a day
--   2. which of those artists are already committed on the event date
--   3. how many safas a guest count implies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Matching knobs (admin-controlled, same table as the other pricing rules)
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, label, description) values
  ('guest_to_safa_ratio', 1.0, 'Safas per guest',
   'How many safas a guest count implies. 1.0 = one safa per guest; 0.6 = only 60% of guests wear one.'),
  ('safas_per_artist',    50,  'Safas one artist can tie per day',
   'Drives how many artists a booking needs. 100 safas at 50 per artist = 2 artists.'),
  ('artist_travel_buffer_days', 0, 'Artist rest days between events',
   'Days blocked after an event before the same artist can be matched again.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Artist operating profile
--
-- profiles says someone IS an artist; this says where they work, how fast they
-- are, and what they charge. Created when an admin approves an application.
-- ---------------------------------------------------------------------------
create table if not exists public.artist_profiles (
  id                uuid primary key references public.profiles(id) on delete cascade,
  display_name      text not null,
  phone             text,
  base_city         text,
  -- Pincodes this artist will travel to. Empty means "matched by city only".
  service_pincodes  text[] not null default '{}',
  safas_per_day     integer not null default 50,
  per_safa_rate     integer not null default 50,
  team_size         integer not null default 1,
  specialties       text[] not null default '{}',
  experience_years  integer default 1,
  portfolio_link    text,
  verified          boolean not null default false,
  active            boolean not null default true,
  rating            numeric(2,1) default 5.0,
  total_events      integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists artist_profiles_city_idx on public.artist_profiles (base_city);
create index if not exists artist_profiles_active_idx on public.artist_profiles (active, verified);

-- Seed from any application an admin already approved, and from anyone whose
-- profile role is already 'artist', so matching has people to work with.
insert into public.artist_profiles
  (id, display_name, phone, base_city, safas_per_day, per_safa_rate, team_size,
   specialties, experience_years, portfolio_link, verified, active)
select
  aa.user_id,
  aa.full_name,
  aa.phone,
  aa.city,
  greatest(1, coalesce(aa.team_size, 1) * 50),
  coalesce(aa.per_safa_rate, 50),
  coalesce(aa.team_size, 1),
  coalesce(aa.specialties, '{}'),
  coalesce(aa.experience_years, 1),
  aa.portfolio_link,
  true,
  true
from public.artist_applications aa
where aa.status = 'approved' and aa.user_id is not null
on conflict (id) do nothing;

insert into public.artist_profiles (id, display_name, phone, base_city, verified, active)
select p.id, coalesce(nullif(p.full_name, ''), 'Safa Artist'), p.phone, p.city, false, true
from public.profiles p
where p.role::text = 'artist'
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Who is free on a given date?
--
-- An artist is committed if they are assigned to an artist_booking on that date,
-- or to a rental whose window covers it. Both are checked, because the same
-- person serves both flows.
-- ---------------------------------------------------------------------------
create or replace function public.artist_is_free(p_artist_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not (
    exists (
      select 1 from public.artist_bookings b
      where b.artist_id = p_artist_id
        and b.status in ('pending', 'assigned')
        and b.event_date = p_date
    )
    or exists (
      select 1 from public.rental_bookings r
      where r.artist_id = p_artist_id
        and r.status in ('pending', 'confirmed', 'dispatched', 'active')
        and p_date between r.start_date and r.end_date
    )
  );
$$;

/**
 * Artists who can serve p_pincode on p_date, best first.
 *
 * Matching is widened deliberately: an exact pincode match ranks highest, then
 * an artist whose base city matches the pincode's city, then anyone else who is
 * verified and free. A wedding with nobody matched is worse than a wedding
 * matched to someone an hour away.
 */
create or replace function public.match_artists(p_pincode text, p_date date)
returns table (
  id uuid,
  display_name text,
  base_city text,
  safas_per_day integer,
  per_safa_rate integer,
  team_size integer,
  rating numeric,
  total_events integer,
  verified boolean,
  match_rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select city_state from public.artist_pincodes where pincode = p_pincode and active
    union all
    select city_state from public.deliverable_pincodes where pincode = p_pincode and active
    limit 1
  )
  select
    a.id, a.display_name, a.base_city, a.safas_per_day, a.per_safa_rate,
    a.team_size, a.rating, a.total_events, a.verified,
    case
      when p_pincode = any (a.service_pincodes) then 1
      when a.base_city is not null
       and exists (select 1 from target t where t.city_state ilike '%' || a.base_city || '%') then 2
      else 3
    end as match_rank
  from public.artist_profiles a
  where a.active
    and public.artist_is_free(a.id, p_date)
  order by match_rank, a.verified desc, a.rating desc nulls last, a.total_events desc;
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS — customers must be able to see who they are being matched with
-- ---------------------------------------------------------------------------
alter table public.artist_profiles enable row level security;

drop policy if exists artist_profiles_select on public.artist_profiles;
create policy artist_profiles_select on public.artist_profiles
  for select using (active or public.is_admin() or id = auth.uid());

-- An artist may maintain their own profile; an admin may maintain anyone's.
-- 'verified' is deliberately writable only by an admin (see the trigger below).
drop policy if exists artist_profiles_update on public.artist_profiles;
create policy artist_profiles_update on public.artist_profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists artist_profiles_insert on public.artist_profiles;
create policy artist_profiles_insert on public.artist_profiles
  for insert with check (public.is_admin());

drop policy if exists artist_profiles_delete on public.artist_profiles;
create policy artist_profiles_delete on public.artist_profiles
  for delete using (public.is_admin());

-- Artists must not be able to mark themselves verified — that badge is the
-- whole point of admin approval.
create or replace function public.guard_artist_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verified is distinct from old.verified
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an administrator can change the verified badge';
  end if;
  return new;
end; $$;

drop trigger if exists artist_profiles_guard_verified on public.artist_profiles;
create trigger artist_profiles_guard_verified
  before update on public.artist_profiles
  for each row execute function public.guard_artist_verified();

-- ---------------------------------------------------------------------------
-- 5. Verification
-- ---------------------------------------------------------------------------
select count(*) as artist_profiles_seeded from public.artist_profiles;
select key, value, label from public.app_settings order by key;
