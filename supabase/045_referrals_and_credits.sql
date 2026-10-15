-- ============================================================================
-- 045 — Referral codes and store credit
--
-- Run in the Supabase SQL Editor. Safe to run again.
--
-- A customer shares their code; somebody new joins with it and gets credit to
-- spend; the sharer is paid once that person actually buys something. The
-- shop can also hand out codes of its own — printed on a card at the counter,
-- or given to an artist — which belong to no customer.
--
-- Two rules shape everything below:
--
--   Credit is a ledger, never a number that gets edited. Every rupee in or
--   out is a row saying where it came from, so a balance can always be
--   explained and never silently drifts.
--
--   The sharer is paid when the person they brought in pays for an order,
--   not when they sign up. Paying on signup is paying for fake accounts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- What the shop can tune without a deploy
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, label, description) values
  ('referral_joiner_credit', 200, 'Referral: credit for the new customer (₹)',
   'Given the moment somebody joins with a referral code.'),
  ('referral_sharer_credit', 200, 'Referral: credit for the sharer (₹)',
   'Given when the person they referred pays for their first order.'),
  ('referral_min_order', 1000, 'Referral: order value that earns the sharer (₹)',
   'The referred customer''s first order must be at least this much before the sharer is credited.'),
  ('credit_max_share', 50, 'Credit: most of an order it may pay (%)',
   'Stops a basket being paid for entirely in credit. 100 to allow the whole order.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- The codes
-- ---------------------------------------------------------------------------
create table if not exists public.referral_codes (
  code        text primary key,
  -- Null for a code the shop hands out rather than one belonging to a customer.
  owner_id    uuid references public.profiles(id) on delete set null,
  label       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One code per customer; shop codes are not restricted.
create unique index if not exists referral_codes_one_per_owner
  on public.referral_codes (owner_id) where owner_id is not null;

-- ---------------------------------------------------------------------------
-- Who came in on whose code
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id             uuid primary key default gen_random_uuid(),
  code           text not null references public.referral_codes(code) on delete cascade,
  -- A person can be referred once, ever.
  joiner_id      uuid not null unique references public.profiles(id) on delete cascade,
  status         text not null default 'joined' check (status in ('joined', 'earned', 'void')),
  joined_at      timestamptz not null default now(),
  earned_at      timestamptz,
  earning_order_id uuid references public.orders(id) on delete set null
);

create index if not exists referrals_code_idx on public.referrals (code);

-- ---------------------------------------------------------------------------
-- The ledger. A balance is the sum of these rows and nothing else.
-- ---------------------------------------------------------------------------
create table if not exists public.credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  -- Positive is credit given, negative is credit spent. Whole rupees.
  amount      integer not null check (amount <> 0),
  reason      text not null,
  referral_id uuid references public.referrals(id) on delete set null,
  order_id    uuid references public.orders(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

-- Spending the same credit twice on one order is the obvious way to lose
-- money here; one spend row per order makes it impossible.
create unique index if not exists credit_ledger_one_spend_per_order
  on public.credit_ledger (order_id) where order_id is not null and amount < 0;

-- ---------------------------------------------------------------------------
-- Reading a balance
-- ---------------------------------------------------------------------------
create or replace function public.credit_balance(p_user uuid default auth.uid())
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::integer
    from public.credit_ledger
   where user_id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- A customer's own code, made the first time they ask for it
-- ---------------------------------------------------------------------------
create or replace function public.my_referral_code()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_try  text;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;

  select code into v_code from public.referral_codes where owner_id = v_user;
  if v_code is not null then
    return v_code;
  end if;

  -- Short, unambiguous, and read out loud over a counter without confusion:
  -- no O/0, no I/1.
  for _ in 1..12 loop
    v_try := 'SK' || upper(
      substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=OoIl01', 'ABCDEFGHJ'), 1, 5)
    );
    begin
      insert into public.referral_codes (code, owner_id, label)
      values (v_try, v_user, 'Customer code');
      return v_try;
    exception when unique_violation then
      -- Taken; try another.
    end;
  end loop;

  raise exception 'Could not make a referral code. Please try again.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Joining with somebody's code
-- ---------------------------------------------------------------------------
create or replace function public.claim_referral_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_code     text := upper(trim(p_code));
  v_owner    uuid;
  v_credit   integer;
  v_referral uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in first.');
  end if;

  select owner_id into v_owner from public.referral_codes
   where code = v_code and active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That code is not valid.');
  end if;

  if v_owner = v_user then
    return jsonb_build_object('ok', false, 'error', 'That is your own code.');
  end if;

  if exists (select 1 from public.referrals where joiner_id = v_user) then
    return jsonb_build_object('ok', false, 'error', 'A referral code has already been used on this account.');
  end if;

  -- Only somebody genuinely new: a code cannot be applied after shopping.
  if exists (select 1 from public.orders where customer_id = v_user) then
    return jsonb_build_object('ok', false, 'error', 'A referral code can only be used before your first order.');
  end if;

  insert into public.referrals (code, joiner_id)
  values (v_code, v_user)
  returning id into v_referral;

  v_credit := coalesce((select value from public.app_settings where key = 'referral_joiner_credit'), 200)::integer;
  if v_credit > 0 then
    insert into public.credit_ledger (user_id, amount, reason, referral_id)
    values (v_user, v_credit, 'Joined with a referral code', v_referral);
  end if;

  return jsonb_build_object('ok', true, 'credit', v_credit, 'balance', public.credit_balance(v_user));
end;
$$;

-- ---------------------------------------------------------------------------
-- Paying the sharer, once the person they brought in has actually paid
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
  v_credit   integer;
begin
  select customer_id, total_amount into v_buyer, v_total
    from public.orders where id = p_order_id;
  if v_buyer is null then
    return jsonb_build_object('ok', false, 'error', 'No such order.');
  end if;

  select * into v_referral from public.referrals
   where joiner_id = v_buyer and status = 'joined';
  if not found then
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'no referral waiting');
  end if;

  select owner_id into v_owner from public.referral_codes where code = v_referral.code;
  if v_owner is null then
    -- A shop code earns nobody; the joiner already had their credit.
    update public.referrals set status = 'earned', earned_at = now(), earning_order_id = p_order_id
     where id = v_referral.id;
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'shop code');
  end if;

  v_min := coalesce((select value from public.app_settings where key = 'referral_min_order'), 1000)::integer;
  if v_total < v_min then
    return jsonb_build_object('ok', true, 'settled', false, 'why', 'order below the earning threshold');
  end if;

  v_credit := coalesce((select value from public.app_settings where key = 'referral_sharer_credit'), 200)::integer;

  update public.referrals
     set status = 'earned', earned_at = now(), earning_order_id = p_order_id
   where id = v_referral.id;

  if v_credit > 0 then
    insert into public.credit_ledger (user_id, amount, reason, referral_id, order_id)
    values (v_owner, v_credit, 'Somebody you referred placed their first order', v_referral.id, p_order_id);
  end if;

  return jsonb_build_object('ok', true, 'settled', true, 'credit', v_credit);
