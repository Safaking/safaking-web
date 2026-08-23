-- ============================================================================
-- SafaKing — 016 Client Update Requirements
--   (from वेब अपडेट web update.docx — customer/artist/academy panel notes)
--
-- Run AFTER 015_contact.sql, in the Supabase SQL Editor. Idempotent.
--
-- This file is schema + server logic for every item in the document. Some
-- items (OTP/Happy Code, artist contact details, contracts) also ship full
-- UI in this same change; a few narrower ones (reschedule self-service,
-- printable shipping label, size-photo upload UI) are schema-ready but the
-- UI is flagged as follow-up in the accompanying report — do not assume a
-- table existing here means every screen for it exists yet.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Policy settings — every number in the document that a business owner
--    should be able to retune without a deploy.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, label, description) values
  ('groom_safa_advance_percent', 25, 'Groom safa advance (%)',
   'Advance required to place a groom-safa order (Point 19). Balance is cash on delivery or full payment, admin''s choice per order.'),
  ('postal_return_charge_percent', 10, 'Return postal charge (%)',
   'Deducted from the refunded advance when a groom safa is returned (Point 13/15).'),
  ('customer_date_change_free_days', 3, 'Free date-change window (days)',
   'Customer may change the wedding DATE without charge up to this many days before the event (Point 21).'),
  ('customer_time_change_free_days', 1, 'Free time-change window (days)',
   'Customer may change the wedding TIME without charge up to this many days before (Point 22).')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Artist contact + operating details
--    (Points N1, N3, N5, N10 — photo, distance, dual phone, WhatsApp, UPI)
-- ---------------------------------------------------------------------------
alter table public.artist_profiles add column if not exists photo_url       text;
alter table public.artist_profiles add column if not exists phone_alt       text;
alter table public.artist_profiles add column if not exists whatsapp_number text;
alter table public.artist_profiles add column if not exists upi_id         text;
alter table public.artist_profiles add column if not exists max_travel_km  integer default 50;

alter table public.artist_applications add column if not exists photo_url       text;
alter table public.artist_applications add column if not exists phone_alt       text not null default '';
alter table public.artist_applications add column if not exists whatsapp_number text;
alter table public.artist_applications add column if not exists upi_id         text;
alter table public.artist_applications add column if not exists max_travel_km  integer default 50;

-- Both numbers are required going forward; existing rows keep whatever they
-- have rather than being invalidated by a stricter constraint after the fact.

-- Carry the new fields into artist_profiles on approval, same as the existing seed.
create or replace function public.on_artist_application_approved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' and new.user_id is not null then
    insert into public.artist_profiles
      (id, display_name, phone, phone_alt, whatsapp_number, upi_id, photo_url,
       base_city, safas_per_day, per_safa_rate, team_size, max_travel_km,
       specialties, experience_years, portfolio_link, verified, active)
    values
      (new.user_id, new.full_name, new.phone, nullif(new.phone_alt, ''), new.whatsapp_number, new.upi_id,
       new.photo_url, new.city, greatest(1, coalesce(new.team_size,1) * 50), coalesce(new.per_safa_rate,50),
       coalesce(new.team_size,1), coalesce(new.max_travel_km, 50),
       coalesce(new.specialties, '{}'), coalesce(new.experience_years,1), new.portfolio_link, true, true)
    on conflict (id) do update set
      phone_alt = coalesce(excluded.phone_alt, public.artist_profiles.phone_alt),
      whatsapp_number = coalesce(excluded.whatsapp_number, public.artist_profiles.whatsapp_number),
      upi_id = coalesce(excluded.upi_id, public.artist_profiles.upi_id),
      photo_url = coalesce(excluded.photo_url, public.artist_profiles.photo_url),
      max_travel_km = excluded.max_travel_km,
      verified = true, active = true;
  end if;
  return new;
end; $$;

drop trigger if exists artist_applications_approved on public.artist_applications;
create trigger artist_applications_approved
  after update on public.artist_applications
  for each row execute function public.on_artist_application_approved();

