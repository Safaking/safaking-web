-- ============================================================================
-- SafaKing — 004 Rentals
--
-- Run AFTER 003_payments.sql, in the Supabase SQL Editor. Idempotent.
--
-- A rental is an EVENT booking, not a shipment:
--   N safas, for a date range, delivered to a venue, optionally with a Master
--   Safa Artist to tie them on the day.
--
-- Every price lives in the database and is set by an admin:
--   * per-product  -> products.rent_price_per_day / rent_deposit
--   * global knobs -> app_settings (artist rate, advance %, buffer days…)
-- Nothing is priced in the browser.
-- ============================================================================

do $$ begin
  create type rental_status as enum (
    'pending',    -- placed, awaiting admin confirmation
    'confirmed',  -- admin approved, stock committed
    'dispatched', -- safas sent / artist en route
    'active',     -- currently with the customer
    'returned',   -- safas back, deposit refundable
    'completed',  -- deposit settled, done
    'cancelled'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Admin-controlled global settings
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key,
  value       numeric not null,
  label       text not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value, label, description) values
  ('artist_per_safa_rate', 50,  'Artist rate per safa (₹)',
   'Charged per safa when a rental or booking includes artist tying.'),
  ('advance_rate',         0.5, 'Advance taken up front (0-1)',
   'Fraction of the total collected at checkout. 0.5 = 50%.'),
  ('min_rent_days',        1,   'Minimum rental days',
   'Shortest rental period a customer may book.'),
  ('max_rent_days',        30,  'Maximum rental days',
   'Longest rental period a customer may book.'),
  ('rental_buffer_days',   1,   'Buffer days between rentals',
   'Cleaning/turnaround days blocked after each rental before the safa is available again.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Rental pricing on the product (admin sets these per safa)
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists is_rentable        boolean not null default false;
alter table public.products add column if not exists rent_price_per_day integer;
alter table public.products add column if not exists rent_deposit       integer;

-- A rentable safa must be priced; otherwise it cannot appear in the rent flow.
comment on column public.products.rent_price_per_day is
  'Rent per unit per day, in rupees. Required when is_rentable.';
comment on column public.products.rent_deposit is
  'Refundable security deposit per unit, in rupees.';

-- ---------------------------------------------------------------------------
-- 3. Rental bookings
-- ---------------------------------------------------------------------------
create table if not exists public.rental_bookings (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references public.profiles(id) on delete set null,
  customer_name   text not null,
  customer_phone  text not null,
  customer_email  text,

  -- When
  start_date      date not null,
  end_date        date not null,
  rental_days     integer not null,

  -- Where
  venue_address   text not null,
  city            text,
  pincode         text not null,

  -- What
  safa_count      integer not null,

  -- Artist tying (pillar 2 folded into the rental)
  needs_artist    boolean not null default false,
  artist_id       uuid references public.profiles(id) on delete set null,
  artist_name     text,
  artist_amount   integer not null default 0,

  -- Money, all computed server-side
  rent_amount     integer not null default 0,
  deposit_amount  integer not null default 0,
  total_amount    integer not null default 0,
  advance_amount  integer not null default 0,
  balance_amount  integer not null default 0,
  deposit_refunded boolean not null default false,

  payment_status  text not null default 'advance_pending',
  status          rental_status not null default 'pending',

  razorpay_order_id   text,
  razorpay_payment_id text,

  notes           text,
  created_at      timestamptz not null default now(),

  constraint rental_dates_valid check (end_date >= start_date),
  constraint rental_count_positive check (safa_count > 0)
);

create index if not exists rental_bookings_dates_idx    on public.rental_bookings (start_date, end_date);
create index if not exists rental_bookings_customer_idx on public.rental_bookings (customer_id);
create index if not exists rental_bookings_artist_idx   on public.rental_bookings (artist_id);
create index if not exists rental_bookings_rzp_idx      on public.rental_bookings (razorpay_order_id);

create table if not exists public.rental_items (
  id               uuid primary key default gen_random_uuid(),
  rental_id        uuid not null references public.rental_bookings(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  product_name     text not null,
  quantity         integer not null default 1,
  -- Snapshot of the price at booking time, so later admin edits never rewrite
  -- what a customer already agreed to pay.
  unit_rent_per_day integer not null default 0,
  unit_deposit      integer not null default 0,
  line_rent         integer not null default 0,
  line_deposit      integer not null default 0
);

create index if not exists rental_items_rental_idx  on public.rental_items (rental_id);
create index if not exists rental_items_product_idx on public.rental_items (product_id);

-- Let a rental payment hang off the same ledger as an order payment.
alter table public.payments add column if not exists rental_id uuid references public.rental_bookings(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. Availability
--
-- A safa is a physical object: the same unit cannot be in two places on the
-- same weekend. Availability for a window is the stock the business owns minus
-- everything already committed to an overlapping rental (plus a turnaround
-- buffer after each one).
--
-- Statuses that do NOT hold stock: cancelled, completed, returned.
-- ---------------------------------------------------------------------------
create or replace function public.rental_availability(
  p_product_id uuid,
  p_start      date,
  p_end        date,
  p_exclude    uuid default null   -- ignore one booking (used when editing it)
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    coalesce((select stock from public.products where id = p_product_id), 0)
    - coalesce((
        select sum(ri.quantity)
        from public.rental_items ri
        join public.rental_bookings rb on rb.id = ri.rental_id
        where ri.product_id = p_product_id
          and rb.status in ('pending','confirmed','dispatched','active')
          and (p_exclude is null or rb.id <> p_exclude)
          -- Overlap, widened by the turnaround buffer on the returning side.
          and rb.start_date <= p_end
          and (rb.end_date + (select value from public.app_settings where key = 'rental_buffer_days')::integer) >= p_start
      ), 0)
  )::integer;
$$;

-- Convenience for the storefront: what is free for these dates, in one call.
create or replace function public.available_rentals(p_start date, p_end date)
returns table (
  id uuid, name text, image text, fabric text, color text,
  rent_price_per_day integer, rent_deposit integer, available integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.image, p.fabric, p.color,
         p.rent_price_per_day, p.rent_deposit,
         public.rental_availability(p.id, p_start, p_end) as available
  from public.products p
  where p.active
    and p.is_rentable
    and p.rent_price_per_day is not null
  order by p.sort_order, p.name;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.rental_bookings enable row level security;
alter table public.rental_items    enable row level security;
alter table public.app_settings    enable row level security;

-- Customers see their own rentals; the assigned artist sees the job; admin all.
-- No INSERT policy: rentals are created only by /api/rentals/create-order via
-- the service role, which is what keeps pricing server-side.
drop policy if exists rentals_select on public.rental_bookings;
create policy rentals_select on public.rental_bookings
  for select using (
    public.is_admin() or customer_id = auth.uid() or artist_id = auth.uid()
  );

drop policy if exists rentals_update on public.rental_bookings;
create policy rentals_update on public.rental_bookings
  for update using (public.is_admin() or artist_id = auth.uid())
  with check (public.is_admin() or artist_id = auth.uid());

drop policy if exists rentals_delete on public.rental_bookings;
create policy rentals_delete on public.rental_bookings
  for delete using (public.is_admin());

drop policy if exists rental_items_select on public.rental_items;
create policy rental_items_select on public.rental_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.rental_bookings rb
      where rb.id = rental_id
        and (rb.customer_id = auth.uid() or rb.artist_id = auth.uid())
    )
  );

-- Settings: readable by anyone (the storefront shows the artist rate), writable
-- by admins only.
drop policy if exists settings_select on public.app_settings;
create policy settings_select on public.app_settings for select using (true);

drop policy if exists settings_write on public.app_settings;
create policy settings_write on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Make the existing catalogue rentable so there is something to book.
--    Rent/day ≈ 12% of sale price, deposit ≈ 50%. Admin can change both in the
--    Products tab afterwards.
-- ---------------------------------------------------------------------------
update public.products
set is_rentable        = true,
    rent_price_per_day = greatest(199, round(price * 0.12)::integer),
    rent_deposit       = round(price * 0.5)::integer
where active and rent_price_per_day is null;

-- ---------------------------------------------------------------------------
-- 7. Verification
-- ---------------------------------------------------------------------------
select name, price, is_rentable, rent_price_per_day, rent_deposit, stock
from public.products
where active
order by sort_order;
