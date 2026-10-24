-- 051 — what the shop needs to know about a partner.
--
-- The form asked for a business name, a contact, a phone and a city. That is
-- enough to know somebody applied and nothing like enough to pay them or to
-- find them.
--
-- A village is not a city, and a district is not a state: an address written
-- as one line comes back unusable when somebody actually has to reach the
-- place. So the address is kept in its parts.
--
-- Credit is paid out against something — a UPI id, usually. It is stored as
-- written and never validated here: a wrong id is a conversation with the
-- partner, not something a check box can fix, and refusing a slightly odd one
-- would block more honest partners than it would catch mistakes.
--
-- The address is required; a photograph, a visiting card and a map pin are
-- not, and are deliberately absent. Those need a storage bucket and an upload
-- path of their own, and holding this up for them would leave the address and
-- the payment id unasked for meanwhile. A partner who cannot be reached is a
-- partner who cannot be paid, which is why the address alone is insisted on.

alter table public.referral_partners
  add column if not exists whatsapp     text,
  add column if not exists address_line text,
  add column if not exists village      text,
  add column if not exists tehsil       text,
  add column if not exists district     text,
  add column if not exists state        text,
  add column if not exists pincode      text,
  -- How they are paid what they earn. A UPI id for most; anything else the
  -- partner writes is kept as written rather than forced into a shape.
  add column if not exists payout_upi   text,
  add column if not exists payout_note  text;

create or replace function public.apply_as_partner(
  p_business_name text,
  p_contact_name  text default null,
  p_phone         text default null,
  p_city          text default null,
  p_kind          text default null,
  p_whatsapp      text default null,
  p_address_line  text default null,
  p_village       text default null,
  p_tehsil        text default null,
  p_district      text default null,
  p_state         text default null,
  p_pincode       text default null,
  p_payout_upi    text default null,
  p_payout_note   text default null
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

  -- Enough of an address to actually reach the place. An office is as good as
  -- a shop here: a planner or a photographer works from one.
  if nullif(trim(p_address_line), '') is null
     or nullif(trim(coalesce(p_village, p_city)), '') is null
     or nullif(trim(p_district), '') is null
     or nullif(trim(p_state), '') is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Give the full address — shop or office, village or town, district and state.'
    );
  end if;

  insert into public.referral_partners (
    user_id, business_name, contact_name, phone, city, kind,
    whatsapp, address_line, village, tehsil, district, state, pincode,
    payout_upi, payout_note
  )
  values (
    v_user, v_name,
    nullif(trim(p_contact_name), ''), nullif(trim(p_phone), ''),
    nullif(trim(p_city), ''), nullif(trim(p_kind), ''),
    nullif(trim(p_whatsapp), ''), nullif(trim(p_address_line), ''),
    nullif(trim(p_village), ''), nullif(trim(p_tehsil), ''),
    nullif(trim(p_district), ''), nullif(trim(p_state), ''),
    nullif(trim(p_pincode), ''), nullif(trim(p_payout_upi), ''),
    nullif(trim(p_payout_note), '')
  )
  on conflict (user_id) do update
    -- Applying again corrects the details. A field left blank keeps what was
    -- there: somebody fixing their UPI id should not lose their address by
    -- not retyping it.
    set business_name = excluded.business_name,
        contact_name  = coalesce(excluded.contact_name,  public.referral_partners.contact_name),
        phone         = coalesce(excluded.phone,         public.referral_partners.phone),
        city          = coalesce(excluded.city,          public.referral_partners.city),
        kind          = coalesce(excluded.kind,          public.referral_partners.kind),
        whatsapp      = coalesce(excluded.whatsapp,      public.referral_partners.whatsapp),
        address_line  = coalesce(excluded.address_line,  public.referral_partners.address_line),
        village       = coalesce(excluded.village,       public.referral_partners.village),
        tehsil        = coalesce(excluded.tehsil,        public.referral_partners.tehsil),
        district      = coalesce(excluded.district,      public.referral_partners.district),
        state         = coalesce(excluded.state,         public.referral_partners.state),
        pincode       = coalesce(excluded.pincode,       public.referral_partners.pincode),
        payout_upi    = coalesce(excluded.payout_upi,    public.referral_partners.payout_upi),
        payout_note   = coalesce(excluded.payout_note,   public.referral_partners.payout_note);

  select status into v_status from public.referral_partners where user_id = v_user;

  v_code := public.my_referral_code();

  return jsonb_build_object('ok', true, 'status', v_status, 'code', v_code);
end;
$$;

grant execute on function public.apply_as_partner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.my_partner_record()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object(
       'business_name', business_name,
       'contact_name', contact_name,
       'phone', phone,
       'whatsapp', whatsapp,
       'city', city,
       'kind', kind,
       'address_line', address_line,
       'village', village,
       'tehsil', tehsil,
       'district', district,
       'state', state,
       'pincode', pincode,
       'payout_upi', payout_upi,
       'status', status,
       'created_at', created_at)
       from public.referral_partners where user_id = auth.uid()),
    'null'::jsonb);
$$;

grant execute on function public.my_partner_record() to authenticated;

select 'partner contact details ready' as status;