-- ---------------------------------------------------------------------------
-- 2. Contracts — versioned text, ticked acceptance, both audiences
--    (N6 artist contract; Points 14/15 customer contract)
-- ---------------------------------------------------------------------------
do $$ begin
  create type contract_audience as enum ('artist','customer');
exception when duplicate_object then null; end $$;

create table if not exists public.contracts (
  id         uuid primary key default gen_random_uuid(),
  audience   contract_audience not null,
  version    integer not null default 1,
  title      text not null,
  body       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists contracts_one_active_per_audience
  on public.contracts (audience) where active;

create table if not exists public.contract_acceptances (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.contracts(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete set null,
  rental_id    uuid references public.rental_bookings(id) on delete cascade,
  booking_id   uuid references public.artist_bookings(id) on delete cascade,
  order_id     uuid references public.orders(id) on delete cascade,
  accepted_at  timestamptz not null default now()
);

create index if not exists contract_acceptances_contract_idx on public.contract_acceptances (contract_id);
create index if not exists contract_acceptances_user_idx on public.contract_acceptances (user_id);

-- Default contract text — admin can edit the row afterwards.
insert into public.contracts (audience, title, body)
select 'artist', 'Safa Artist Service Agreement',
  'By accepting a booking I agree to: arrive at the venue on time; wear a helmet while riding to the venue; '
  || 'carry valid personal insurance for travel; never accept payment directly from the customer — all payment '
  || 'is handled by SafaKing; if I cannot reach a booking after accepting it, I will arrange a replacement artist '
  || 'through SafaKing so the order is still completed — the order cannot simply be cancelled once accepted; '
  || 'and I will maintain professional conduct throughout. I understand that changing an accepted date within '
  || (select value::text from public.app_settings where key='customer_date_change_free_days') || ' days of the '
  || 'wedding without a valid reason affects my rating.'
where not exists (select 1 from public.contracts where audience = 'artist');

insert into public.contracts (audience, title, body)
select 'customer', 'Booking Terms',
  'I understand that: SafaKing does not accept returns on tied/used safas — if a safa is returned in usable, '
  || 'unused condition a postal handling charge applies and is deducted from my advance; a damaged, cut or used '
  || 'safa is not eligible for any refund of the advance paid; I must provide accurate sizing and a complete '
  || 'postal address with pincode at the time of booking; I must not pay the assigned artist directly — all '
  || 'payment is handled by SafaKing, and the company is not responsible for any payment made directly to an '
  || 'artist; and changing my wedding date or time close to the event may attract a change fee as shown at checkout.'
where not exists (select 1 from public.contracts where audience = 'customer');

-- ---------------------------------------------------------------------------
-- 3. OTP + Happy Code  (N8 — the payment/rating gate)
--
--   1. Customer is shown a 6-digit ARRIVAL code on their booking page.
--   2. Artist arrives, asks the customer for it, enters it in the app.
--      Correct code -> booking marked 'arrived' automatically.
--   3. Job finishes. Customer is shown a 6-digit COMPLETION ("happy") code.
--   4. Artist enters it. Correct code -> marked 'completed', payment moves to
--      'ready_for_review'. SafaKing calls the customer to confirm, THEN an
--      admin releases payment. The customer is then prompted to rate.
--
-- Codes are visible to the customer and an admin only — never to the artist
-- directly — which is why verification runs through a SECURITY DEFINER
-- function rather than a direct table read.
-- ---------------------------------------------------------------------------
alter table public.rental_bookings   add column if not exists arrival_otp           text;
alter table public.rental_bookings   add column if not exists completion_code       text;
alter table public.rental_bookings   add column if not exists otp_verified_at       timestamptz;
alter table public.rental_bookings   add column if not exists happy_code_verified_at timestamptz;
alter table public.rental_bookings   add column if not exists payment_release_status text not null default 'not_applicable';
alter table public.rental_bookings   add column if not exists payment_released_at    timestamptz;

alter table public.artist_bookings   add column if not exists arrival_otp           text;
alter table public.artist_bookings   add column if not exists completion_code       text;
alter table public.artist_bookings   add column if not exists otp_verified_at       timestamptz;
alter table public.artist_bookings   add column if not exists happy_code_verified_at timestamptz;
alter table public.artist_bookings   add column if not exists payment_release_status text not null default 'not_applicable';
alter table public.artist_bookings   add column if not exists payment_released_at    timestamptz;

create or replace function public.random_6digit()
returns text language sql volatile as $$
  select lpad((floor(random() * 1000000))::text, 6, '0');
$$;

-- Generates both codes once an artist is assigned, and moves the release
-- status out of 'not_applicable' so the admin queue knows to expect this job.
create or replace function public.ensure_service_codes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.artist_id is not null and new.arrival_otp is null then
    new.arrival_otp := public.random_6digit();
    new.completion_code := public.random_6digit();
    new.payment_release_status := 'pending';
  end if;
  return new;
end; $$;

drop trigger if exists rental_bookings_service_codes on public.rental_bookings;
create trigger rental_bookings_service_codes
  before insert or update on public.rental_bookings
  for each row execute function public.ensure_service_codes();

drop trigger if exists artist_bookings_service_codes on public.artist_bookings;
create trigger artist_bookings_service_codes
  before insert or update on public.artist_bookings
  for each row execute function public.ensure_service_codes();

-- The artist calls this with what the customer told them out loud. It never
-- returns the stored code, only whether the attempt matched.
create or replace function public.verify_arrival_code(
  p_kind text,             -- 'rental' | 'booking'
  p_id   uuid,
  p_code text,
  p_lat  numeric default null,
  p_lng  numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored text;
  who    uuid;
begin
  if p_kind = 'rental' then
    select arrival_otp, artist_id into stored, who from public.rental_bookings where id = p_id for update;
  else
    select arrival_otp, artist_id into stored, who from public.artist_bookings where id = p_id for update;
  end if;

  if who is distinct from auth.uid() and not public.is_admin() then
    raise exception 'You are not the assigned artist for this booking';
  end if;
  if stored is null or stored <> p_code then
    return false;
  end if;

  if p_kind = 'rental' then
    update public.rental_bookings set otp_verified_at = now() where id = p_id;
    insert into public.booking_checkins (rental_id, artist_id, stage, latitude, longitude)
    values (p_id, who, 'arrived', p_lat, p_lng);
  else
    update public.artist_bookings set otp_verified_at = now() where id = p_id;
    insert into public.booking_checkins (booking_id, artist_id, stage, latitude, longitude)
    values (p_id, who, 'arrived', p_lat, p_lng);
  end if;

  return true;
end;
$$;

-- Same shape, for the completion / happy code.
create or replace function public.verify_completion_code(
  p_kind text,
  p_id   uuid,
  p_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored text;
  who    uuid;
begin
  if p_kind = 'rental' then
    select completion_code, artist_id into stored, who from public.rental_bookings where id = p_id for update;
  else
    select completion_code, artist_id into stored, who from public.artist_bookings where id = p_id for update;
  end if;

  if who is distinct from auth.uid() and not public.is_admin() then
    raise exception 'You are not the assigned artist for this booking';
  end if;
  if stored is null or stored <> p_code then
    return false;
  end if;

  if p_kind = 'rental' then
    update public.rental_bookings
    set happy_code_verified_at = now(), payment_release_status = 'ready_for_review'
    where id = p_id;
    insert into public.booking_checkins (rental_id, artist_id, stage) values (p_id, who, 'completed');
  else
    update public.artist_bookings
    set happy_code_verified_at = now(), payment_release_status = 'ready_for_review', status = 'completed'
    where id = p_id;
    insert into public.booking_checkins (booking_id, artist_id, stage) values (p_id, who, 'completed');
  end if;

  return true;
end;
$$;

-- Admin-only: the explicit "we called the customer, pay the artist now" step.
-- Deliberately a separate, human action rather than automatic on the happy
-- code — the document is explicit that the company calls the customer first.
create or replace function public.release_booking_payment(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can release payment';
  end if;

  if p_kind = 'rental' then
    update public.rental_bookings
    set payment_release_status = 'released', payment_released_at = now()
    where id = p_id and payment_release_status = 'ready_for_review';
  else
    update public.artist_bookings
    set payment_release_status = 'released', payment_released_at = now()
    where id = p_id and payment_release_status = 'ready_for_review';
  end if;

  if not found then
    raise exception 'This booking is not ready for payment release';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Live location while an artist is out on a job (Point N9, N11)
--    Separate from booking_checkins (discrete stages): this is a stream of
--    pings so a customer can watch the artist get closer, from departure
--    until the job is marked complete.
-- ---------------------------------------------------------------------------
create table if not exists public.artist_locations (
  id          uuid primary key default gen_random_uuid(),
  rental_id   uuid references public.rental_bookings(id) on delete cascade,
  booking_id  uuid references public.artist_bookings(id) on delete cascade,
  artist_id   uuid not null references public.profiles(id) on delete cascade,
  latitude    numeric(9,6) not null,
  longitude   numeric(9,6) not null,
  eta_minutes integer,
  recorded_at timestamptz not null default now(),

  constraint artist_location_needs_one_subject check (
    (rental_id is not null)::int + (booking_id is not null)::int = 1
  )
);

create index if not exists artist_locations_rental_idx  on public.artist_locations (rental_id, recorded_at desc);
create index if not exists artist_locations_booking_idx on public.artist_locations (booking_id, recorded_at desc);

-- Latest ping only — what the customer's tracking screen actually needs.
create or replace view public.artist_location_latest
with (security_invoker = true)
as
select distinct on (coalesce(rental_id, booking_id))
  coalesce(rental_id, booking_id) as subject_id,
  rental_id, booking_id, artist_id, latitude, longitude, eta_minutes, recorded_at
from public.artist_locations
order by coalesce(rental_id, booking_id), recorded_at desc;

-- ---------------------------------------------------------------------------
-- 5. What the ARTIST is allowed to see of the CUSTOMER's location
--    (Artist Panel Point 3): village/city name only, never the full address
--    or the party/host name, and only once the wedding date has arrived.
-- ---------------------------------------------------------------------------
alter table public.artist_bookings add column if not exists venue_city text;

create or replace function public.artist_visible_venue(p_kind text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  who       uuid;
  the_date  date;
  city_only text;
begin
  if p_kind = 'rental' then
    select artist_id, start_date, city into who, the_date, city_only
    from public.rental_bookings where id = p_id;
  else
    select artist_id, event_date, venue_city into who, the_date, city_only
    from public.artist_bookings where id = p_id;
  end if;

  if who is distinct from auth.uid() and not public.is_admin() then
    return null;
  end if;
  if current_date < the_date then
    return 'Available on the wedding day';
  end if;

  return coalesce(city_only, 'City not recorded');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Groom safa sizing at checkout (Point 16) — photo + note per line item,
--    plus the printable postal address the doc asks for is already on
--    orders.shipping_address; wedding date is added here for orders that
--    carry one (Point 17).
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists wedding_date date;

insert into storage.buckets (id, name, public)
values ('order-customizations', 'order-customizations', false)
on conflict (id) do nothing;

create table if not exists public.order_item_customizations (
  id             uuid primary key default gen_random_uuid(),
  order_item_id  uuid not null references public.order_items(id) on delete cascade,
  size_note      text,
  size_photo_path text,
  created_at     timestamptz not null default now()
);

create unique index if not exists order_item_customizations_one_per_item
  on public.order_item_customizations (order_item_id);

alter table public.order_item_customizations enable row level security;

create or replace function public.owns_order_item(p_order_item_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = p_order_item_id and o.customer_id = p_user
  );
$$;

drop policy if exists order_item_customizations_select on public.order_item_customizations;
create policy order_item_customizations_select on public.order_item_customizations
  for select using (public.is_admin() or public.owns_order_item(order_item_id, auth.uid()));

drop policy if exists order_item_customizations_insert on public.order_item_customizations;
create policy order_item_customizations_insert on public.order_item_customizations
  for insert with check (public.is_admin() or public.owns_order_item(order_item_id, auth.uid()));

drop policy if exists order_item_customizations_update on public.order_item_customizations;
create policy order_item_customizations_update on public.order_item_customizations
  for update using (public.is_admin() or public.owns_order_item(order_item_id, auth.uid()))
  with check (public.is_admin() or public.owns_order_item(order_item_id, auth.uid()));

-- Storage: sizing photos are private, keyed by order id as the first path segment.
drop policy if exists order_customization_read on storage.objects;
create policy order_customization_read on storage.objects
  for select using (
    bucket_id = 'order-customizations'
    and (
      public.is_admin()
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1] and o.customer_id = auth.uid()
      )
    )
  );

drop policy if exists order_customization_upload on storage.objects;
create policy order_customization_upload on storage.objects
  for insert with check (
    bucket_id = 'order-customizations'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and (o.customer_id = auth.uid() or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Order returns + postal charge deduction (Points 13, 15, 18)
--
-- orders.status is plain text on the live database (confirmed by probing it
-- directly: an invalid literal was accepted rather than rejected, which a
-- real enum would refuse) — there is no order_status TYPE to extend here, only
-- new values the application starts writing. A CHECK constraint would be nice
-- but is deliberately skipped: the live column may already hold values this
-- migration cannot enumerate in advance, and a constraint that rejects an
-- existing row would abort the whole script exactly like the earlier
-- tying_bookings bug did.
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists return_reason        text;
alter table public.orders add column if not exists return_requested_at  timestamptz;
alter table public.orders add column if not exists postal_charge_deducted integer;

-- ---------------------------------------------------------------------------
-- 8. Academy panel fields (Points 1-6 under एकेडमी पेनल)
-- ---------------------------------------------------------------------------
alter table public.academy_enrollments add column if not exists photo_url          text;
alter table public.academy_enrollments add column if not exists gender             text check (gender in ('male','female','other'));
alter table public.academy_enrollments add column if not exists qualification      text;
alter table public.academy_enrollments add column if not exists current_occupation text;
alter table public.academy_enrollments add column if not exists wants_to_join_platform boolean not null default false;
alter table public.academy_enrollments add column if not exists nearest_hq_city    text;

-- ---------------------------------------------------------------------------
-- 9. RLS for the new tables
-- ---------------------------------------------------------------------------
alter table public.contracts            enable row level security;
alter table public.contract_acceptances enable row level security;
alter table public.artist_locations     enable row level security;

drop policy if exists contracts_select on public.contracts;
create policy contracts_select on public.contracts for select using (true);

drop policy if exists contracts_write on public.contracts;
create policy contracts_write on public.contracts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists contract_acceptances_insert on public.contract_acceptances;
create policy contract_acceptances_insert on public.contract_acceptances
  for insert with check (user_id is null or user_id = auth.uid());

drop policy if exists contract_acceptances_select on public.contract_acceptances;
create policy contract_acceptances_select on public.contract_acceptances
  for select using (public.is_admin() or user_id = auth.uid());

drop policy if exists artist_locations_insert on public.artist_locations;
create policy artist_locations_insert on public.artist_locations
  for insert with check (artist_id = auth.uid());

drop policy if exists artist_locations_select on public.artist_locations;
create policy artist_locations_select on public.artist_locations
  for select using (
    public.is_admin()
    or artist_id = auth.uid()
    or (rental_id is not null and public.owns_rental(rental_id, auth.uid()))
    or (booking_id is not null and exists (
          select 1 from public.artist_bookings b
          where b.id = booking_id and b.customer_id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 10. Verification
-- ---------------------------------------------------------------------------
select audience, title, active from public.contracts;
select key, value, label from public.app_settings
where key in ('groom_safa_advance_percent','postal_return_charge_percent',
              'customer_date_change_free_days','customer_time_change_free_days');
