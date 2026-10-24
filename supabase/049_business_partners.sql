-- 049 — business partners.
--
-- Anybody signed in can already share a code. This is for the other kind of
-- referrer: a shop, a wedding planner, a photographer, somebody who sends
-- customers as part of their own trade rather than telling a cousin. The
-- shop wants their business details on record, not just a user account.
--
-- Signing up as a partner does not change what anybody earns. It records who
-- they are and issues their code in one step; approval is a flag the shop can
-- act on, and the code works either way so nobody is left waiting on a
-- decision nobody has made yet.

create table if not exists public.referral_partners (
  id            uuid primary key default gen_random_uuid(),
  -- One partner record per account.
  user_id       uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null,
  contact_name  text,
  phone         text,
  city          text,
  -- What they do: a shop, a planner, a photographer, anything else.
  kind          text,
  notes         text,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.profiles(id)
);

create index if not exists referral_partners_status_idx
  on public.referral_partners (status, created_at desc);

alter table public.referral_partners enable row level security;

-- A partner may read their own record and nothing else. Writes go through the
-- function below, never straight from the browser, so status cannot be set to
-- 'approved' by whoever is filling the form in.
drop policy if exists referral_partners_own on public.referral_partners;
create policy referral_partners_own on public.referral_partners
  for select using (user_id = auth.uid());

drop policy if exists referral_partners_admin on public.referral_partners;
create policy referral_partners_admin on public.referral_partners
  for all using (
    exists (select 1 from public.profiles p
             where p.id = auth.uid() and p.role in ('admin', 'owner'))
  );

-- ---------------------------------------------------------------------------
-- Apply, and get your code in the same step
-- ---------------------------------------------------------------------------
create or replace function public.apply_as_partner(
  p_business_name text,
  p_contact_name  text default null,
  p_phone         text default null,
  p_city          text default null,
  p_kind          text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_name text := nullif(trim(p_business_name), '');
  v_code text;
  v_status text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in first.');
  end if;
  if v_name is null then
    return jsonb_build_object('ok', false, 'error', 'Tell us the business name.');
  end if;

  insert into public.referral_partners (user_id, business_name, contact_name, phone, city, kind)
  values (v_user, v_name, nullif(trim(p_contact_name), ''), nullif(trim(p_phone), ''),
          nullif(trim(p_city), ''), nullif(trim(p_kind), ''))
  on conflict (user_id) do update
    -- Applying again corrects the details rather than being refused; a
    -- decision already made is left alone.
    set business_name = excluded.business_name,
        contact_name  = coalesce(excluded.contact_name, public.referral_partners.contact_name),
        phone         = coalesce(excluded.phone, public.referral_partners.phone),
        city          = coalesce(excluded.city, public.referral_partners.city),
        kind          = coalesce(excluded.kind, public.referral_partners.kind);

  select status into v_status from public.referral_partners where user_id = v_user;

  -- A partner with no code to share is not a partner. Issuing it here means
  -- one button does the whole job.
  v_code := public.my_referral_code();

  return jsonb_build_object('ok', true, 'status', v_status, 'code', v_code);
end;
$$;

grant execute on function public.apply_as_partner(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Is the person asking already a partner?
-- ---------------------------------------------------------------------------
create or replace function public.my_partner_record()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object(
       'business_name', business_name,
       'city', city,
       'kind', kind,
       'status', status,
       'created_at', created_at)
       from public.referral_partners where user_id = auth.uid()),
    'null'::jsonb);
$$;

grant execute on function public.my_partner_record() to authenticated;

select 'business partners ready' as status;
