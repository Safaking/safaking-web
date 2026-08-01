-- ============================================================================
-- SafaKing — 008 Booking Protection  (spec item 2)
--
-- Run AFTER 007_reviews_portfolio.sql, in the Supabase SQL Editor. Idempotent.
--
--   Advance Payment Lock · Cancellation Policy · Refund Rules · Dispute Resolution
--   "कई बार ग्राहक या आर्टिस्ट आखिरी समय पर कैंसिल कर सकते हैं"
--
-- Real money now flows through Razorpay, so the refund percentage must be a
-- database fact rather than something a client sends or an admin recalculates
-- by hand. It is computed from the policy table at the moment of cancellation
-- and frozen onto the cancellation row.
-- ============================================================================

do $$ begin
  create type cancellation_state as enum ('requested','approved','rejected','refunded','no_refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispute_state as enum ('open','investigating','resolved','dismissed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Refund policy — admin-editable tiers
--
-- Read as: "cancel at least N days before the event and you get P% of the
-- advance back." The highest matching min_days_before wins.
-- ---------------------------------------------------------------------------
create table if not exists public.refund_rules (
  id              uuid primary key default gen_random_uuid(),
  min_days_before integer not null unique,
  refund_percent  integer not null check (refund_percent between 0 and 100),
  label           text not null,
  active          boolean not null default true,
  updated_at      timestamptz not null default now()
);

insert into public.refund_rules (min_days_before, refund_percent, label) values
  (30, 100, 'Cancelled 30+ days before the event — full advance refunded'),
  (15, 50,  'Cancelled 15-29 days before — half the advance refunded'),
  (7,  25,  'Cancelled 7-14 days before — quarter of the advance refunded'),
  (0,  0,   'Cancelled less than 7 days before — advance is not refundable')
on conflict (min_days_before) do nothing;

/**
 * The refund percentage for a cancellation this many days before the event.
 * Falls back to 0 rather than erroring: a missing policy must never hand out
 * a refund it was not configured to give.
 */
create or replace function public.refund_percent_for(p_days_before integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select refund_percent from public.refund_rules
     where active and min_days_before <= greatest(p_days_before, 0)
     order by min_days_before desc
     limit 1),
    0
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Cancellations
-- ---------------------------------------------------------------------------
create table if not exists public.cancellations (
  id              uuid primary key default gen_random_uuid(),
  rental_id       uuid references public.rental_bookings(id) on delete cascade,
  booking_id      uuid references public.artist_bookings(id) on delete cascade,
  order_id        uuid references public.orders(id) on delete cascade,

  requested_by    uuid references public.profiles(id) on delete set null,
  -- Who pulled out. An artist cancelling late is a different problem from a
  -- customer cancelling late, and the admin needs to see which it was.
  requested_role  text not null check (requested_role in ('customer','artist','admin')),
  reason          text not null,

  event_date      date,
  days_before     integer,
  -- Frozen at request time from refund_rules, so later policy edits never
  -- change what someone was already promised.
  refund_percent  integer not null default 0,
  advance_amount  integer not null default 0,
  refund_amount   integer not null default 0,

  status          cancellation_state not null default 'requested',
  admin_note      text,
  razorpay_refund_id text,
  reviewed_by     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),

  constraint cancellation_needs_one_subject check (
    (rental_id is not null)::int + (booking_id is not null)::int + (order_id is not null)::int = 1
  )
);

create index if not exists cancellations_status_idx on public.cancellations (status);
create unique index if not exists cancellations_one_open_rental
  on public.cancellations (rental_id) where rental_id is not null and status in ('requested','approved');
create unique index if not exists cancellations_one_open_booking
  on public.cancellations (booking_id) where booking_id is not null and status in ('requested','approved');

-- ---------------------------------------------------------------------------
-- 3. Disputes
-- ---------------------------------------------------------------------------
create table if not exists public.disputes (
  id           uuid primary key default gen_random_uuid(),
  rental_id    uuid references public.rental_bookings(id) on delete cascade,
  booking_id   uuid references public.artist_bookings(id) on delete cascade,

  raised_by    uuid references public.profiles(id) on delete set null,
  raised_role  text not null check (raised_role in ('customer','artist')),
  against_id   uuid references public.profiles(id) on delete set null,
  category     text not null check (category in (
                 'artist_no_show','late_arrival','quality','damage','payment','behaviour','other'
               )),
  description  text not null,

  status       dispute_state not null default 'open',
  resolution   text,
  resolved_by  uuid references public.profiles(id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),

  constraint dispute_needs_one_subject check (
    (rental_id is not null)::int + (booking_id is not null)::int = 1
  )
);

