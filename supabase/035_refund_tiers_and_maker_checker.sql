-- 035_refund_tiers_and_maker_checker.sql
--
-- Phase 1 of the owner's refund rules.
--
--   1. Tiers in HOURS, not days — the policy has a 48-hour step, and a
--      days-only ladder cannot express it.
--        15 days or more  -> 100% of the eligible amount
--        7 to 14 days     ->  75%
--        48 hours-6 days  ->  50%
--        under 48 hours   ->   0 (no cash refund)
--   2. One function computes every quote, from the event's actual start time.
--      The customer's preview and the server's figure are the same call, so
--      nobody — customer or employee — can put their own number in.
--   3. "Eligible amount" = what was paid, less GST/taxes and genuinely
--      non-refundable charges. Those are never refunded.
--   4. Maker–checker: request -> verify -> approve -> send -> reconcile, with
--      the database refusing the same person at the steps that matter. A
--      different percentage exists only as an exception a second manager or
--      the owner approves.

-- ---------------------------------------------------------------------------
-- 1. Hour-based ladder
-- ---------------------------------------------------------------------------
alter table public.refund_rules add column if not exists min_hours_before integer;
alter table public.refund_rules drop constraint if exists refund_rules_min_days_before_key;
alter table public.refund_rules alter column min_days_before drop not null;

-- Old rules are switched off, not deleted: a cancellation already raised froze
-- its percentage, and the history of what the policy used to say stays readable.
do $$
begin
  if not exists (select 1 from public.refund_rules where active and min_hours_before is not null) then
    update public.refund_rules set active = false where active;

    insert into public.refund_rules (min_days_before, min_hours_before, refund_percent, label, active) values
      (15, 360, 100, 'Cancelled 15 days or more before the event — full eligible amount refunded', true),
      (7,  168, 75,  'Cancelled 7–14 days before the event — 75% of the eligible amount refunded', true),
      (2,  48,  50,  'Cancelled between 48 hours and 6 days before the event — 50% of the eligible amount refunded', true),
      (0,  0,   0,   'Cancelled less than 48 hours before the event — no cash refund', true);
  end if;
end;
$$;

create unique index if not exists refund_rules_one_active_hours
  on public.refund_rules (min_hours_before) where active;

create or replace function public.refund_percent_for_hours(p_hours numeric)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select refund_percent from public.refund_rules
      where active and min_hours_before is not null and min_hours_before <= greatest(p_hours, 0)
      order by min_hours_before desc
      limit 1),
    0
  );
$$;

grant execute on function public.refund_percent_for_hours(numeric) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. When an event actually starts, in India
-- ---------------------------------------------------------------------------
-- Artist bookings store the time as the text an <input type="time"> gives
-- ("17:30"); rentals store only a date. Without a time, the admin's default
-- event start hour is used rather than midnight, which would shave most of a
-- day off every customer's notice period.
create or replace function public.event_starts_at(p_date date, p_time text)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hour integer;
begin
  if p_date is null then
    return null;
  end if;

  if p_time ~ '^\s*\d{1,2}:\d{2}' then
    begin
      return (p_date + (substring(p_time from '\d{1,2}:\d{2}'))::time) at time zone 'Asia/Kolkata';
    exception when others then
      null;  -- fall through to the default hour
    end;
  end if;

  select coalesce((select value::integer from public.app_settings where key = 'event_start_hour'), 17)
    into v_hour;
  return (p_date + make_time(least(greatest(v_hour, 0), 23), 0, 0)) at time zone 'Asia/Kolkata';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. What is never refundable
-- ---------------------------------------------------------------------------
alter table public.artist_bookings
  add column if not exists tax_amount         numeric not null default 0,
  add column if not exists non_refundable_fee numeric not null default 0;
alter table public.rental_bookings
  add column if not exists tax_amount         numeric not null default 0,
  add column if not exists non_refundable_fee numeric not null default 0;
alter table public.orders
  add column if not exists tax_amount         numeric not null default 0,
  add column if not exists non_refundable_fee numeric not null default 0;

