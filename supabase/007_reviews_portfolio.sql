-- ============================================================================
-- SafaKing — 007 Ratings, Reviews & Portfolio  (spec items 5 and 6)
--
-- Run AFTER 006_verification.sql, in the Supabase SQL Editor. Idempotent.
--
--   5. Portfolio System   — photos, videos, previous events, reviews
--   6. Rating & Review    — Customer -> Artist, Artist -> Customer, Supplier
--
-- INTEGRITY IS THE POINT OF THIS FILE.
-- match_artists() already sorts by rating, so a fake review does not just
-- mislead one customer — it changes who gets matched to every future wedding.
-- A review is therefore only accepted when the database can prove the two
-- parties actually completed a booking together.
-- ============================================================================

do $$ begin
  create type review_subject as enum ('artist','customer','supplier');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_kind as enum ('photo','video');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Public bucket for portfolio media
--    Unlike verification documents, this material is meant to be seen.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Reviews
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  reviewer_id   uuid not null references public.profiles(id) on delete cascade,
  subject_type  review_subject not null,
  subject_id    uuid not null,          -- profiles.id, or supplier_profiles.id

  -- Exactly one of these must be set: the booking that earns the right to review.
  rental_id     uuid references public.rental_bookings(id) on delete cascade,
  booking_id    uuid references public.artist_bookings(id) on delete cascade,

  rating        integer not null check (rating between 1 and 5),
  comment       text,
  -- Admin moderation. Hidden reviews still count for nothing.
  visible       boolean not null default true,
  hidden_reason text,
  created_at    timestamptz not null default now(),

  constraint review_needs_one_booking check (
    (rental_id is not null and booking_id is null)
    or (rental_id is null and booking_id is not null)
  )
);

-- One review per booking, per direction. Stops a customer leaving five reviews
-- for the same wedding to inflate or tank an artist.
create unique index if not exists reviews_one_per_rental
  on public.reviews (rental_id, reviewer_id, subject_type) where rental_id is not null;
create unique index if not exists reviews_one_per_booking
  on public.reviews (booking_id, reviewer_id, subject_type) where booking_id is not null;

create index if not exists reviews_subject_idx on public.reviews (subject_type, subject_id);

/**
 * Can this reviewer review this subject, on the strength of this booking?
 *
 * Requires the booking to exist, to be finished, and for the reviewer and the
 * subject to be the two actual parties to it. Anything else is refused.
 */
