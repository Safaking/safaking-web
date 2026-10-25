-- 053 — who has not packed, and how to ring them.
--
-- An order sits with a supplier until they pack and send it. Nothing told the
-- shop that one was sitting, and nothing gave them the supplier's number when
-- it was — so the way you found out was a customer ringing to ask where their
-- safa had got to, which is the worst possible way to find out.
--
-- A wedding has a date. Late is not a smaller version of on time: a safa that
-- arrives the day after the baraat is worth nothing, and the customer is
-- entitled to refuse it. So "how late" is measured here rather than left for
-- somebody to work out from two timestamps on a screen.
--
-- Overdue is counted against the supplier's own promised dispatch_days, not a
-- number we picked: they said two days, so two days is what they are held to.

create or replace function public.admin_pending_shipments()
returns jsonb
language sql stable security definer set search_path = public as $$
  -- Whoever already looks after suppliers: operations staff hold this, and
  -- the owner holds everything. Chasing a late parcel is their job, not a
  -- new one needing a new permission.
  select case when public.is_admin() or public.staff_can('suppliers') then coalesce(
    (select jsonb_agg(row_to_json(s) order by s.overdue_days desc nulls last, s.ordered_at)
       from (
         select sh.id,
                sh.status,
                sh.created_at                        as ordered_at,
                sh.ready_at,
                sh.courier,
                sh.tracking_number,
                sh.items_amount,
                o.id                                 as order_id,
                sp.business_name,
                -- The number somebody actually rings. The supplier profile's
                -- own phone first, falling back to the account's.
                coalesce(sp.phone, pr.phone)         as supplier_phone,
                sp.city                              as supplier_city,
                sp.dispatch_days                     as promised_days,
                -- Whole days late against what this supplier promised. Null
                -- while still within the promise, so "not late yet" and "one
                -- day late" never look the same on screen.
                greatest(
                  0,
                  floor(extract(epoch from (now() - sh.created_at)) / 86400)::int
                    - sp.dispatch_days
                ) as overdue_days,
                (select count(*) from public.order_supplier_lines l
                  where l.shipment_id = sh.id)       as line_count
           from public.order_shipments sh
           join public.supplier_profiles sp on sp.id = sh.supplier_id
           left join public.profiles pr on pr.id = sp.user_id
           left join public.orders o on o.id = sh.order_id
          -- Only what is actually waiting on the supplier. Awaiting payment is
          -- waiting on the customer and is not theirs to answer for.
          where sh.status in ('new', 'ready')
       ) s),
    '[]'::jsonb)
  else '[]'::jsonb end;
$$;

grant execute on function public.admin_pending_shipments() to authenticated;

-- ---------------------------------------------------------------------------
-- The same question, asked by the supplier about themselves
-- ---------------------------------------------------------------------------
-- Their dashboard needs to say "you have three orders waiting and one is two
-- days late" without being handed every other supplier's business.
create or replace function public.my_dispatch_pressure()
returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select sh.id, sh.status, sh.created_at, sp.dispatch_days,
           greatest(
             0,
             floor(extract(epoch from (now() - sh.created_at)) / 86400)::int - sp.dispatch_days
           ) as overdue_days
      from public.order_shipments sh
      join public.supplier_profiles sp on sp.id = sh.supplier_id
     where sp.user_id = auth.uid()
       and sh.status in ('new', 'ready')
  )
  select jsonb_build_object(
    'waiting',  (select count(*) from mine),
    'to_pack',  (select count(*) from mine where status = 'new'),
    'to_send',  (select count(*) from mine where status = 'ready'),
    'overdue',  (select count(*) from mine where overdue_days > 0),
    'worst',    coalesce((select max(overdue_days) from mine), 0)
  );
$$;

grant execute on function public.my_dispatch_pressure() to authenticated;

select 'dispatch watch ready' as status;
