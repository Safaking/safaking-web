-- ============================================================================
-- SafaKing — 013 Lead Marketplace  (spec item 16)
--
-- Run AFTER 012_team_booking.sql, in the Supabase SQL Editor. Idempotent.
--
--   ग्राहक Inquiry डाले → नज़दीकी आर्टिस्टों को नोटिफिकेशन जाए
--   → आर्टिस्ट Quote भेजें → ग्राहक चुन सके
--
-- SEALED BIDS. An artist can see the lead and their OWN quote, never a rival's.
-- If artists could read each other's numbers the marketplace would collapse into
-- undercutting, the rate would fall below what a good artist will work for, and
-- the customer would end up with whoever was most desperate rather than best.
-- The customer sees every quote, because choosing is their job.
-- ============================================================================

do $$ begin
  create type lead_state as enum ('open','quoted','awarded','closed','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quote_state as enum ('submitted','withdrawn','accepted','rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references public.profiles(id) on delete set null,
  customer_name  text not null,
  customer_phone text not null,

  pincode        text not null,
  city           text,
  venue_address  text,
  event_date     date not null,
  guest_count    integer,
  safa_count     integer not null check (safa_count > 0),
  safa_style     text,
  description    text,
  budget_hint    integer,

  status         lead_state not null default 'open',
  awarded_quote_id uuid,
  -- Leads go stale: a wedding next Saturday is not worth quoting on the day
  -- after. Defaults to the event date.
  expires_on     date,
  created_at     timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads (status, event_date);
create index if not exists leads_pincode_idx on public.leads (pincode);
create index if not exists leads_customer_idx on public.leads (customer_id);

create or replace function public.set_lead_defaults()
returns trigger language plpgsql as $$
begin
  if new.expires_on is null then
    new.expires_on := new.event_date;
  end if;
  return new;
end; $$;

drop trigger if exists leads_defaults on public.leads;
create trigger leads_defaults
  before insert on public.leads
  for each row execute function public.set_lead_defaults();

-- ---------------------------------------------------------------------------
-- 2. Quotes
-- ---------------------------------------------------------------------------
create table if not exists public.lead_quotes (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads(id) on delete cascade,
  artist_id     uuid not null references public.profiles(id) on delete cascade,
  per_safa_rate integer not null check (per_safa_rate >= 0),
  total_amount  integer not null check (total_amount >= 0),
  message       text,
  can_bring_team boolean not null default false,
  status        quote_state not null default 'submitted',
  created_at    timestamptz not null default now()
);

-- One live quote per artist per lead. Repeat quoting would let an artist
-- shade their number downward until they win, which is the undercutting the
-- sealed-bid design exists to prevent.
create unique index if not exists quotes_one_per_artist
  on public.lead_quotes (lead_id, artist_id) where status <> 'withdrawn';

create index if not exists quotes_lead_idx on public.lead_quotes (lead_id);
create index if not exists quotes_artist_idx on public.lead_quotes (artist_id);

-- Move the lead to 'quoted' as soon as the first quote lands.
create or replace function public.on_quote_submitted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.leads
  set status = 'quoted'
  where id = new.lead_id and status = 'open';
  return new;
end; $$;

drop trigger if exists quotes_mark_lead on public.lead_quotes;
create trigger quotes_mark_lead
  after insert on public.lead_quotes
  for each row execute function public.on_quote_submitted();

-- ---------------------------------------------------------------------------
-- 3. Which leads should an artist see?
--
-- Open, not expired, in an area they serve, on a date they are free. Showing an
-- artist a lead they cannot fulfil wastes their time and produces quotes that
-- have to be withdrawn.
-- ---------------------------------------------------------------------------
create or replace function public.leads_for_artist(p_artist_id uuid)
returns table (
  id uuid, customer_name text, pincode text, city text, venue_address text,
  event_date date, guest_count integer, safa_count integer, safa_style text,
  description text, budget_hint integer, status lead_state, created_at timestamptz,
  quote_count integer, already_quoted boolean, match_rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id, l.customer_name, l.pincode, l.city, l.venue_address,
    l.event_date, l.guest_count, l.safa_count, l.safa_style,
    l.description, l.budget_hint, l.status, l.created_at,
    (select count(*) from public.lead_quotes q
      where q.lead_id = l.id and q.status = 'submitted')::integer as quote_count,
    exists (select 1 from public.lead_quotes q
            where q.lead_id = l.id and q.artist_id = p_artist_id
              and q.status <> 'withdrawn') as already_quoted,
    case
      when p_artist_id in (
        select m.id from public.match_artists(l.pincode, l.event_date) m where m.match_rank = 1
      ) then 1
      when p_artist_id in (
        select m.id from public.match_artists(l.pincode, l.event_date) m where m.match_rank = 2
      ) then 2
      else 3
    end as match_rank
  from public.leads l
  where l.status in ('open','quoted')
    and coalesce(l.expires_on, l.event_date) >= current_date
    and public.artist_is_free(p_artist_id, l.event_date)
  order by l.event_date;
$$;

-- ---------------------------------------------------------------------------
-- 4. Awarding
--
-- Accepting a quote closes the lead, rejects the rest, and creates the actual
-- booking at the agreed rate, so the number the artist quoted is the number
-- that gets charged.
-- ---------------------------------------------------------------------------
create or replace function public.accept_quote(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  l record;
  artist_name text;
  new_booking uuid;
  advance_rate numeric;
begin
  select * into q from public.lead_quotes where id = p_quote_id;
  if q is null then
    raise exception 'Quote not found';
  end if;

  select * into l from public.leads where id = q.lead_id;
  if l is null then
    raise exception 'Lead not found';
  end if;

  -- Only the customer who posted the lead may award it.
  if not (public.is_admin() or l.customer_id = auth.uid()) then
    raise exception 'Only the customer who posted this enquiry can accept a quote';
  end if;

  if l.status = 'awarded' then
    raise exception 'This enquiry has already been awarded';
  end if;
  if q.status <> 'submitted' then
    raise exception 'That quote is no longer available';
  end if;

  if not public.artist_is_free(q.artist_id, l.event_date) then
    raise exception 'That artist has since been booked for %. Please choose another quote.', l.event_date;
  end if;

  select display_name into artist_name from public.artist_profiles where id = q.artist_id;
  select value into advance_rate from public.app_settings where key = 'advance_rate';
  advance_rate := coalesce(advance_rate, 0.2);

  insert into public.artist_bookings (
    customer_id, customer_name, customer_phone,
    city_venue, event_date, safa_style,
    artist_id, artist_name,
    amount, advance_amount, balance_amount,
    payment_status, status, notes
  ) values (
    l.customer_id, l.customer_name, l.customer_phone,
    coalesce(l.venue_address, l.city, '') || ' (Pincode: ' || l.pincode || ')',
    l.event_date,
    coalesce(l.safa_style, 'Safa tying') || ' x ' || l.safa_count,
    q.artist_id, artist_name,
    q.total_amount,
    round(q.total_amount * advance_rate),
    q.total_amount - round(q.total_amount * advance_rate),
    'advance_pending', 'assigned',
    'Awarded from marketplace enquiry ' || left(l.id::text, 8)
  )
  returning id into new_booking;

  update public.lead_quotes set status = 'accepted' where id = p_quote_id;
  update public.lead_quotes set status = 'rejected'
    where lead_id = l.id and id <> p_quote_id and status = 'submitted';
  update public.leads set status = 'awarded', awarded_quote_id = p_quote_id where id = l.id;

  return new_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS — the sealed-bid rules live here
-- ---------------------------------------------------------------------------
alter table public.leads       enable row level security;
alter table public.lead_quotes enable row level security;

-- Anyone may post an enquiry, including a guest.
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert with check (customer_id is null or customer_id = auth.uid());

-- The customer sees their own. Artists reach leads through leads_for_artist(),
-- which is SECURITY DEFINER, so they do not need blanket read on this table.
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select using (
    public.is_admin()
    or customer_id = auth.uid()
    or exists (select 1 from public.lead_quotes q
               where q.lead_id = id and q.artist_id = auth.uid())
  );

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update using (public.is_admin() or customer_id = auth.uid())
  with check (public.is_admin() or customer_id = auth.uid());

-- An artist submits their own quote.
drop policy if exists quotes_insert on public.lead_quotes;
create policy quotes_insert on public.lead_quotes
  for insert with check (artist_id = auth.uid());

-- THE SEALED BID: an artist reads only their own quote. The customer who posted
-- the lead reads all of them. Admins see everything.
drop policy if exists quotes_select on public.lead_quotes;
create policy quotes_select on public.lead_quotes
  for select using (
    public.is_admin()
    or artist_id = auth.uid()
    or exists (select 1 from public.leads l
               where l.id = lead_id and l.customer_id = auth.uid())
  );

-- An artist may withdraw their own quote; awarding is done by accept_quote().
drop policy if exists quotes_update on public.lead_quotes;
create policy quotes_update on public.lead_quotes
  for update using (artist_id = auth.uid() or public.is_admin())
  with check (artist_id = auth.uid() or public.is_admin());

create or replace function public.guard_quote_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    -- An artist may only withdraw. Accepting or rejecting is the customer's
    -- decision and runs through accept_quote().
    if new.status not in ('withdrawn', old.status) then
      raise exception 'You may only withdraw your own quote';
    end if;
    if new.total_amount is distinct from old.total_amount
       or new.per_safa_rate is distinct from old.per_safa_rate then
      raise exception 'A submitted quote cannot be repriced. Withdraw it and quote again.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists quotes_guard_edit on public.lead_quotes;
create trigger quotes_guard_edit
  before update on public.lead_quotes
  for each row execute function public.guard_quote_edit();

-- ---------------------------------------------------------------------------
-- 6. Verification
-- ---------------------------------------------------------------------------
select count(*) as open_leads from public.leads where status in ('open','quoted');
