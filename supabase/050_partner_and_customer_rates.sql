-- 050 — two rates, and the rate kept off the page.
--
-- One rate for everybody was wrong in both directions. A shop that sends
-- customers as part of its own trade is worth paying properly; a customer
-- telling a cousin is not worth ten percent of everything that cousin ever
-- buys, for ever.
--
-- So: the partner rate for a registered business, the customer rate for
-- everybody else. Both are settings, because the customer rate in particular
-- is still being decided and must not need a deploy to change.
--
-- The rate itself no longer appears on the refer page. Printing a number the
-- shop may well revise is a promise the shop has to keep; what the page says
-- now is that credit comes, not how much.

insert into public.app_settings (key, value, label, description) values
  ('referral_partner_percent', 10, 'Referral: business partner''s share (%)',
   'What a registered business partner earns on every order their joiner pays for.'),
  ('referral_customer_percent', 2, 'Referral: ordinary customer''s share (%)',
   'What an ordinary customer earns on every order the person they referred pays for.')
on conflict (key) do nothing;

-- The old single rate stays in the table but is no longer read. Left rather
-- than deleted so nothing that still mentions it breaks, and so the figure
-- the shop ran on is not simply erased from the record.

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
  v_partner  boolean;
begin
  select customer_id, total_amount into v_buyer, v_total
    from public.orders where id = p_order_id;
  if v_buyer is null then
    return jsonb_build_object('ok', false, 'error', 'No such order.');
  end if;

  select * into v_referral from public.referrals
   where joiner_id = v_buyer and status <> 'void';
  if not found then
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'no referral');
  end if;

  select owner_id into v_owner from public.referral_codes
   where code = v_referral.code and active;
  if v_owner is null then
    update public.referrals set status = 'earned', earned_at = coalesce(earned_at, now())
     where id = v_referral.id;
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'shop or inactive code');
  end if;

  if v_owner = v_buyer then
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'own code');
  end if;

  v_min := coalesce((select value from public.app_settings where key = 'referral_min_order'), 1000)::integer;
  if v_total < v_min then
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'order below the earning threshold');
  end if;

  -- A business the shop has actually approved, not merely one that filled the
  -- form in: the higher rate is a commercial arrangement, and anybody could
  -- type a shop name into a box.
  select exists (
    select 1 from public.referral_partners
     where user_id = v_owner and status = 'approved'
  ) into v_partner;

  v_percent := coalesce((
    select value from public.app_settings
     where key = case when v_partner then 'referral_partner_percent'
                      else 'referral_customer_percent' end
  ), case when v_partner then 10 else 2 end)::integer;

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

  return jsonb_build_object(
    'ok', true, 'settled', true, 'credit', v_credit,
    'percent', v_percent, 'partner', v_partner
  );
end;
$$;

select 'partner and customer rates ready' as status;
