-- 048 — a share of every order, and the detail behind it.
--
-- Until now the sharer earned a flat ₹200, once, on the referred customer's
-- first order. The shop wants a percentage instead, and on everything that
-- customer ever buys — a referral is worth what it keeps being worth, not
-- what it was worth the first week.
--
-- Two things follow from "every order":
--
--   * The referral can no longer be closed after the first one. status still
--     moves to 'earned' the first time, because the refer page shows it, but
--     it is no longer what decides whether anybody is paid.
--
--   * Paying twice for one order becomes possible for the first time, so the
--     ledger now refuses it outright rather than trusting the caller. The
--     settle function is called from the payment webhook, and webhooks are
--     retried.

-- ---------------------------------------------------------------------------
-- The rate, as a setting rather than a number in a function
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, label, help) values
  ('referral_sharer_percent', 10, 'Referral: sharer''s share of each order (%)',
   'What the person who shared the code earns on every order their joiner pays for. 0 turns it off.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- One earning per order, enforced by the database
-- ---------------------------------------------------------------------------
-- A spend already had this guard. An earning did not need one while it could
-- only happen once per referral; now that it repeats, a retried webhook would
-- otherwise pay twice for the same order.
create unique index if not exists credit_ledger_one_earn_per_order
  on public.credit_ledger (order_id)
  where order_id is not null and amount > 0;

-- ---------------------------------------------------------------------------
-- Settle: a share of this order, every time
-- ---------------------------------------------------------------------------
create or replace function public.settle_referral_for_order(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_buyer    uuid;
  v_total    numeric;
  v_referral record;
  v_owner    uuid;
  v_min      integer;
  v_percent  integer;
  v_credit   integer;
  v_first    boolean;
begin
  select customer_id, total_amount into v_buyer, v_total
    from public.orders where id = p_order_id;
  if v_buyer is null then
    return jsonb_build_object('ok', false, 'error', 'No such order.');
  end if;

  -- Any live referral, not only an unsettled one: the second order earns as
  -- much as the first.
  select * into v_referral from public.referrals
   where joiner_id = v_buyer and status <> 'void';
  if not found then
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'no referral');
  end if;

  select owner_id into v_owner from public.referral_codes
   where code = v_referral.code and active;
  if v_owner is null then
    -- A shop code earns nobody, and a code since switched off earns nobody
    -- more. The joiner already had their own credit on joining.
    update public.referrals set status = 'earned', earned_at = coalesce(earned_at, now())
     where id = v_referral.id;
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'shop or inactive code');
  end if;

  -- Somebody buying through their own code would otherwise pay themselves
  -- 10% of everything they spend.
  if v_owner = v_buyer then
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'own code');
  end if;

  v_min := coalesce((select value from public.app_settings where key = 'referral_min_order'), 1000)::integer;
  if v_total < v_min then
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'order below the earning threshold');
  end if;

  v_percent := coalesce((select value from public.app_settings where key = 'referral_sharer_percent'), 10)::integer;
  v_credit := floor(v_total * v_percent / 100.0)::integer;
  if v_credit <= 0 then
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'nothing to pay at this rate');
  end if;

  v_first := v_referral.status = 'joined';

  update public.referrals
     set status = 'earned',
         earned_at = coalesce(earned_at, now()),
         earning_order_id = coalesce(earning_order_id, p_order_id)
   where id = v_referral.id;

  -- The unique index is the real guard. Catching it here keeps a retried
  -- webhook from failing the order it is retrying.
  begin
    insert into public.credit_ledger (user_id, amount, reason, referral_id, order_id)
    values (
      v_owner,
      v_credit,
      case when v_first
        then 'Somebody you referred placed their first order'
        else 'Somebody you referred bought again' end,
      v_referral.id,
      p_order_id
    );
  exception when unique_violation then
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'already settled');
  end;

  return jsonb_build_object('ok', true, 'settled', true, 'credit', v_credit, 'percent', v_percent);
end;
$$;

-- ---------------------------------------------------------------------------
-- What the sharer can see
-- ---------------------------------------------------------------------------
-- Somebody earning a share of other people's orders has to be able to check
-- it, so this returns the orders behind the number. It is deliberately narrow:
-- the joiner's display name and what they bought, never their phone, email or
-- address, and only for referrals belonging to the caller.
create or replace function public.my_referral_report()
returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select r.id, r.joiner_id, r.joined_at, r.status
      from public.referrals r
      join public.referral_codes c on c.code = r.code
     where c.owner_id = auth.uid()
       and r.status <> 'void'
  ),
  earned as (
    select l.referral_id, l.order_id, l.amount, l.created_at
      from public.credit_ledger l
     where l.user_id = auth.uid()
       and l.amount > 0
       and l.referral_id is not null
  )
  select coalesce(jsonb_agg(row order by row->>'joined_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'joined_at', m.joined_at,
      'status', m.status,
      -- First name only. The sharer knows who they invited; the rest of a
      -- person's details are not theirs to collect.
      'name', coalesce(split_part(nullif(trim(p.full_name), ''), ' ', 1), 'A customer'),
      'orders', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'placed_at', o.created_at,
          'total', o.total_amount,
          'earned', (select e.amount from earned e where e.order_id = o.id),
          'items', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'name', oi.product_name, 'quantity', oi.quantity
            )), '[]'::jsonb)
            from public.order_items oi where oi.order_id = o.id
          )
        ) order by o.created_at desc), '[]'::jsonb)
        from public.orders o
        where o.customer_id = m.joiner_id
          and o.id in (select e.order_id from earned e where e.referral_id = m.id)
      ),
      'earned_total', coalesce((
        select sum(e.amount) from earned e where e.referral_id = m.id
      ), 0)
    ) as row
    from mine m
    left join public.profiles p on p.id = m.joiner_id
  ) rows;
$$;

grant execute on function public.my_referral_report() to authenticated;

select 'referral share and report ready' as status;