-- ---------------------------------------------------------------------------
-- 4. The one quote
-- ---------------------------------------------------------------------------
create or replace function public.quote_cancellation(p_kind text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_artist   uuid;
  v_status   text;
  v_pay      text;
  v_total    numeric;
  v_advance  numeric;
  v_tax      numeric;
  v_fee      numeric;
  v_date     date;
  v_time     text;
  v_event    timestamptz;
  v_hours    numeric;
  v_paid     numeric;
  v_eligible numeric;
  v_pct      integer;
  v_label    text;
begin
  if p_kind = 'booking' then
    select customer_id, artist_id, status::text, payment_status::text, amount, advance_amount,
           tax_amount, non_refundable_fee, event_date,
           coalesce(nullif(booking_start_time, ''), nullif(event_time, ''))
      into v_customer, v_artist, v_status, v_pay, v_total, v_advance, v_tax, v_fee, v_date, v_time
      from public.artist_bookings where id = p_id;
  elsif p_kind = 'rental' then
    select customer_id, artist_id, status::text, payment_status::text, total_amount, advance_amount,
           tax_amount, non_refundable_fee, start_date, null
      into v_customer, v_artist, v_status, v_pay, v_total, v_advance, v_tax, v_fee, v_date, v_time
      from public.rental_bookings where id = p_id;
  else
    raise exception 'Unknown booking kind.' using errcode = 'P0001';
  end if;

  if not found then
    raise exception 'That booking could not be found.' using errcode = 'P0001';
  end if;

  -- The server calls this with the service role; everyone else must be a
  -- party to the booking or SafaKing staff.
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_staff() then
    if auth.uid() is null
       or (auth.uid() is distinct from v_customer and auth.uid() is distinct from v_artist) then
      raise exception 'You are not a party to this booking.' using errcode = 'P0001';
    end if;
  end if;

  v_event    := public.event_starts_at(v_date, v_time);
  v_hours    := round(extract(epoch from (v_event - now())) / 3600.0, 1);
  v_paid     := case v_pay
                  when 'fully_paid'   then coalesce(v_total, 0)
                  when 'advance_paid' then coalesce(v_advance, 0)
                  else 0
                end;
  v_eligible := greatest(v_paid - coalesce(v_tax, 0) - coalesce(v_fee, 0), 0);

  select refund_percent, label into v_pct, v_label
    from public.refund_rules
   where active and min_hours_before is not null and min_hours_before <= greatest(v_hours, 0)
   order by min_hours_before desc
   limit 1;

  v_pct := coalesce(v_pct, 0);

  return jsonb_build_object(
    'kind', p_kind,
    'id', p_id,
    'status', v_status,
    'payment_status', v_pay,
    'event_at', v_event,
    'hours_before', v_hours,
    'days_before', floor(greatest(v_hours, 0) / 24),
    'refund_percent', v_pct,
    'rule_label', coalesce(v_label, 'No refund applies at this point.'),
    'paid_amount', round(v_paid),
    'tax_amount', round(coalesce(v_tax, 0)),
    'non_refundable_fee', round(coalesce(v_fee, 0)),
    'eligible_amount', round(v_eligible),
    'refund_amount', round(v_eligible * v_pct / 100.0),
    'paid', v_paid > 0
  );
end;
$$;

grant execute on function public.quote_cancellation(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The workflow, recorded
-- ---------------------------------------------------------------------------
alter table public.cancellations
  add column if not exists reason_code            text,
  add column if not exists hours_before           numeric,
  add column if not exists rule_label             text,
  add column if not exists paid_amount            integer not null default 0,
  add column if not exists tax_amount             integer not null default 0,
  add column if not exists non_refundable_fee     integer not null default 0,
  add column if not exists eligible_amount        integer not null default 0,
  add column if not exists verified_by            uuid references public.profiles (id) on delete set null,
  add column if not exists verified_at            timestamptz,
  add column if not exists verification_note      text,
  add column if not exists processed_by           uuid references public.profiles (id) on delete set null,
  add column if not exists processed_at           timestamptz,
  add column if not exists refund_method          text,
  add column if not exists refund_reference       text,
  add column if not exists reconciled_by          uuid references public.profiles (id) on delete set null,
  add column if not exists reconciled_at          timestamptz,
  add column if not exists reconciliation_note    text,
  add column if not exists exception_percent      integer,
  add column if not exists exception_reason       text,
  add column if not exists exception_requested_by uuid references public.profiles (id) on delete set null,
  add column if not exists exception_requested_at timestamptz,
  add column if not exists exception_approved_by  uuid references public.profiles (id) on delete set null,
  add column if not exists exception_approved_at  timestamptz;

alter table public.cancellations drop constraint if exists cancellations_requested_role_check;
alter table public.cancellations add constraint cancellations_requested_role_check
  check (requested_role in ('customer', 'artist', 'admin', 'manager'));

alter table public.cancellations drop constraint if exists cancellations_exception_percent_check;
alter table public.cancellations add constraint cancellations_exception_percent_check
  check (exception_percent is null or exception_percent between 0 and 100);

alter table public.cancellations drop constraint if exists cancellations_refund_method_check;
alter table public.cancellations add constraint cancellations_refund_method_check
  check (refund_method is null or refund_method in ('gateway', 'upi', 'bank', 'cash'));

create or replace function public.is_staff_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_user and role::text in ('admin', 'manager'));
$$;

create or replace function public.guard_cancellation_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- The refund route writes with the service role and records the real actor
  -- in the columns itself; a staff member writing directly can only ever put
  -- their own name on a step.
  v_client      boolean := coalesce(auth.role(), '') <> 'service_role';
  v_exc_approve boolean := old.exception_approved_by is null and new.exception_approved_by is not null;
begin
  -- The figures a cancellation was raised with are fixed.
  if (new.requested_by, new.requested_role, new.rental_id, new.booking_id, new.order_id,
      new.paid_amount, new.tax_amount, new.non_refundable_fee, new.eligible_amount,
      new.advance_amount, new.hours_before, new.days_before, new.event_date)
     is distinct from
     (old.requested_by, old.requested_role, old.rental_id, old.booking_id, old.order_id,
      old.paid_amount, old.tax_amount, old.non_refundable_fee, old.eligible_amount,
      old.advance_amount, old.hours_before, old.days_before, old.event_date) then
    raise exception 'The cancellation figures are fixed when it is requested and cannot be edited.'
      using errcode = 'P0001';
  end if;

  -- Nobody changes the percentage on their own say-so.
  if (new.refund_percent, new.refund_amount) is distinct from (old.refund_percent, old.refund_amount) then
    if not v_exc_approve then
      raise exception 'The refund percentage is set by the policy. A different amount needs an exception approved by a manager or the owner.'
        using errcode = 'P0001';
    end if;
    if new.refund_percent is distinct from new.exception_percent
       or new.refund_amount <> round(new.eligible_amount * new.exception_percent / 100.0) then
      raise exception 'An approved exception must apply exactly the approved percentage.' using errcode = 'P0001';
    end if;
  end if;

  if v_client then
    if (new.verified_by is distinct from old.verified_by and new.verified_by is not null and new.verified_by <> auth.uid())
       or (new.reviewed_by is distinct from old.reviewed_by and new.reviewed_by is not null and new.reviewed_by <> auth.uid())
       or (new.processed_by is distinct from old.processed_by and new.processed_by is not null and new.processed_by <> auth.uid())
       or (new.reconciled_by is distinct from old.reconciled_by and new.reconciled_by is not null and new.reconciled_by <> auth.uid())
       or (new.exception_requested_by is distinct from old.exception_requested_by
           and new.exception_requested_by is not null and new.exception_requested_by <> auth.uid())
       or (new.exception_approved_by is distinct from old.exception_approved_by
           and new.exception_approved_by is not null and new.exception_approved_by <> auth.uid()) then
      raise exception 'A step can only be recorded in your own name.' using errcode = 'P0001';
    end if;
  end if;

  -- Closed rows stay closed.
  if old.status = 'refunded' and new.status is distinct from old.status then
    raise exception 'A refund that has been sent cannot be reopened.' using errcode = 'P0001';
  end if;
  if old.status = 'rejected' and new.status is distinct from old.status then
    raise exception 'A refused refund is closed.' using errcode = 'P0001';
  end if;
  if old.status = 'no_refund' and new.status is distinct from old.status
     and not (v_exc_approve and new.status = 'requested') then
    raise exception 'This cancellation is closed.' using errcode = 'P0001';
  end if;

  -- Verify (the maker).
  if old.verified_by is not null and new.verified_by is null and not v_exc_approve then
    raise exception 'A verification cannot be undone.' using errcode = 'P0001';
  end if;
  if new.verified_by is not null and new.verified_by is distinct from old.verified_by then
    if not public.is_staff_user(new.verified_by) then
      raise exception 'Only SafaKing staff can verify a refund.' using errcode = 'P0001';
    end if;
    if new.verified_by = new.requested_by then
      raise exception 'Whoever raised a cancellation cannot also verify it.' using errcode = 'P0001';
    end if;
    if new.status <> 'requested' then
      raise exception 'Only a refund still awaiting review can be verified.' using errcode = 'P0001';
    end if;
  end if;

  -- Approve (the checker).
  if new.status = 'approved' and old.status is distinct from new.status then
    if old.status <> 'requested' then
      raise exception 'Only a refund awaiting review can be approved.' using errcode = 'P0001';
    end if;
    if new.verified_by is null then
      raise exception 'Verify the refund before it can be approved — two people sign every refund off.'
        using errcode = 'P0001';
    end if;
    if new.reviewed_by is null or not public.is_staff_user(new.reviewed_by) then
      raise exception 'Only SafaKing staff can approve a refund.' using errcode = 'P0001';
    end if;
    if new.reviewed_by = new.verified_by then
      raise exception 'The person who verified this refund cannot also approve it.' using errcode = 'P0001';
    end if;
    if new.reviewed_by = new.requested_by then
      raise exception 'Whoever raised a cancellation cannot approve its refund.' using errcode = 'P0001';
    end if;
    if new.exception_requested_by is not null and new.exception_approved_by is null then
      raise exception 'An exception is waiting on this refund — decide it before approving.' using errcode = 'P0001';
    end if;
  end if;

  -- Refuse.
  if new.status = 'rejected' and old.status is distinct from new.status then
    if old.status <> 'requested' then
      raise exception 'Only a refund awaiting review can be refused.' using errcode = 'P0001';
    end if;
    if new.reviewed_by is null or not public.is_staff_user(new.reviewed_by) then
      raise exception 'Only SafaKing staff can refuse a refund.' using errcode = 'P0001';
    end if;
    if new.reviewed_by = new.requested_by then
      raise exception 'Whoever raised a cancellation cannot refuse its refund.' using errcode = 'P0001';
    end if;
  end if;

  -- Send the money.
  if new.status = 'refunded' and old.status is distinct from new.status then
    if old.status <> 'approved' then
      raise exception 'A refund must be approved before money is sent.' using errcode = 'P0001';
    end if;
    if new.processed_by is null or not public.is_staff_user(new.processed_by) then
      raise exception 'Only SafaKing staff can record a refund being sent.' using errcode = 'P0001';
    end if;
    if new.processed_by = new.reviewed_by then
      raise exception 'The person who approved this refund cannot also send it.' using errcode = 'P0001';
    end if;
    if new.razorpay_refund_id is null and coalesce(btrim(new.refund_reference), '') = '' then
      raise exception 'Record the gateway refund id or the UPI / bank / cash reference.' using errcode = 'P0001';
    end if;
  end if;

  -- Reconcile, and with it close.
  if new.reconciled_at is not null and old.reconciled_at is null then
    if new.status <> 'refunded' then
      raise exception 'Only a refund that has been sent can be reconciled.' using errcode = 'P0001';
    end if;
    if new.reconciled_by is null or not public.is_staff_user(new.reconciled_by) then
      raise exception 'Only SafaKing staff can reconcile a refund.' using errcode = 'P0001';
    end if;
    if new.reconciled_by = new.processed_by then
      raise exception 'The person who sent this refund cannot also reconcile it.' using errcode = 'P0001';
    end if;
  end if;

  -- Propose an exception.
  if new.exception_requested_by is not null and new.exception_requested_by is distinct from old.exception_requested_by then
    if not public.is_staff_user(new.exception_requested_by) then
      raise exception 'Only SafaKing staff can propose an exception.' using errcode = 'P0001';
    end if;
    if old.status not in ('requested', 'no_refund') then
      raise exception 'An exception can only be proposed before the refund is approved.' using errcode = 'P0001';
    end if;
    if new.exception_percent is null or coalesce(btrim(new.exception_reason), '') = '' then
      raise exception 'An exception needs a percentage and a written reason.' using errcode = 'P0001';
    end if;
    if old.exception_approved_by is not null then
      raise exception 'This refund already had an exception decided.' using errcode = 'P0001';
    end if;
  end if;

  -- Approve an exception.
  if v_exc_approve then
    if new.exception_requested_by is null then
      raise exception 'There is no exception to approve.' using errcode = 'P0001';
    end if;
    if not public.is_staff_user(new.exception_approved_by) then
      raise exception 'Only a manager or the owner can approve an exception.' using errcode = 'P0001';
    end if;
    if new.exception_approved_by = new.exception_requested_by then
      raise exception 'Whoever proposed the exception cannot approve it.' using errcode = 'P0001';
    end if;
    if new.exception_approved_by = new.requested_by then
      raise exception 'Whoever raised the cancellation cannot approve an exception to it.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists cancellations_workflow_guard on public.cancellations;
create trigger cancellations_workflow_guard
  before update on public.cancellations
  for each row execute function public.guard_cancellation_workflow();

-- Managers work the desk too; the trigger decides what each of them may do.
drop policy if exists cancellations_select on public.cancellations;
create policy cancellations_select on public.cancellations
  for select using (
    public.is_staff()
    or requested_by = auth.uid()
    or exists (select 1 from public.rental_bookings r
               where r.id = rental_id and (r.customer_id = auth.uid() or r.artist_id = auth.uid()))
    or exists (select 1 from public.artist_bookings b
               where b.id = booking_id and (b.customer_id = auth.uid() or b.artist_id = auth.uid()))
  );

drop policy if exists cancellations_update on public.cancellations;
create policy cancellations_update on public.cancellations
  for update using (public.is_staff()) with check (public.is_staff());

-- Refunds and the policy itself belong in the audit trail.
drop trigger if exists cancellations_audit on public.cancellations;
create trigger cancellations_audit
  after insert or update or delete on public.cancellations
  for each row execute function public.record_audit();

drop trigger if exists refund_rules_audit on public.refund_rules;
create trigger refund_rules_audit
  after insert or update or delete on public.refund_rules
  for each row execute function public.record_audit();

select min_hours_before, refund_percent, label
  from public.refund_rules
 where active
 order by min_hours_before desc;