end;
$$;

-- ---------------------------------------------------------------------------
-- What an order says about credit
-- ---------------------------------------------------------------------------
-- total_amount stays the real value of the goods; this is what was taken off
-- it, so an invoice can show the discount and the books still add up.
alter table public.orders add column if not exists credit_applied numeric not null default 0;

-- ---------------------------------------------------------------------------
-- Who may see what
-- ---------------------------------------------------------------------------
alter table public.referral_codes enable row level security;
alter table public.referrals      enable row level security;
alter table public.credit_ledger  enable row level security;

drop policy if exists referral_codes_read on public.referral_codes;
create policy referral_codes_read on public.referral_codes
  for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists referral_codes_admin on public.referral_codes;
create policy referral_codes_admin on public.referral_codes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals
  for select using (
    joiner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.referral_codes c where c.code = referrals.code and c.owner_id = auth.uid())
  );

drop policy if exists credit_ledger_read on public.credit_ledger;
create policy credit_ledger_read on public.credit_ledger
  for select using (user_id = auth.uid() or public.is_admin());

-- Nobody writes credit from a browser. Every row is written by a function
-- that runs as the owner of the database, or by the server with its own key.
revoke insert, update, delete on public.credit_ledger from anon, authenticated;
revoke insert, update, delete on public.referrals     from anon, authenticated;
revoke insert, update, delete on public.referral_codes from anon, authenticated;

grant select on public.referral_codes, public.referrals, public.credit_ledger to authenticated;
grant execute on function public.my_referral_code() to authenticated;
grant execute on function public.claim_referral_code(text) to authenticated;
grant execute on function public.credit_balance(uuid) to authenticated;

select 'referrals and credit ready' as status;
