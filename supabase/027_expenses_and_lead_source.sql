-- 027_expenses_and_lead_source.sql
--
-- Two things the reports could not honestly show before:
--   1. Expenses — without them "Profit & Loss" was just revenue.
--   2. Where the customer came from — no booking recorded a source, so
--      marketing spend could not be tied to any booking.

-- ---------------------------------------------------------------------------
-- 1. Expenses
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  expense_date  date not null default current_date,
  category      text not null,
  description   text,
  amount        numeric not null check (amount >= 0),
  payment_mode  text not null default 'cash',
  paid_to       text,
  reference     text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.expenses
  drop constraint if exists expenses_category_check;
alter table public.expenses
  add constraint expenses_category_check check (category in (
    'salary', 'artist_payment', 'marketing', 'rent', 'electricity',
    'delivery', 'software', 'travel', 'materials', 'refund', 'other'
  ));

alter table public.expenses
  drop constraint if exists expenses_payment_mode_check;
alter table public.expenses
  add constraint expenses_payment_mode_check check (payment_mode in (
    'cash', 'upi', 'bank', 'card', 'other'
  ));

create index if not exists expenses_date_idx on public.expenses (expense_date desc);
create index if not exists expenses_category_idx on public.expenses (category);

alter table public.expenses enable row level security;

-- Money going out is owner-level data: admins only, read and write.
drop policy if exists expenses_admin_read on public.expenses;
create policy expenses_admin_read on public.expenses
  for select using (public.is_admin());

drop policy if exists expenses_admin_write on public.expenses;
create policy expenses_admin_write on public.expenses
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Lead source on every revenue record
-- ---------------------------------------------------------------------------
alter table public.artist_bookings add column if not exists lead_source text;
alter table public.rental_bookings add column if not exists lead_source text;
alter table public.orders          add column if not exists lead_source text;

-- Free text is deliberate: a constraint here would reject a booking outright
-- if the front-end ever offers a new source, and losing a booking to protect
-- a report is the wrong trade. The admin report groups whatever it finds.
create index if not exists artist_bookings_lead_source_idx on public.artist_bookings (lead_source);
create index if not exists rental_bookings_lead_source_idx on public.rental_bookings (lead_source);

select 'expenses table + lead_source columns ready' as status;
