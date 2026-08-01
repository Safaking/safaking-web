-- ============================================================================
-- SafaKing — 003 Payments (Razorpay)
--
-- Run AFTER 002_production_hardening.sql, in the Supabase SQL Editor.
-- Idempotent.
--
-- Money rules enforced here rather than in the browser:
--   * orders.total_amount / advance_amount are written by the server only
--     (RLS below revokes client INSERT on orders entirely).
--   * stock is decremented atomically, and only once a payment is verified.
-- ============================================================================

do $$ begin
  create type payment_state as enum ('advance_pending','advance_paid','fully_paid','failed','refunded');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Razorpay handles on the order
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists razorpay_order_id   text;
alter table public.orders add column if not exists razorpay_payment_id text;
alter table public.orders add column if not exists stock_applied       boolean not null default false;
-- Used to flag an order for the admin (e.g. paid but short on stock).
alter table public.orders add column if not exists notes               text;

create index if not exists orders_razorpay_order_id_idx on public.orders (razorpay_order_id);

-- ---------------------------------------------------------------------------
-- 2. Payment ledger — one row per Razorpay attempt, kept for reconciliation
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid references public.orders(id) on delete set null,
  booking_id          uuid references public.artist_bookings(id) on delete set null,
  razorpay_order_id   text not null,
  razorpay_payment_id text,
  razorpay_signature  text,
  amount              integer not null,           -- paise, exactly as sent to Razorpay
  currency            text    not null default 'INR',
  status              text    not null default 'created', -- created | paid | failed
  method              text,
  notes               jsonb,
  created_at          timestamptz not null default now(),
  verified_at         timestamptz
);

create unique index if not exists payments_rzp_order_key on public.payments (razorpay_order_id);
create index if not exists payments_order_id_idx on public.payments (order_id);

-- ---------------------------------------------------------------------------
-- 3. Atomic stock application.
--    Runs once per order (guarded by orders.stock_applied) inside a single
--    statement, so two concurrent payments cannot oversell the same safa.
-- ---------------------------------------------------------------------------
create or replace function public.apply_order_stock(p_order_id uuid)
returns table (product_id uuid, product_name text, shortfall integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  already boolean;
begin
  select stock_applied into already from public.orders where id = p_order_id for update;
  if already is null then
    raise exception 'Order % not found', p_order_id;
  end if;
  if already then
    return; -- Already applied; replayed webhook or double verify call.
  end if;

  -- Report anything we cannot fully satisfy. The caller decides what to do;
  -- we never silently zero-out or go negative.
  return query
  select oi.product_id, oi.product_name, (oi.quantity - p.stock) as shortfall
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  where oi.order_id = p_order_id
    and oi.product_id is not null
    and p.stock < oi.quantity;

  if not found then
    update public.products p
    set stock = p.stock - oi.quantity
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.product_id = p.id;

    update public.orders set stock_applied = true where id = p_order_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.payments enable row level security;

-- Customers may read their own payments; admins read everything.
-- Nobody writes from the browser: only the service_role (which bypasses RLS)
-- inserts or updates payment rows.
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select using (public.is_admin() or public.owns_order(order_id));

-- ---------------------------------------------------------------------------
-- 5. Close the price hole.
--    Until now the browser inserted orders directly, so it chose total_amount.
--    Orders are now created exclusively by /api/checkout/create-order using the
--    service role, which recomputes every price from the products table.
-- ---------------------------------------------------------------------------
drop policy if exists orders_insert on public.orders;
-- (no INSERT policy => no client of any kind may insert an order)

drop policy if exists order_items_insert on public.order_items;
-- (same: order_items are written server-side alongside the order)

-- ---------------------------------------------------------------------------
-- 6. Verification
-- ---------------------------------------------------------------------------
select
  (select count(*) from pg_policies where tablename = 'orders'   and cmd = 'INSERT') as order_insert_policies,
  (select count(*) from pg_policies where tablename = 'payments')                    as payment_policies;
-- order_insert_policies MUST be 0 — that is what stops a ₹1 checkout.
