-- 032_payment_mode_and_cancel_reason.sql
--
-- Two fields the reports asked for and could not have.
--
-- 1. payment_mode — the Collection Report (R-29) is meant to split cash, UPI,
--    card and gateway. Nothing recorded how money arrived, so it could only
--    ever show one undifferentiated total.
-- 2. cancellation_reason — the Cancellation Report (R-06) could show what was
--    lost but never why, which is the only half that changes a decision.

alter table public.artist_bookings
  add column if not exists payment_mode        text,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by        uuid references auth.users (id) on delete set null,
  add column if not exists cancelled_at        timestamptz;

alter table public.rental_bookings
  add column if not exists payment_mode        text,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by        uuid references auth.users (id) on delete set null,
  add column if not exists cancelled_at        timestamptz;

alter table public.orders
  add column if not exists payment_mode        text,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by        uuid references auth.users (id) on delete set null,
  add column if not exists cancelled_at        timestamptz;

-- Fixed master values, per spec §16: free text here would give a collection
-- report where "UPI", "upi" and "Gpay" are three different payment modes.
do $$
declare
  t text;
begin
  foreach t in array array['artist_bookings', 'rental_bookings', 'orders'] loop
    execute format('alter table public.%I drop constraint if exists %I_payment_mode_check', t, t);
    execute format(
      'alter table public.%I add constraint %I_payment_mode_check
         check (payment_mode is null or payment_mode in
           (''cash'', ''upi'', ''card'', ''bank'', ''gateway'', ''other''))', t, t
    );
  end loop;
end;
$$;

create index if not exists artist_bookings_payment_mode_idx on public.artist_bookings (payment_mode);
create index if not exists rental_bookings_payment_mode_idx on public.rental_bookings (payment_mode);

-- Stamp the cancellation automatically, so the report never depends on
-- somebody remembering to fill in who and when.
create or replace function public.stamp_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('cancelled', 'declined') and old.status is distinct from new.status then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['artist_bookings', 'rental_bookings', 'orders'] loop
    execute format('drop trigger if exists %I_cancel_stamp on public.%I', t, t);
    execute format(
      'create trigger %I_cancel_stamp before update on public.%I
         for each row execute function public.stamp_cancellation()', t, t
    );
  end loop;
end;
$$;

select 'payment mode and cancellation reason ready' as status;