create or replace function public.can_review(
  p_reviewer uuid,
  p_subject_type review_subject,
  p_subject_id uuid,
  p_rental_id uuid,
  p_booking_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ok boolean := false;
begin
  if p_rental_id is not null then
    select exists (
      select 1 from public.rental_bookings r
      where r.id = p_rental_id
        and r.status in ('returned','completed')
        and (
          -- customer reviewing the artist who served them
          (p_subject_type = 'artist'   and r.customer_id = p_reviewer and r.artist_id   = p_subject_id)
          -- artist reviewing the customer
          or (p_subject_type = 'customer' and r.artist_id = p_reviewer and r.customer_id = p_subject_id)
        )
    ) into ok;

  elsif p_booking_id is not null then
    select exists (
      select 1 from public.artist_bookings b
      where b.id = p_booking_id
        and b.status = 'completed'
        and (
          (p_subject_type = 'artist'   and b.customer_id = p_reviewer and b.artist_id   = p_subject_id)
          or (p_subject_type = 'customer' and b.artist_id = p_reviewer and b.customer_id = p_subject_id)
        )
    ) into ok;
  end if;

  return coalesce(ok, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Keep the artist's headline numbers honest
--
-- rating       = mean of visible reviews about them
-- total_events = bookings they actually finished, NOT the number of reviews
--                (most customers never leave one)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_artist_stats(p_artist_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rating numeric;
  v_events integer;
begin
  select round(avg(rating)::numeric, 1) into v_rating
  from public.reviews
  where subject_type = 'artist' and subject_id = p_artist_id and visible;

  select
    (select count(*) from public.artist_bookings
      where artist_id = p_artist_id and status = 'completed')
    + (select count(*) from public.rental_bookings
      where artist_id = p_artist_id and status in ('returned','completed'))
  into v_events;

  update public.artist_profiles
  -- A brand new artist shows 5.0 rather than 0, which would read as "terrible"
  -- instead of "not rated yet". The UI distinguishes the two via total_events.
  set rating = coalesce(v_rating, 5.0),
      total_events = coalesce(v_events, 0)
  where id = p_artist_id;
end;
$$;

create or replace function public.on_review_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_subject_type review_subject := coalesce(new.subject_type, old.subject_type);
  v_subject_id   uuid           := coalesce(new.subject_id, old.subject_id);
begin
  if v_subject_type = 'artist' then
    perform public.refresh_artist_stats(v_subject_id);
  elsif v_subject_type = 'supplier' then
    update public.supplier_profiles
    set rating = coalesce(
      (select round(avg(rating)::numeric, 1) from public.reviews
       where subject_type = 'supplier' and subject_id = v_subject_id and visible), 5.0)
    where id = v_subject_id;
  end if;

  return coalesce(new, old);
end; $$;

drop trigger if exists reviews_refresh_stats on public.reviews;
create trigger reviews_refresh_stats
  after insert or update or delete on public.reviews
  for each row execute function public.on_review_change();

-- A completed booking changes total_events even with no review attached.
create or replace function public.on_booking_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.artist_id is not null and new.status is distinct from old.status then
    perform public.refresh_artist_stats(new.artist_id);
  end if;
  return new;
end; $$;

drop trigger if exists artist_bookings_refresh_stats on public.artist_bookings;
create trigger artist_bookings_refresh_stats
  after update on public.artist_bookings
  for each row execute function public.on_booking_completed();

drop trigger if exists rental_bookings_refresh_stats on public.rental_bookings;
create trigger rental_bookings_refresh_stats
  after update on public.rental_bookings
  for each row execute function public.on_booking_completed();

-- ---------------------------------------------------------------------------
-- 4. Portfolio
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artist_profiles(id) on delete cascade,
  media_kind  media_kind not null default 'photo',
  -- Photos are uploaded to the public 'portfolio' bucket; videos may instead be
  -- a YouTube/Instagram link, so exactly one of these is set.
  storage_path text,
  external_url text,
  caption     text,
  event_name  text,
  event_date  date,
  sort_order  integer not null default 0,
  -- Admin can hide anything inappropriate without deleting the artist's work.
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint portfolio_needs_media check (storage_path is not null or external_url is not null)
);

create index if not exists portfolio_artist_idx on public.portfolio_items (artist_id, sort_order);

-- ---------------------------------------------------------------------------
-- 5. Public read view: an artist card a customer can browse before booking
-- ---------------------------------------------------------------------------
create or replace view public.artist_public_profiles as
select
  a.id,
  a.display_name,
  a.base_city,
  a.specialties,
  a.experience_years,
  a.safas_per_day,
  a.per_safa_rate,
  a.team_size,
  a.rating,
  a.total_events,
  a.verified,
  (select count(*) from public.reviews r
    where r.subject_type = 'artist' and r.subject_id = a.id and r.visible) as review_count,
  (select count(*) from public.portfolio_items p
    where p.artist_id = a.id and p.visible) as portfolio_count
from public.artist_profiles a
where a.active;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.reviews         enable row level security;
alter table public.portfolio_items enable row level security;

-- Anyone may read a visible review — that is the point of reviews.
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
  for select using (visible or public.is_admin() or reviewer_id = auth.uid());

-- You may only write a review the database can prove you earned.
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert with check (
    reviewer_id = auth.uid()
    and public.can_review(auth.uid(), subject_type, subject_id, rental_id, booking_id)
  );

-- Editing your own wording is fine; `visible` is admin-only (see trigger).
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews
  for update using (reviewer_id = auth.uid() or public.is_admin())
  with check (reviewer_id = auth.uid() or public.is_admin());

drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews
  for delete using (reviewer_id = auth.uid() or public.is_admin());

-- Only an admin may hide a review; otherwise an artist could bury bad feedback.
create or replace function public.guard_review_visibility()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visible is distinct from old.visible
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an administrator can hide or restore a review';
  end if;
  return new;
end; $$;

drop trigger if exists reviews_guard_visibility on public.reviews;
create trigger reviews_guard_visibility
  before update on public.reviews
  for each row execute function public.guard_review_visibility();

-- Portfolio: world-readable, artist-managed, admin-moderated.
drop policy if exists portfolio_select on public.portfolio_items;
create policy portfolio_select on public.portfolio_items
  for select using (visible or public.is_admin() or artist_id = auth.uid());

drop policy if exists portfolio_write on public.portfolio_items;
create policy portfolio_write on public.portfolio_items
  for all using (artist_id = auth.uid() or public.is_admin())
  with check (artist_id = auth.uid() or public.is_admin());

-- Storage: portfolio files are keyed by artist id as the first path segment.
drop policy if exists portfolio_read on storage.objects;
create policy portfolio_read on storage.objects
  for select using (bucket_id = 'portfolio');

drop policy if exists portfolio_upload on storage.objects;
create policy portfolio_upload on storage.objects
  for insert with check (
    bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists portfolio_remove on storage.objects;
create policy portfolio_remove on storage.objects
  for delete using (
    bucket_id = 'portfolio'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- 7. Verification
-- ---------------------------------------------------------------------------
select id, name, public from storage.buckets where id in ('portfolio','verification-docs');
select count(*) as artists_visible from public.artist_public_profiles;
