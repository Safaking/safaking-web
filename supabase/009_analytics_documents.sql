-- ============================================================================
-- SafaKing — 009 Analytics & Documents  (spec items 13 and 14)
--
-- Run AFTER 008_booking_protection.sql, in the Supabase SQL Editor. Idempotent.
--
--   13. कौन सा डिज़ाइन सबसे ज्यादा बुक हुआ · कौन सा आर्टिस्ट सबसे ज्यादा बुक हुआ · Revenue Reports
--   14. Booking Confirmation PDF · Invoice · Certificate PDF
--
-- Views use security_invoker so ordinary RLS still applies: an admin sees the
-- whole business, a customer sees only their own rows. Without it a view would
-- run as its owner and quietly leak every order to anyone who queried it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Invoice numbering
--
-- A gapless-enough, human-quotable series. Sequences skip on rollback, which is
-- fine for a reference but means these are NOT a statutory GST invoice series —
-- if you register for GST, that numbering has its own rules.
-- ---------------------------------------------------------------------------
create sequence if not exists public.invoice_seq start 1001;

alter table public.orders          add column if not exists invoice_number text;
alter table public.rental_bookings add column if not exists invoice_number text;

create unique index if not exists orders_invoice_number_key
  on public.orders (invoice_number) where invoice_number is not null;
create unique index if not exists rentals_invoice_number_key
  on public.rental_bookings (invoice_number) where invoice_number is not null;

/**
 * Assigns an invoice number the first time one is asked for, then returns the
 * same number forever. Re-printing an invoice must never mint a new number.
 */
create or replace function public.ensure_invoice_number(
  p_kind text,        -- 'order' | 'rental'
  p_id   uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text;
  minted   text;
begin
  if p_kind = 'order' then
    select invoice_number into existing from public.orders where id = p_id;
  else
    select invoice_number into existing from public.rental_bookings where id = p_id;
  end if;

  if existing is not null then
    return existing;
  end if;

  minted := 'SK-' || to_char(now(), 'YYYY') || '-' || nextval('public.invoice_seq');

  if p_kind = 'order' then
    update public.orders set invoice_number = minted where id = p_id;
  else
    update public.rental_bookings set invoice_number = minted where id = p_id;
  end if;

  return minted;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Business identity, printed on every document
-- ---------------------------------------------------------------------------
create table if not exists public.business_profile (
  id          boolean primary key default true check (id),  -- single row
  legal_name  text not null default 'SafaKing Turban House',
  address     text not null default 'Jaipur, Rajasthan, India',
  phone       text not null default '+91 90013 47143',
  email       text,
  gst_number  text,
  -- Printed under the total. Keep it factual; this is a legal-ish document.
  invoice_footer text default 'Thank you for choosing SafaKing.',
  updated_at  timestamptz not null default now()
);

insert into public.business_profile (id) values (true) on conflict (id) do nothing;

alter table public.business_profile enable row level security;

drop policy if exists business_profile_select on public.business_profile;
create policy business_profile_select on public.business_profile for select using (true);

drop policy if exists business_profile_write on public.business_profile;
create policy business_profile_write on public.business_profile
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Analytics
-- ---------------------------------------------------------------------------

-- "कौन सा डिज़ाइन सबसे ज्यादा बुक हुआ" — combines sales and rentals, because a
-- design popular for rental is just as much a signal as one popular for sale.
create or replace view public.analytics_top_products
with (security_invoker = true)
as
with sold as (
  select oi.product_id, oi.product_name,
         sum(oi.quantity)              as units,
         sum(oi.price * oi.quantity)   as revenue,
         count(distinct oi.order_id)   as bookings
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status <> 'cancelled'
  group by oi.product_id, oi.product_name
),
rented as (
  select ri.product_id, ri.product_name,
         sum(ri.quantity)   as units,
         sum(ri.line_rent)  as revenue,
         count(distinct ri.rental_id) as bookings
  from public.rental_items ri
  join public.rental_bookings r on r.id = ri.rental_id
  where r.status <> 'cancelled'
  group by ri.product_id, ri.product_name
)
select
  coalesce(s.product_id, r.product_id)     as product_id,
  coalesce(s.product_name, r.product_name) as product_name,
  coalesce(s.units, 0)     as units_sold,
  coalesce(r.units, 0)     as units_rented,
  coalesce(s.units, 0) + coalesce(r.units, 0)       as total_units,
  coalesce(s.revenue, 0)   as sale_revenue,
  coalesce(r.revenue, 0)   as rental_revenue,
  coalesce(s.revenue, 0) + coalesce(r.revenue, 0)   as total_revenue,
  coalesce(s.bookings, 0) + coalesce(r.bookings, 0) as times_booked
from sold s
full outer join rented r on r.product_id = s.product_id
order by total_units desc;

-- "कौन सा आर्टिस्ट सबसे ज्यादा बुक हुआ"
--
-- The counts are computed in an inner select and ordered in an outer one.
-- Postgres accepts a bare output alias in ORDER BY but rejects one used inside
-- an expression, so `order by tying_bookings + rental_bookings` is invalid —
-- hence the wrapper rather than repeating both subqueries.
create or replace view public.analytics_top_artists
with (security_invoker = true)
as
select *
from (
  select
    a.id            as artist_id,
    a.display_name,
    a.base_city,
    a.verified,
    a.rating,
    a.total_events,
    (select count(*) from public.artist_bookings b
      where b.artist_id = a.id and b.status <> 'cancelled')       as tying_bookings,
    (select count(*) from public.rental_bookings r
      where r.artist_id = a.id and r.status <> 'cancelled')       as rental_bookings,
    (select coalesce(sum(r.artist_amount), 0) from public.rental_bookings r
      where r.artist_id = a.id and r.status <> 'cancelled')       as artist_earnings,
    (select count(*) from public.reviews rv
      where rv.subject_type = 'artist' and rv.subject_id = a.id and rv.visible) as review_count
  from public.artist_profiles a
  where a.active
) ranked
order by (tying_bookings + rental_bookings) desc, rating desc nulls last;

-- Revenue Reports (spec STEP 10). Deposits are excluded from rental revenue —
-- a refundable deposit is a liability held on the customer's behalf, not income.
create or replace view public.analytics_revenue_monthly
with (security_invoker = true)
as
select
  month,
  sum(sale_revenue)   as sale_revenue,
  sum(rental_revenue) as rental_revenue,
  sum(artist_revenue) as artist_revenue,
  sum(deposits_held)  as deposits_held,
  sum(sale_revenue + rental_revenue + artist_revenue) as total_revenue,
  sum(order_count)    as order_count,
  sum(rental_count)   as rental_count
from (
  select
    date_trunc('month', o.created_at)::date as month,
    sum(o.total_amount) as sale_revenue,
    0 as rental_revenue, 0 as artist_revenue, 0 as deposits_held,
    count(*) as order_count, 0 as rental_count
  from public.orders o
  where o.status <> 'cancelled'
  group by 1

  union all

  select
    date_trunc('month', r.created_at)::date,
    0,
    sum(r.rent_amount),
    sum(r.artist_amount),
    sum(r.deposit_amount) filter (where not r.deposit_refunded),
    0, count(*)
  from public.rental_bookings r
  where r.status <> 'cancelled'
  group by 1
) combined
group by month
order by month desc;

-- ---------------------------------------------------------------------------
-- 4. Verification
-- ---------------------------------------------------------------------------
select * from public.analytics_top_products limit 5;
select artist_id, display_name, tying_bookings, rental_bookings from public.analytics_top_artists limit 5;
select * from public.analytics_revenue_monthly limit 6;