create index if not exists disputes_status_idx on public.disputes (status);

-- ---------------------------------------------------------------------------
-- 4. Advance Payment Lock
--
-- Once an advance is paid, the booking represents money and a held date. It
-- must not be quietly flipped to 'cancelled' by an ordinary update — that would
-- release the date and lose the audit trail of who cancelled and what refund
-- was owed. Cancelling a paid booking has to go through /api/bookings/cancel,
-- which writes a cancellations row first.
-- ---------------------------------------------------------------------------
create or replace function public.guard_paid_booking_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_record boolean;
begin
  if new.status = 'cancelled'
     and old.status <> 'cancelled'
     and coalesce(old.payment_status, '') in ('advance_paid', 'fully_paid') then

    if tg_table_name = 'rental_bookings' then
      select exists (select 1 from public.cancellations c where c.rental_id = new.id) into has_record;
    else
      select exists (select 1 from public.cancellations c where c.booking_id = new.id) into has_record;
    end if;

    if not has_record then
      raise exception
        'This booking has been paid for. Cancel it through the cancellation flow so the refund is calculated and recorded.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rental_bookings_guard_cancel on public.rental_bookings;
create trigger rental_bookings_guard_cancel
  before update on public.rental_bookings
  for each row execute function public.guard_paid_booking_cancel();

drop trigger if exists artist_bookings_guard_cancel on public.artist_bookings;
create trigger artist_bookings_guard_cancel
  before update on public.artist_bookings
  for each row execute function public.guard_paid_booking_cancel();

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.refund_rules   enable row level security;
alter table public.cancellations  enable row level security;
alter table public.disputes       enable row level security;

-- The policy must be public: a customer has to be able to read the refund terms
-- before they book, and again before they cancel.
drop policy if exists refund_rules_select on public.refund_rules;
create policy refund_rules_select on public.refund_rules for select using (true);

drop policy if exists refund_rules_write on public.refund_rules;
create policy refund_rules_write on public.refund_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- Cancellations are created by the server route (service role). Parties may read
-- their own; only an admin decides the outcome.
drop policy if exists cancellations_select on public.cancellations;
create policy cancellations_select on public.cancellations
  for select using (
    public.is_admin()
    or requested_by = auth.uid()
    or exists (select 1 from public.rental_bookings r
               where r.id = rental_id and (r.customer_id = auth.uid() or r.artist_id = auth.uid()))
    or exists (select 1 from public.artist_bookings b
               where b.id = booking_id and (b.customer_id = auth.uid() or b.artist_id = auth.uid()))
  );

drop policy if exists cancellations_update on public.cancellations;
create policy cancellations_update on public.cancellations
  for update using (public.is_admin()) with check (public.is_admin());

-- Disputes: either party may raise one about a booking they were part of.
drop policy if exists disputes_select on public.disputes;
create policy disputes_select on public.disputes
  for select using (
    public.is_admin() or raised_by = auth.uid() or against_id = auth.uid()
  );

drop policy if exists disputes_insert on public.disputes;
create policy disputes_insert on public.disputes
  for insert with check (
    raised_by = auth.uid()
    and (
      exists (select 1 from public.rental_bookings r
              where r.id = rental_id and (r.customer_id = auth.uid() or r.artist_id = auth.uid()))
      or exists (select 1 from public.artist_bookings b
                 where b.id = booking_id and (b.customer_id = auth.uid() or b.artist_id = auth.uid()))
    )
  );

drop policy if exists disputes_update on public.disputes;
create policy disputes_update on public.disputes
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Verification
-- ---------------------------------------------------------------------------
select min_days_before, refund_percent, label from public.refund_rules order by min_days_before desc;

select
  public.refund_percent_for(45) as at_45_days,
  public.refund_percent_for(20) as at_20_days,
  public.refund_percent_for(10) as at_10_days,
  public.refund_percent_for(2)  as at_2_days;
-- Expect: 100, 50, 25, 0
