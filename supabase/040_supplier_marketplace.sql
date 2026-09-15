-- 040_supplier_marketplace.sql
--
-- Suppliers sell their own safas through SafaKing.
--
--   1. A supplier applies from their own account (/supplier-portal). The owner
--      or the Operations Manager approves, and that opens the supplier account.
--      An artist or staff account cannot also be a supplier: they make a
--      separate account.
--   2. A supplier lists products with their own price, stock and GST rate.
--      Every listing, and every later change to what customers see (name,
--      price, photos), waits for SafaKing's approval.
--   3. SafaKing keeps the GST, its platform fee and the payment gateway fee out
--      of the supplier's price (rates in app_settings). At 5% GST, 8% and 2%,
--      a ₹100 safa pays the supplier ₹85.24.
--   4. Each supplier sets a delivery charge for their own city, their state
--      and the rest of India. The customer pays it and it goes to the supplier
--      in full.
--   5. The customer pays an advance at checkout and the balance before the
--      parcel leaves. The supplier sees the customer's name, phone and address
--      only once the balance is paid.
--   6. A delivered order is paid to the supplier after a wait (7 days), in a
--      batch: Finance prepares it, a second person approves it, and it is
--      marked paid with the bank reference.
--
-- Privacy: no customer, artist or other supplier can see who the suppliers
-- are, where they are or what they earn. A supplier sees only their own
-- listings, orders and payouts.

-- ---------------------------------------------------------------------------
-- 0. Changes the guards below let through
-- ---------------------------------------------------------------------------
-- The server (service role) and a change made from inside another trigger —
-- a KYC document refreshing the supplier's status, a new photo sending the
-- listing back for review — are SafaKing's own writes.
create or replace function public.trusted_write()
returns boolean
language sql
as $$
  select coalesce(auth.role(), '') = 'service_role' or pg_trigger_depth() > 1;
$$;

create table if not exists public.policy_backup (
  id         bigserial primary key,
  tablename  text not null,
  policyname text not null,
  cmd        text,
  roles      text,
  qual       text,
  with_check text,
  dropped_at timestamptz not null default now()
);
alter table public.policy_backup enable row level security;

-- ---------------------------------------------------------------------------
-- 1. Rates, editable under Admin → Settings
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, label, description) values
  ('supplier_platform_fee_rate', 0.08, 'Supplier sale: SafaKing platform fee (0-1)',
   'Kept from the supplier''s price on every sale. 0.08 = 8%.'),
  ('supplier_gateway_fee_rate', 0.02, 'Supplier sale: payment gateway fee (0-1)',
   'The online payment charge, kept from the supplier''s price. 0.02 = 2%.'),
  ('supplier_payout_hold_days', 7, 'Supplier payout: days to wait after delivery',
   'A delivered order is paid to the supplier after this many days, so a customer can report a problem first.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Applications and supplier accounts
-- ---------------------------------------------------------------------------
alter table public.supplier_applications
  add column if not exists state             text,
  add column if not exists pincode           text,
  add column if not exists shop_address      text,
  add column if not exists gst_number        text,
  add column if not exists upi_id            text,
  add column if not exists bank_holder_name  text,
  add column if not exists bank_ifsc         text,
  add column if not exists also_artist       boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists review_note       text,
  add column if not exists reviewed_by       uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at       timestamptz;

alter table public.supplier_profiles
  add column if not exists state           text,
  add column if not exists pincode         text,
  add column if not exists upi_id          text,
  add column if not exists also_artist     boolean not null default false,
  add column if not exists ship_same_city  integer,
  add column if not exists ship_same_state integer,
  add column if not exists ship_rest_india integer,
  add column if not exists dispatch_days   integer not null default 2,
  add column if not exists approved_by     uuid references public.profiles (id) on delete set null,
  add column if not exists approved_at     timestamptz,
  add column if not exists updated_at      timestamptz not null default now();

-- One supplier account per login. The repo's table says so; the live table
-- was not built from the repo, so make sure (approval upserts on it).
create unique index if not exists supplier_profiles_user_id_key on public.supplier_profiles (user_id);

alter table public.supplier_profiles drop constraint if exists supplier_profiles_pincode_format;
alter table public.supplier_profiles add constraint supplier_profiles_pincode_format
  check (pincode is null or pincode ~ '^[1-9][0-9]{5}$');

alter table public.supplier_profiles drop constraint if exists supplier_profiles_delivery_charges;
alter table public.supplier_profiles add constraint supplier_profiles_delivery_charges
  check (coalesce(ship_same_city, 0) between 0 and 5000
     and coalesce(ship_same_state, 0) between 0 and 5000
     and coalesce(ship_rest_india, 0) between 0 and 5000);

alter table public.supplier_profiles drop constraint if exists supplier_profiles_dispatch_days;
alter table public.supplier_profiles add constraint supplier_profiles_dispatch_days
  check (dispatch_days between 0 and 30);

-- The "I am also a supplier / artist" tick, shown to the admin on both sides.
alter table public.artist_applications add column if not exists also_supplier boolean not null default false;
alter table public.artist_profiles     add column if not exists also_supplier boolean not null default false;

create or replace function public.my_supplier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.supplier_profiles where user_id = auth.uid();
$$;

create or replace function public.my_active_supplier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.supplier_profiles where user_id = auth.uid() and active;
$$;

-- A supplier's listings show only while the account is active and its
-- documents (shop photo, bank proof) are approved.
create or replace function public.supplier_is_live(p_supplier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.active and s.verification_status::text = 'verified'
                     from public.supplier_profiles s
                    where s.id = p_supplier_id), false);
$$;

-- The permission matrix from 037, with 'suppliers' for the Operations Manager.
-- Keep src/lib/departments.ts in step with this.
create or replace function public.staff_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case public.staff_department()
      when 'owner' then true
      when 'operations' then p_permission = any (array[
        'customers', 'bookings', 'assign_artist', 'standing', 'complaints', 'messages', 'reports',
        'expenses_read', 'refund_verify', 'refund_approve', 'refund_send', 'refund_exception',
        'suppliers'])
      when 'support' then p_permission = any (array[
        'customers', 'bookings', 'complaints', 'messages', 'refund_verify'])
      when 'artist_ops' then p_permission = any (array[
        'bookings', 'assign_artist', 'artists', 'kyc', 'standing', 'complaints'])
      when 'finance' then p_permission = any (array[
        'bookings', 'finance', 'expenses', 'expenses_read', 'reports',
        'refund_verify', 'refund_approve', 'refund_send'])
    end,
    false
  );
$$;

create or replace function public.guard_supplier_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if public.trusted_write() or public.staff_can('suppliers') then
    return new;
  end if;

  select role::text into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    raise exception 'Sign in to apply as a supplier.' using errcode = 'P0001';
  elsif v_role <> 'customer' then
    raise exception 'This is % account. A supplier needs its own account: sign out and apply with a different email.',
      case v_role when 'artist' then 'an artist' else 'a staff' end
      using errcode = 'P0001';
  end if;
  if exists (select 1 from public.supplier_profiles where user_id = auth.uid()) then
    raise exception 'This account is already a SafaKing supplier.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.supplier_applications where user_id = auth.uid() and status::text = 'pending') then
    raise exception 'Your application is already with our team.' using errcode = 'P0001';
  end if;

  new.user_id     := auth.uid();
  new.status      := 'pending';
  new.review_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.pincode     := nullif(btrim(new.pincode), '');
  new.gst_number  := upper(nullif(btrim(new.gst_number), ''));
  new.bank_ifsc   := upper(nullif(btrim(new.bank_ifsc), ''));
  new.upi_id      := nullif(btrim(new.upi_id), '');

  if coalesce(btrim(new.business_name), '') = '' or coalesce(btrim(new.contact_name), '') = ''
     or coalesce(btrim(new.phone), '') = '' then
    raise exception 'Business name, contact person and phone number are required.' using errcode = 'P0001';
  end if;
  if coalesce(new.pincode, '') !~ '^[1-9][0-9]{5}$' then
    raise exception 'Enter the 6-digit pincode your parcels will be sent from.' using errcode = 'P0001';
  end if;
  if new.gst_number is not null and new.gst_number !~ '^[0-9]{2}[A-Z0-9]{13}$' then
    raise exception 'A GSTIN is 15 characters and starts with two digits.' using errcode = 'P0001';
  end if;
  if new.bank_ifsc is not null and new.bank_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
    raise exception 'That IFSC code does not look right. It has 11 characters, like SBIN0001234.' using errcode = 'P0001';
  end if;
  if new.terms_accepted_at is null then
    raise exception 'Please accept the supplier terms.' using errcode = 'P0001';
  end if;
  new.terms_accepted_at := now();
  return new;
end;
$$;

drop trigger if exists supplier_applications_guard on public.supplier_applications;
create trigger supplier_applications_guard
  before insert on public.supplier_applications
  for each row execute function public.guard_supplier_application();

create or replace function public.approve_supplier_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app      public.supplier_applications%rowtype;
  v_role     text;
  v_supplier uuid;
begin
  if not public.staff_can('suppliers') then
    raise exception 'Only the owner or the Operations Manager can approve suppliers.' using errcode = 'P0001';
  end if;

  select * into v_app from public.supplier_applications where id = p_application_id for update;
  if not found then
    raise exception 'That application no longer exists.' using errcode = 'P0001';
  end if;
  if v_app.user_id is null then
    raise exception 'This application came from the old form and has no account behind it. Ask them to apply again from the supplier portal.'
      using errcode = 'P0001';
  end if;

  select role::text into v_role from public.profiles where id = v_app.user_id;
  if v_role is null then
    raise exception 'The account behind this application no longer exists.' using errcode = 'P0001';
  elsif v_role <> 'customer' then
    raise exception 'This is % account. A supplier needs a separate account: ask them to apply again with a different email.',
      case v_role when 'artist' then 'an artist' else 'a staff' end
      using errcode = 'P0001';
  end if;

  insert into public.supplier_profiles as s (
    user_id, application_id, business_name, contact_name, phone, email, city, state, pincode,
    category, shop_address, gst_number, upi_id, bank_holder_name, bank_ifsc, also_artist,
    active, approved_by, approved_at
  ) values (
    v_app.user_id, v_app.id, v_app.business_name, v_app.contact_name, v_app.phone, v_app.email,
    v_app.city, v_app.state, v_app.pincode, v_app.category, v_app.shop_address, v_app.gst_number,
    v_app.upi_id, v_app.bank_holder_name, v_app.bank_ifsc, v_app.also_artist,
    true, auth.uid(), now()
  )
  on conflict (user_id) do update set
    application_id   = excluded.application_id,
    business_name    = excluded.business_name,
    contact_name     = excluded.contact_name,
    phone            = excluded.phone,
    email            = excluded.email,
    city             = excluded.city,
    state            = excluded.state,
    pincode          = excluded.pincode,
    category         = excluded.category,
    shop_address     = excluded.shop_address,
    gst_number       = excluded.gst_number,
    upi_id           = excluded.upi_id,
    bank_holder_name = excluded.bank_holder_name,
    bank_ifsc        = excluded.bank_ifsc,
    also_artist      = excluded.also_artist,
    active           = true,
    approved_by      = excluded.approved_by,
    approved_at      = excluded.approved_at
  returning s.id into v_supplier;

  update public.supplier_applications
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = null
   where id = p_application_id;

  return v_supplier;
end;
$$;

create or replace function public.reject_supplier_application(p_application_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.staff_can('suppliers') then
    raise exception 'Only the owner or the Operations Manager can review suppliers.' using errcode = 'P0001';
  end if;
  if length(coalesce(btrim(p_note), '')) < 5 then
    raise exception 'Say why, so the applicant knows what to fix.' using errcode = 'P0001';
  end if;
  update public.supplier_applications
     set status = 'rejected', review_note = btrim(p_note), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_application_id and status::text = 'pending';
  if not found then
    raise exception 'Only an application waiting for review can be rejected.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.guard_supplier_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if public.trusted_write() or public.staff_can('suppliers') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'A supplier account is opened by SafaKing when an application is approved.' using errcode = 'P0001';
  end if;

  if new.user_id is distinct from old.user_id
     or new.application_id is distinct from old.application_id
     or new.verification_status is distinct from old.verification_status
     or new.verified is distinct from old.verified
     or new.active is distinct from old.active
     or new.rating is distinct from old.rating
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at then
    raise exception 'Your account status is managed by SafaKing.' using errcode = 'P0001';
  end if;

  -- A changed payout account is how a stolen login steals money, so it is
  -- changed by SafaKing after a phone call, never from the portal.
  if new.upi_id is distinct from old.upi_id
     or new.bank_account_last4 is distinct from old.bank_account_last4
     or new.bank_ifsc is distinct from old.bank_ifsc
     or new.bank_holder_name is distinct from old.bank_holder_name then
    raise exception 'To change where you are paid, call SafaKing. We confirm it with you first.' using errcode = 'P0001';
  end if;

  new.pincode := nullif(btrim(new.pincode), '');
  if new.pincode is null or new.pincode !~ '^[1-9][0-9]{5}$' then
    raise exception 'Enter the 6-digit pincode your parcels are sent from.' using errcode = 'P0001';
  end if;
  if (old.ship_same_city is not null and new.ship_same_city is null)
     or (old.ship_same_state is not null and new.ship_same_state is null)
     or (old.ship_rest_india is not null and new.ship_rest_india is null) then
    raise exception 'A delivery charge cannot be left empty. Enter 0 for free delivery.' using errcode = 'P0001';
  end if;
  new.gst_number := upper(nullif(btrim(new.gst_number), ''));
  if new.gst_number is not null and new.gst_number !~ '^[0-9]{2}[A-Z0-9]{13}$' then
    raise exception 'A GSTIN is 15 characters and starts with two digits.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_profiles_guard on public.supplier_profiles;
create trigger supplier_profiles_guard
  before insert or update on public.supplier_profiles
  for each row execute function public.guard_supplier_profile();

-- ---------------------------------------------------------------------------
-- 3. Delivery zones
-- ---------------------------------------------------------------------------
-- The state a PIN code belongs to, by its postal region. A few neighbouring
-- states share a region (Uttar Pradesh with Uttarakhand, Bihar with
-- Jharkhand), so a parcel between those is charged the in-state rate.
create or replace function public.pincode_region(p_pincode text)
returns text
language sql
immutable
as $$
  select case
    when p_pincode is null or p_pincode !~ '^[1-9][0-9]{5}$' then null
    when p_pincode ~ '^403'     then 'GA'
    when p_pincode ~ '^49'      then 'CG'
    when p_pincode ~ '^50'      then 'TG'
    when p_pincode ~ '^11'      then 'DL'
    when p_pincode ~ '^1[23]'   then 'HR'
    when p_pincode ~ '^1[456]'  then 'PB'
    when p_pincode ~ '^17'      then 'HP'
    when p_pincode ~ '^1[89]'   then 'JK'
    when p_pincode ~ '^2[0-8]'  then 'UP'
    when p_pincode ~ '^3[0-4]'  then 'RJ'
    when p_pincode ~ '^3[6-9]'  then 'GJ'
    when p_pincode ~ '^4[0-4]'  then 'MH'
    when p_pincode ~ '^4[5-8]'  then 'MP'
    when p_pincode ~ '^5[1-3]'  then 'AP'
    when p_pincode ~ '^5[6-9]'  then 'KA'
    when p_pincode ~ '^6[0-4]'  then 'TN'
    when p_pincode ~ '^6[7-9]'  then 'KL'
    when p_pincode ~ '^7[0-4]'  then 'WB'
    when p_pincode ~ '^7[5-7]'  then 'OD'
    when p_pincode ~ '^78'      then 'AS'
    when p_pincode ~ '^79'      then 'NE'
    when p_pincode ~ '^8[0-5]'  then 'BR'
  end;
$$;

-- Same first three digits is the same sorting district: the supplier's city.
create or replace function public.shipping_zone(p_from text, p_to text)
returns text
language sql
immutable
as $$
  select case
    when p_from !~ '^[1-9][0-9]{5}$' or p_to !~ '^[1-9][0-9]{5}$' then 'rest_of_india'
    when left(p_from, 3) = left(p_to, 3) then 'same_city'
    when public.pincode_region(p_from) = public.pincode_region(p_to) then 'same_state'
    else 'rest_of_india'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Supplier listings
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists supplier_id    uuid references public.supplier_profiles (id) on delete restrict,
  add column if not exists gst_percent    numeric(4,1),
  add column if not exists listing_status text not null default 'approved',
  add column if not exists listing_note   text;

alter table public.products drop constraint if exists products_listing_status_check;
alter table public.products add constraint products_listing_status_check
  check (listing_status in ('pending', 'approved', 'rejected'));

alter table public.products drop constraint if exists products_gst_percent_check;
alter table public.products add constraint products_gst_percent_check
  check (gst_percent is null or gst_percent between 0 and 40);

alter table public.products drop constraint if exists products_supplier_gst_check;
alter table public.products add constraint products_supplier_gst_check
  check (supplier_id is null or gst_percent is not null);

create index if not exists products_supplier_id_idx on public.products (supplier_id) where supplier_id is not null;

create sequence if not exists public.supplier_product_code_seq start 10001;

create or replace function public.guard_supplier_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me          uuid;
  v_photo_regex text;
begin
  if public.trusted_write() or public.is_admin() or public.staff_can('suppliers') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_me := public.my_active_supplier_id();
    if v_me is null then
      raise exception 'Only an approved, active SafaKing supplier can list products.' using errcode = 'P0001';
    end if;
    new.supplier_id         := v_me;
    new.code                := 'MKT-' || nextval('public.supplier_product_code_seq');
    new.listing_status      := 'pending';
    new.listing_note        := null;
    new.rating              := null;
    new.reviews_count       := 0;
    new.featured            := false;
    new.is_bestseller       := false;
    new.is_new              := false;
    new.sort_order          := 1000;
    new.is_rentable         := false;
    new.rent_price_per_day  := null;
    new.rent_deposit        := null;
    new.synced_from_desktop := false;
    new.pending_sync        := false;
    new.desktop_price       := null;
    new.created_at          := now();
  else
    if old.supplier_id is null or old.supplier_id is distinct from public.my_supplier_id() then
      raise exception 'You can only change your own listings.' using errcode = 'P0001';
    end if;
    if new.supplier_id is distinct from old.supplier_id
       or new.code is distinct from old.code
       or new.listing_status is distinct from old.listing_status
       or new.listing_note is distinct from old.listing_note
       or new.rating is distinct from old.rating
       or new.reviews_count is distinct from old.reviews_count
       or new.featured is distinct from old.featured
       or new.is_bestseller is distinct from old.is_bestseller
       or new.is_new is distinct from old.is_new
       or new.sort_order is distinct from old.sort_order
       or new.is_rentable is distinct from old.is_rentable
       or new.rent_price_per_day is distinct from old.rent_price_per_day
       or new.rent_deposit is distinct from old.rent_deposit
       or new.synced_from_desktop is distinct from old.synced_from_desktop
       or new.pending_sync is distinct from old.pending_sync
       or new.desktop_price is distinct from old.desktop_price
       or new.created_at is distinct from old.created_at then
      raise exception 'That part of the listing is set by SafaKing.' using errcode = 'P0001';
    end if;
    -- What the customer sees has changed, so SafaKing checks it again before
    -- it shows. Stock and hiding a listing do not need a check.
    if new.name is distinct from old.name
       or new.description is distinct from old.description
       or new.price is distinct from old.price
       or new.original_price is distinct from old.original_price
       or new.category is distinct from old.category
       or new.color is distinct from old.color
       or new.fabric is distinct from old.fabric
       or new.style is distinct from old.style
       or new.occasion is distinct from old.occasion
       or new.image is distinct from old.image
       or new.gst_percent is distinct from old.gst_percent then
      new.listing_status := 'pending';
      new.listing_note   := null;
    end if;
  end if;

  new.name := btrim(new.name);
  if length(coalesce(new.name, '')) < 3 or length(new.name) > 120 then
    raise exception 'Give the product a name of 3 to 120 characters.' using errcode = 'P0001';
  end if;
  if length(coalesce(new.description, '')) > 3000 then
    raise exception 'Keep the description under 3,000 characters.' using errcode = 'P0001';
  end if;
  if new.price is null or new.price < 1 or new.price > 500000 then
    raise exception 'Enter a price between ₹1 and ₹5,00,000.' using errcode = 'P0001';
  end if;
  if new.original_price is not null and new.original_price < new.price then
    raise exception 'The MRP cannot be lower than your selling price.' using errcode = 'P0001';
  end if;
  if new.stock is null or new.stock < 0 or new.stock > 100000 then
    raise exception 'Stock must be between 0 and 1,00,000.' using errcode = 'P0001';
  end if;
  if (tg_op = 'INSERT' or new.gst_percent is distinct from old.gst_percent)
     and (new.gst_percent is null or new.gst_percent not in (0, 5, 18)) then
    raise exception 'Choose the GST rate for this product: 0%%, 5%% or 18%%.' using errcode = 'P0001';
  end if;

  -- Photos only from the supplier's own folder, so a listing can never point
  -- customers at another website.
  v_photo_regex := '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/supplier-products/'
                   || new.supplier_id::text || '/[A-Za-z0-9._-]+$';
  if new.image is not null and new.image !~ v_photo_regex then
    raise exception 'Upload product photos from the supplier portal.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists products_supplier_guard on public.products;
create trigger products_supplier_guard
  before insert or update on public.products
  for each row execute function public.guard_supplier_product();

create or replace function public.owns_supplier_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.products p
                  where p.id = p_product_id
                    and p.supplier_id is not null
                    and p.supplier_id = public.my_supplier_id());
$$;

create or replace function public.product_has_orders(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.order_items oi where oi.product_id = p_product_id);
$$;

create or replace function public.guard_supplier_product_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id  uuid := case when tg_op = 'DELETE' then old.product_id else new.product_id end;
  v_supplier_id uuid;
begin
  if public.trusted_write() or public.is_admin() or public.staff_can('suppliers') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select supplier_id into v_supplier_id from public.products where id = v_product_id;
  if v_supplier_id is null or v_supplier_id is distinct from public.my_supplier_id()
     or (tg_op = 'UPDATE' and new.product_id is distinct from old.product_id) then
    raise exception 'You can only change photos of your own listings.' using errcode = 'P0001';
  end if;

  if tg_op <> 'DELETE' then
    if new.url !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/supplier-products/'
                   || v_supplier_id::text || '/[A-Za-z0-9._-]+$') then
      raise exception 'Upload product photos from the supplier portal.' using errcode = 'P0001';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.product_images where product_id = v_product_id) >= 5 then
      raise exception 'A listing can have up to 5 extra photos.' using errcode = 'P0001';
    end if;
  end if;

  -- A new or removed photo is checked again before customers see the listing.
  update public.products
     set listing_status = 'pending', listing_note = null
   where id = v_product_id and listing_status <> 'pending';

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists product_images_supplier_guard on public.product_images;
create trigger product_images_supplier_guard
  before insert or update or delete on public.product_images
  for each row execute function public.guard_supplier_product_image();

create or replace function public.review_supplier_product(p_product_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  if not public.staff_can('suppliers') then
    raise exception 'Only the owner or the Operations Manager can review listings.' using errcode = 'P0001';
  end if;

  select p.id, p.gst_percent, p.image, s.active, s.verification_status::text as kyc, s.pincode,
         s.ship_same_city, s.ship_same_state, s.ship_rest_india
    into v
    from public.products p
    join public.supplier_profiles s on s.id = p.supplier_id
   where p.id = p_product_id
   for update of p;
  if not found then
    raise exception 'That is not a supplier listing.' using errcode = 'P0001';
  end if;

  if p_approve then
    if not v.active then
      raise exception 'This supplier is paused. Resume their account first.' using errcode = 'P0001';
    elsif v.kyc <> 'verified' then
      raise exception 'This supplier''s documents (shop photo and bank proof) are not approved yet.' using errcode = 'P0001';
    elsif v.pincode is null or v.ship_same_city is null or v.ship_same_state is null or v.ship_rest_india is null then
      raise exception 'This supplier has not set their pincode and delivery charges yet.' using errcode = 'P0001';
    elsif v.gst_percent is null then
      raise exception 'Set the GST rate for this listing first.' using errcode = 'P0001';
    elsif v.image is null then
      raise exception 'This listing has no photo.' using errcode = 'P0001';
    end if;
    update public.products set listing_status = 'approved', listing_note = null where id = p_product_id;
  else
    if length(coalesce(btrim(p_note), '')) < 5 then
      raise exception 'Tell the supplier what to fix.' using errcode = 'P0001';
    end if;
    update public.products set listing_status = 'rejected', listing_note = btrim(p_note) where id = p_product_id;
  end if;
end;
$$;

-- `p.*` is expanded when a view is created, so the view is rebuilt to carry
-- the new columns. A supplier's code never matches the shop POS's stock.
drop view if exists public.products_with_availability;
create view public.products_with_availability
with (security_invoker = true)
as
select
  p.*,
  greatest(p.stock - coalesce(d.desktop_committed, 0), 0) as available_quantity,
  coalesce(
    (select array_agg(pi.url order by pi.sort_order) from public.product_images pi where pi.product_id = p.id),
    array[]::text[]
  ) as gallery_images
from public.products p
left join public.desktop_inventory d on d.sku = p.code and p.supplier_id is null;

grant select on public.products_with_availability to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. The fee split
-- ---------------------------------------------------------------------------
-- GST is inside the price (₹100 at 5% holds ₹4.76 of GST); the platform and
-- gateway fees are a share of the price. src/lib/supplier.ts shows suppliers
-- the same sum.
create or replace function public.supplier_fee_split(
  p_amount numeric, p_gst_percent numeric, p_platform_rate numeric, p_gateway_rate numeric
)
returns table (gst_amount numeric, platform_fee numeric, gateway_fee numeric, payout numeric)
language sql
immutable
as $$
  select x.g, x.pf, x.gw, round(p_amount - x.g - x.pf - x.gw, 2)
    from (select round(p_amount * coalesce(p_gst_percent, 0) / (100 + coalesce(p_gst_percent, 0)), 2) as g,
                 round(p_amount * p_platform_rate, 2) as pf,
                 round(p_amount * p_gateway_rate, 2) as gw) x;
$$;

create or replace function public.supplier_fee_rates()
returns table (platform_rate numeric, gateway_rate numeric, hold_days integer)
language sql
stable
security definer
set search_path = public
as $$
  select least(greatest(coalesce((select value::numeric from public.app_settings where key = 'supplier_platform_fee_rate'), 0.08), 0), 0.5),
         least(greatest(coalesce((select value::numeric from public.app_settings where key = 'supplier_gateway_fee_rate'), 0.02), 0), 0.1),
         least(greatest(coalesce((select value::numeric from public.app_settings where key = 'supplier_payout_hold_days'), 7), 0), 60)::integer;
$$;

-- ---------------------------------------------------------------------------
-- 6. Orders, shipments and payouts
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists pincode         text,
  add column if not exists shipping_amount integer not null default 0;

alter table public.payments
  add column if not exists purpose text not null default 'advance';
alter table public.payments drop constraint if exists payments_purpose_check;
alter table public.payments add constraint payments_purpose_check check (purpose in ('advance', 'balance'));

create table if not exists public.supplier_payouts (
  id                uuid primary key default gen_random_uuid(),
  supplier_id       uuid not null references public.supplier_profiles (id) on delete restrict,
  status            text not null default 'prepared',
  amount            numeric(12,2) not null,
  shipment_count    integer not null,
  prepared_by       uuid references public.profiles (id) on delete set null,
  prepared_at       timestamptz not null default now(),
  approved_by       uuid references public.profiles (id) on delete set null,
  approved_at       timestamptz,
  paid_by           uuid references public.profiles (id) on delete set null,
  paid_at           timestamptz,
  payment_reference text,
  cancelled_by      uuid references public.profiles (id) on delete set null,
  cancelled_at      timestamptz,
  cancel_reason     text,
  constraint supplier_payouts_status_check check (status in ('prepared', 'approved', 'paid', 'cancelled')),
  constraint supplier_payouts_two_people check (approved_by is null or approved_by is distinct from prepared_by),
  constraint supplier_payouts_paid_reference check (status <> 'paid' or length(btrim(coalesce(payment_reference, ''))) >= 4)
);

create index if not exists supplier_payouts_supplier_idx on public.supplier_payouts (supplier_id, status);

-- One parcel per supplier per order.
create table if not exists public.order_shipments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  supplier_id     uuid not null references public.supplier_profiles (id) on delete restrict,
  status          text not null default 'awaiting_payment',
  zone            text not null,
  items_amount    numeric(12,2) not null default 0,
  shipping_amount integer not null default 0,
  payout_amount   numeric(12,2) not null default 0,
  courier         text,
  tracking_number text,
  ready_at        timestamptz,
  dispatched_at   timestamptz,
  delivered_at    timestamptz,
  delivered_by    uuid references public.profiles (id) on delete set null,
  cancelled_at    timestamptz,
  cancelled_by    uuid references public.profiles (id) on delete set null,
  cancel_reason   text,
  payout_hold     boolean not null default false,
  hold_reason     text,
  payout_id       uuid references public.supplier_payouts (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint order_shipments_status_check
    check (status in ('awaiting_payment', 'new', 'ready', 'dispatched', 'delivered', 'cancelled')),
  constraint order_shipments_zone_check check (zone in ('same_city', 'same_state', 'rest_of_india')),
  constraint order_shipments_sent_has_courier check (status not in ('dispatched', 'delivered') or courier is not null),
  constraint order_shipments_one_per_supplier unique (order_id, supplier_id)
);

create index if not exists order_shipments_supplier_idx on public.order_shipments (supplier_id, status);
create index if not exists order_shipments_payout_idx on public.order_shipments (payout_id) where payout_id is not null;

-- What each supplier line was sold for and how it splits, fixed at the moment
-- of the order so a later change of rates never changes an old payout.
create table if not exists public.order_supplier_lines (
  order_item_id     uuid primary key references public.order_items (id) on delete cascade,
  order_id          uuid not null references public.orders (id) on delete cascade,
  shipment_id       uuid not null references public.order_shipments (id) on delete cascade,
  supplier_id       uuid not null references public.supplier_profiles (id) on delete restrict,
  product_id        uuid references public.products (id) on delete set null,
  product_name      text not null,
  unit_price        integer not null,
  quantity          integer not null,
  line_total        numeric(12,2) not null,
  gst_percent       numeric(4,1) not null,
  gst_amount        numeric(12,2) not null,
  platform_fee_rate numeric(6,4) not null,
  platform_fee      numeric(12,2) not null,
  gateway_fee_rate  numeric(6,4) not null,
  gateway_fee       numeric(12,2) not null,
  supplier_payout   numeric(12,2) not null,
  created_at        timestamptz not null default now()
);

create index if not exists order_supplier_lines_shipment_idx on public.order_supplier_lines (shipment_id);
create index if not exists order_supplier_lines_order_idx on public.order_supplier_lines (order_id);

-- The delivery charge for each supplier in a bag. Called by the server only.
create or replace function public.quote_supplier_shipping(p_product_ids uuid[], p_pincode text)
returns table (supplier_id uuid, zone text, amount integer, dispatch_days integer)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if coalesce(p_pincode, '') !~ '^[1-9][0-9]{5}$' then
    raise exception 'Enter a valid 6-digit pincode.' using errcode = 'P0001';
  end if;
  return query
  select s.id,
         z.zone,
         case z.zone when 'same_city' then s.ship_same_city
                     when 'same_state' then s.ship_same_state
                     else s.ship_rest_india end,
         s.dispatch_days
    from public.supplier_profiles s
   cross join lateral (select public.shipping_zone(s.pincode, p_pincode) as zone) z
   where s.id in (select p.supplier_id from public.products p
                   where p.id = any (coalesce(p_product_ids, array[]::uuid[]))
                     and p.supplier_id is not null);
end;
$$;

-- Splits a new order into one shipment per supplier and records the fee
-- split of every supplier line. Run by the checkout right after the order
-- items are saved; running it again changes nothing.
create or replace function public.record_order_shipments(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pincode  text;
  v_shipping integer;
  v_rates    record;
  v_total    integer;
  v_count    integer;
  r          record;
begin
  select o.pincode, o.shipping_amount into v_pincode, v_shipping
    from public.orders o
   where o.id = p_order_id
   for update;
  if not found then
    raise exception 'Order % not found.', p_order_id using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.order_shipments where order_id = p_order_id;
  if v_count > 0 then
    return v_count;
  end if;

  if not exists (select 1 from public.order_items oi
                   join public.products p on p.id = oi.product_id
                  where oi.order_id = p_order_id and p.supplier_id is not null) then
    if coalesce(v_shipping, 0) <> 0 then
      raise exception 'Delivery charges changed while you were checking out. Please try again.' using errcode = 'P0001';
    end if;
    return 0;
  end if;

  for r in
    select q.supplier_id, q.zone, q.amount
      from public.quote_supplier_shipping(
             array(select oi.product_id from public.order_items oi
                    where oi.order_id = p_order_id and oi.product_id is not null),
             v_pincode) q
  loop
    if r.amount is null then
      raise exception 'One of the items cannot be delivered to this pincode right now.' using errcode = 'P0001';
    end if;
    insert into public.order_shipments (order_id, supplier_id, zone, shipping_amount)
    values (p_order_id, r.supplier_id, r.zone, r.amount);
  end loop;

  select * into v_rates from public.supplier_fee_rates();

  insert into public.order_supplier_lines (
    order_item_id, order_id, shipment_id, supplier_id, product_id, product_name, unit_price, quantity,
    line_total, gst_percent, gst_amount, platform_fee_rate, platform_fee, gateway_fee_rate, gateway_fee,
    supplier_payout
  )
  select oi.id, p_order_id, sh.id, p.supplier_id, oi.product_id, oi.product_name, oi.price, oi.quantity,
         oi.price * oi.quantity, coalesce(p.gst_percent, 0),
         f.gst_amount, v_rates.platform_rate, f.platform_fee, v_rates.gateway_rate, f.gateway_fee, f.payout
    from public.order_items oi
    join public.products p on p.id = oi.product_id and p.supplier_id is not null
    join public.order_shipments sh on sh.order_id = p_order_id and sh.supplier_id = p.supplier_id
   cross join lateral public.supplier_fee_split(oi.price * oi.quantity, coalesce(p.gst_percent, 0),
                                                v_rates.platform_rate, v_rates.gateway_rate) f
   where oi.order_id = p_order_id;

  update public.order_shipments sh
     set items_amount  = t.items,
         payout_amount = t.payout + sh.shipping_amount
    from (select l.shipment_id, sum(l.line_total) as items, sum(l.supplier_payout) as payout
            from public.order_supplier_lines l
           where l.order_id = p_order_id
           group by l.shipment_id) t
   where sh.id = t.shipment_id;

  select coalesce(sum(shipping_amount), 0)::integer, count(*)::integer
    into v_total, v_count
    from public.order_shipments
   where order_id = p_order_id;
  if v_total <> coalesce(v_shipping, 0) then
    raise exception 'Delivery charges changed while you were checking out. Please try again.' using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;

-- A supplier-only order follows its parcels. An order that includes
-- SafaKing's own stock stays with the office, as before.
create or replace function public.sync_order_status_from_shipments(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active    integer;
  v_sent      integer;
  v_delivered integer;
begin
  if exists (select 1 from public.order_items oi
              where oi.order_id = p_order_id
                and not exists (select 1 from public.order_supplier_lines l where l.order_item_id = oi.id)) then
    return;
  end if;

  select count(*) filter (where status <> 'cancelled'),
         count(*) filter (where status in ('dispatched', 'delivered')),
         count(*) filter (where status = 'delivered')
    into v_active, v_sent, v_delivered
    from public.order_shipments
   where order_id = p_order_id;

  if v_active = 0 then
    return;
  elsif v_delivered = v_active then
    update public.orders set status = 'delivered'
     where id = p_order_id and status::text not in ('delivered', 'cancelled');
  elsif v_sent = v_active then
    update public.orders set status = 'shipped'
     where id = p_order_id and status::text in ('pending', 'confirmed');
  else
    update public.orders set status = 'confirmed'
     where id = p_order_id and status::text = 'pending';
  end if;
end;
$$;

-- Payment moves the parcels along: paid advance → the supplier sees the
-- order; a cancelled or refunded order → the unsent parcels are called off.
create or replace function public.orders_drive_shipments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status::text in ('advance_paid', 'fully_paid')
     and old.payment_status::text is distinct from new.payment_status::text then
    update public.order_shipments
       set status = 'new', updated_at = now()
     where order_id = new.id and status = 'awaiting_payment';
  end if;

  if (new.status::text = 'cancelled' and old.status::text is distinct from 'cancelled')
     or (new.payment_status::text in ('refunded', 'failed')
         and old.payment_status::text is distinct from new.payment_status::text) then
    update public.order_shipments
       set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
           cancel_reason = coalesce(cancel_reason, 'The order was cancelled by SafaKing.'), updated_at = now()
     where order_id = new.id and status in ('awaiting_payment', 'new', 'ready');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_drive_shipments on public.orders;
create trigger orders_drive_shipments
  after update of payment_status, status on public.orders
  for each row execute function public.orders_drive_shipments();

-- Everything a supplier does with an order.
create or replace function public.update_supplier_shipment(
  p_shipment_id uuid,
  p_action      text,
  p_courier     text default null,
  p_tracking    text default null,
  p_reason      text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sh      public.order_shipments%rowtype;
  v_paid    text;
  v_ostatus text;
  v_staff   boolean := public.staff_can('suppliers');
begin
  select * into v_sh from public.order_shipments where id = p_shipment_id for update;
  if not found or (not v_staff and v_sh.supplier_id is distinct from public.my_supplier_id()) then
    raise exception 'That order was not found.' using errcode = 'P0001';
  end if;
  if v_sh.status = 'awaiting_payment' then
    raise exception 'The customer has not paid for this order yet.' using errcode = 'P0001';
  end if;
  select o.payment_status::text, o.status::text into v_paid, v_ostatus
    from public.orders o where o.id = v_sh.order_id;

  if p_action = 'ready' then
    if v_sh.status <> 'new' then
      raise exception 'Only a new order can be marked packed.' using errcode = 'P0001';
    end if;
    update public.order_shipments set status = 'ready', ready_at = now(), updated_at = now() where id = v_sh.id;

  elsif p_action = 'dispatch' then
    if v_sh.status not in ('new', 'ready') then
      raise exception 'This order has already been sent or closed.' using errcode = 'P0001';
    end if;
    if v_ostatus = 'cancelled' then
      raise exception 'This order was cancelled. Do not send it.' using errcode = 'P0001';
    end if;
    if v_paid <> 'fully_paid' then
      raise exception 'The customer has not paid the balance yet. Do not send it until it shows "Paid in full".'
        using errcode = 'P0001';
    end if;
    if coalesce(btrim(p_courier), '') = '' then
      raise exception 'Enter the courier name, or Hand delivery.' using errcode = 'P0001';
    end if;
    if btrim(p_courier) !~* '^hand delivery' and coalesce(btrim(p_tracking), '') = '' then
      raise exception 'Enter the tracking number so the customer can follow the parcel.' using errcode = 'P0001';
    end if;
    update public.order_shipments
       set status = 'dispatched', courier = left(btrim(p_courier), 60),
           tracking_number = left(nullif(btrim(p_tracking), ''), 60),
           dispatched_at = now(), updated_at = now()
     where id = v_sh.id;

  elsif p_action = 'deliver' then
    if v_sh.status <> 'dispatched' then
      raise exception 'Only a parcel that has been sent can be marked delivered.' using errcode = 'P0001';
    end if;
    update public.order_shipments
       set status = 'delivered', delivered_at = now(), delivered_by = auth.uid(), updated_at = now()
     where id = v_sh.id;

  elsif p_action = 'cancel' then
    if v_sh.status not in ('new', 'ready') then
      raise exception 'This order can no longer be cancelled here. Call SafaKing.' using errcode = 'P0001';
    end if;
    if length(coalesce(btrim(p_reason), '')) < 5 then
      raise exception 'Say why this order cannot be sent.' using errcode = 'P0001';
    end if;
    update public.order_shipments
       set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
           cancel_reason = left(btrim(p_reason), 500), updated_at = now()
     where id = v_sh.id;
    -- The office refunds the customer for these items.
    update public.orders
       set notes = concat_ws(E'\n', nullif(notes, ''),
             format('SUPPLIER COULD NOT SEND (%s): %s. Refund ₹%s for these items.',
                    to_char(now() at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'),
                    left(btrim(p_reason), 500),
                    (v_sh.items_amount + v_sh.shipping_amount)::text))
     where id = v_sh.order_id;

  else
    raise exception 'Unknown action.' using errcode = 'P0001';
  end if;

  perform public.sync_order_status_from_shipments(v_sh.order_id);
  return (select status from public.order_shipments where id = v_sh.id);
end;
$$;

-- The customer confirms a parcel arrived.
create or replace function public.confirm_order_received(p_shipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status   text;
  v_order_id uuid;
begin
  select sh.status, sh.order_id into v_status, v_order_id
    from public.order_shipments sh
    join public.orders o on o.id = sh.order_id
   where sh.id = p_shipment_id and o.customer_id = auth.uid()
   for update of sh;
  if not found then
    raise exception 'That parcel was not found.' using errcode = 'P0001';
  end if;
  if v_status = 'delivered' then
    return;
  elsif v_status <> 'dispatched' then
    raise exception 'This parcel has not been sent yet.' using errcode = 'P0001';
  end if;
  update public.order_shipments
     set status = 'delivered', delivered_at = now(), delivered_by = auth.uid(), updated_at = now()
   where id = p_shipment_id;
  perform public.sync_order_status_from_shipments(v_order_id);
end;
$$;

-- The customer reports a problem. Until SafaKing settles it, the supplier is
-- not paid for that parcel.
create or replace function public.report_order_problem(p_shipment_id uuid, p_description text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sh            public.order_shipments%rowtype;
  v_payout_status text;
begin
  select sh.* into v_sh
    from public.order_shipments sh
    join public.orders o on o.id = sh.order_id
   where sh.id = p_shipment_id and o.customer_id = auth.uid()
   for update of sh;
  if not found then
    raise exception 'That parcel was not found.' using errcode = 'P0001';
  end if;
  if length(coalesce(btrim(p_description), '')) < 10 then
    raise exception 'Tell us what is wrong in a few words.' using errcode = 'P0001';
  end if;
  if v_sh.status not in ('dispatched', 'delivered') then
    raise exception 'This parcel has not been sent yet. Call SafaKing if something is wrong.' using errcode = 'P0001';
  end if;

  select status into v_payout_status from public.supplier_payouts where id = v_sh.payout_id;

  update public.order_shipments
     set payout_hold = case when coalesce(v_payout_status, '') = 'paid' then payout_hold else true end,
         hold_reason = left(format('Customer, %s: %s',
                                   to_char(now() at time zone 'Asia/Kolkata', 'DD Mon'), btrim(p_description)), 500),
         updated_at  = now()
   where id = p_shipment_id;

  update public.orders
     set notes = concat_ws(E'\n', nullif(notes, ''),
           format('CUSTOMER REPORTED A PROBLEM (%s)%s: %s',
                  to_char(now() at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'),
                  case when v_payout_status = 'paid' then ', after the supplier was paid' else '' end,
                  left(btrim(p_description), 500)))
   where id = v_sh.order_id;
end;
$$;

create or replace function public.set_shipment_payout_hold(p_shipment_id uuid, p_hold boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid boolean;
begin
  if p_hold and not (public.staff_can('suppliers') or public.staff_can('finance') or public.staff_can('complaints')) then
    raise exception 'Only SafaKing staff can hold a supplier payment.' using errcode = 'P0001';
  end if;
  if not p_hold and not (public.staff_can('suppliers') or public.staff_can('finance')) then
    raise exception 'Only the owner, Operations or Finance can release a held supplier payment.' using errcode = 'P0001';
  end if;
  if p_hold and length(coalesce(btrim(p_reason), '')) < 5 then
    raise exception 'Say why the payment is on hold.' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.supplier_payouts p where p.id = sh.payout_id and p.status = 'paid')
    into v_paid
    from public.order_shipments sh
   where sh.id = p_shipment_id;
  if v_paid is null then
    raise exception 'That shipment was not found.' using errcode = 'P0001';
  elsif v_paid then
    raise exception 'The supplier has already been paid for this parcel.' using errcode = 'P0001';
  end if;

  update public.order_shipments
     set payout_hold = p_hold,
         hold_reason = case when p_hold then left(btrim(p_reason), 500) end,
         updated_at  = now()
   where id = p_shipment_id;
end;
$$;

-- A supplier's orders. The customer's name, phone and address appear only
-- while the parcel has to go out and the balance is paid.
create or replace function public.supplier_orders()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.row order by x.created_at desc), '[]'::jsonb)
    from (
      select sh.created_at,
             jsonb_build_object(
               'id', sh.id,
               'order_ref', upper(left(o.id::text, 8)),
               'status', sh.status,
               'zone', sh.zone,
               'created_at', sh.created_at,
               'items_amount', sh.items_amount,
               'shipping_amount', sh.shipping_amount,
               'payout_amount', sh.payout_amount,
               'courier', sh.courier,
               'tracking_number', sh.tracking_number,
               'ready_at', sh.ready_at,
               'dispatched_at', sh.dispatched_at,
               'delivered_at', sh.delivered_at,
               'cancelled_at', sh.cancelled_at,
               'cancel_reason', sh.cancel_reason,
               'payout_hold', sh.payout_hold,
               'payout_status', p.status,
               'paid_at', p.paid_at,
               'paid_in_full', o.payment_status::text = 'fully_paid',
               'order_cancelled', o.status::text = 'cancelled',
               'ship_to_pincode', o.pincode,
               'ship_to_area', (select d.city_state from public.deliverable_pincodes d where d.pincode = o.pincode),
               'customer', case when o.payment_status::text = 'fully_paid'
                                 and o.status::text <> 'cancelled'
                                 and sh.status in ('new', 'ready', 'dispatched')
                                then jsonb_build_object('name', o.customer_name,
                                                        'phone', o.customer_phone,
                                                        'address', o.shipping_address)
                           end,
               'items', (select coalesce(jsonb_agg(jsonb_build_object(
                                   'name', l.product_name, 'quantity', l.quantity, 'unit_price', l.unit_price,
                                   'line_total', l.line_total, 'gst_percent', l.gst_percent,
                                   'gst_amount', l.gst_amount, 'platform_fee', l.platform_fee,
                                   'gateway_fee', l.gateway_fee, 'payout', l.supplier_payout)
                                 order by l.product_name), '[]'::jsonb)
                           from public.order_supplier_lines l
                          where l.shipment_id = sh.id)
             ) as row
        from public.order_shipments sh
        join public.orders o on o.id = sh.order_id
        left join public.supplier_payouts p on p.id = sh.payout_id
       where sh.supplier_id = public.my_supplier_id()
         and sh.status <> 'awaiting_payment'
    ) x;
$$;

-- A customer's paid orders, with parcel tracking. Nothing about suppliers or
-- what they earn.
create or replace function public.my_orders()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.row order by x.created_at desc), '[]'::jsonb)
    from (
      select o.created_at,
             jsonb_build_object(
               'id', o.id,
               'ref', upper(left(o.id::text, 8)),
               'created_at', o.created_at,
               'status', o.status,
               'payment_status', o.payment_status,
               'total_amount', o.total_amount,
               'shipping_amount', o.shipping_amount,
               'advance_amount', o.advance_amount,
               'balance_amount', o.balance_amount,
               'items', (select coalesce(jsonb_agg(jsonb_build_object(
                                   'name', oi.product_name, 'quantity', oi.quantity, 'price', oi.price,
                                   'shipment_id', l.shipment_id)), '[]'::jsonb)
                           from public.order_items oi
                           left join public.order_supplier_lines l on l.order_item_id = oi.id
                          where oi.order_id = o.id),
               'shipments', (select coalesce(jsonb_agg(jsonb_build_object(
                                       'id', sh.id, 'status', sh.status, 'courier', sh.courier,
                                       'tracking_number', sh.tracking_number,
                                       'dispatched_at', sh.dispatched_at, 'delivered_at', sh.delivered_at,
                                       'problem_reported', sh.hold_reason is not null)
                                     order by sh.created_at), '[]'::jsonb)
                               from public.order_shipments sh
                              where sh.order_id = o.id)
             ) as row
        from public.orders o
       where o.customer_id = auth.uid()
         and o.payment_status::text in ('advance_paid', 'fully_paid', 'refunded')
    ) x;
$$;

-- Weekly payouts. Finance prepares; a different person approves; Finance
-- marks it paid with the bank reference.
create or replace function public.prepare_supplier_payouts()
returns table (payout_id uuid, supplier_id uuid, amount numeric, shipments integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_hold integer;
  v_id   uuid;
  r      record;
begin
  if not public.staff_can('finance') then
    raise exception 'Only Finance or the owner can prepare supplier payouts.' using errcode = 'P0001';
  end if;
  -- Two people pressing Prepare at once must not pay the same parcel twice.
  perform pg_advisory_xact_lock(hashtext('prepare_supplier_payouts'));
  select hold_days into v_hold from public.supplier_fee_rates();

  for r in
    select sh.supplier_id as sid, sum(sh.payout_amount) as total, count(*)::integer as n, array_agg(sh.id) as ids
      from public.order_shipments sh
      join public.orders o on o.id = sh.order_id
      join public.supplier_profiles s on s.id = sh.supplier_id
     where sh.status = 'delivered'
       and sh.payout_id is null
       and not sh.payout_hold
       and sh.delivered_at <= now() - make_interval(days => v_hold)
       and o.payment_status::text = 'fully_paid'
       and o.status::text <> 'cancelled'
       and s.verification_status::text = 'verified'
     group by sh.supplier_id
  loop
    insert into public.supplier_payouts (supplier_id, amount, shipment_count, prepared_by)
    values (r.sid, r.total, r.n, auth.uid())
    returning id into v_id;
    update public.order_shipments set payout_id = v_id, updated_at = now() where id = any (r.ids);
    payout_id := v_id;
    supplier_id := r.sid;
    amount := r.total;
    shipments := r.n;
    return next;
  end loop;
end;
$$;

create or replace function public.approve_supplier_payout(p_payout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.supplier_payouts%rowtype;
begin
  if not public.staff_can('finance') then
    raise exception 'Only Finance or the owner can approve supplier payouts.' using errcode = 'P0001';
  end if;
  select * into v from public.supplier_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'That payout was not found.' using errcode = 'P0001';
  elsif v.status <> 'prepared' then
    raise exception 'Only a prepared payout can be approved.' using errcode = 'P0001';
  elsif v.prepared_by = auth.uid() then
    raise exception 'A second person has to approve this payout, because you prepared it.' using errcode = 'P0001';
  elsif exists (select 1 from public.order_shipments where payout_id = p_payout_id and payout_hold) then
    raise exception 'A customer reported a problem with an order in this payout. Cancel it and prepare again once that is settled.'
      using errcode = 'P0001';
  end if;
  update public.supplier_payouts set status = 'approved', approved_by = auth.uid(), approved_at = now()
   where id = p_payout_id;
end;
$$;

create or replace function public.mark_supplier_payout_paid(p_payout_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.supplier_payouts%rowtype;
begin
  if not public.staff_can('finance') then
    raise exception 'Only Finance or the owner can mark supplier payouts paid.' using errcode = 'P0001';
  end if;
  select * into v from public.supplier_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'That payout was not found.' using errcode = 'P0001';
  elsif v.status <> 'approved' then
    raise exception 'A payout has to be approved before it is paid.' using errcode = 'P0001';
  elsif length(coalesce(btrim(p_reference), '')) < 4 then
    raise exception 'Enter the bank or UPI reference (UTR) of the transfer.' using errcode = 'P0001';
  elsif exists (select 1 from public.order_shipments where payout_id = p_payout_id and payout_hold) then
    raise exception 'A customer reported a problem with an order in this payout. Cancel it and prepare again once that is settled.'
      using errcode = 'P0001';
  end if;
  update public.supplier_payouts
     set status = 'paid', paid_by = auth.uid(), paid_at = now(), payment_reference = left(btrim(p_reference), 80)
   where id = p_payout_id;
end;
$$;

create or replace function public.cancel_supplier_payout(p_payout_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.supplier_payouts%rowtype;
begin
  if not public.staff_can('finance') then
    raise exception 'Only Finance or the owner can cancel supplier payouts.' using errcode = 'P0001';
  end if;
  select * into v from public.supplier_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'That payout was not found.' using errcode = 'P0001';
  elsif v.status not in ('prepared', 'approved') then
    raise exception 'Only a payout that has not been paid can be cancelled.' using errcode = 'P0001';
  elsif length(coalesce(btrim(p_reason), '')) < 5 then
    raise exception 'Say why this payout is cancelled.' using errcode = 'P0001';
  end if;
  update public.supplier_payouts
     set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = left(btrim(p_reason), 500)
   where id = p_payout_id;
  -- Its parcels go back into the queue for the next batch.
  update public.order_shipments set payout_id = null, updated_at = now() where payout_id = p_payout_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Who can see and change what
-- ---------------------------------------------------------------------------
-- Every existing rule on these tables is copied into policy_backup and
-- dropped, then only the rules below exist. The live database has carried
-- rules this repo never defined before (see 039).
do $$
declare
  p record;
begin
  for p in
    select * from pg_policies
     where schemaname = 'public'
       and tablename in ('supplier_applications', 'supplier_profiles', 'products', 'product_images')
  loop
    insert into public.policy_backup (tablename, policyname, cmd, roles, qual, with_check)
    values (p.tablename, p.policyname, p.cmd, p.roles::text, p.qual, p.with_check);
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

alter table public.supplier_applications enable row level security;
alter table public.supplier_profiles     enable row level security;
alter table public.products              enable row level security;
alter table public.product_images        enable row level security;
alter table public.order_shipments       enable row level security;
alter table public.order_supplier_lines  enable row level security;
alter table public.supplier_payouts      enable row level security;

-- Applications: the applicant and the people who approve suppliers.
create policy supplier_applications_read on public.supplier_applications
  for select using (user_id = auth.uid() or public.staff_can('suppliers'));
create policy supplier_applications_apply on public.supplier_applications
  for insert with check (auth.uid() is not null and user_id = auth.uid());
create policy supplier_applications_staff_update on public.supplier_applications
  for update using (public.staff_can('suppliers')) with check (public.staff_can('suppliers'));
create policy supplier_applications_staff_delete on public.supplier_applications
  for delete using (public.staff_can('suppliers'));

-- Supplier accounts: the supplier, the people who manage suppliers, and
-- Finance (to pay them).
create policy supplier_profiles_read on public.supplier_profiles
  for select using (user_id = auth.uid() or public.staff_can('suppliers') or public.staff_can('finance'));
create policy supplier_profiles_self_update on public.supplier_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy supplier_profiles_staff_write on public.supplier_profiles
  for all using (public.staff_can('suppliers')) with check (public.staff_can('suppliers'));

-- Products: customers see approved listings of live suppliers; a supplier
-- sees and edits their own; the owner edits the shop's own stock.
create policy products_public_read on public.products
  for select using (active and listing_status = 'approved'
                    and (supplier_id is null or public.supplier_is_live(supplier_id)));
create policy products_staff_read on public.products
  for select using (public.is_admin() or public.staff_can('suppliers'));
create policy products_supplier_read on public.products
  for select using (supplier_id is not null and supplier_id = public.my_supplier_id());
create policy products_admin_write on public.products
  for all using (public.is_admin()) with check (public.is_admin());
create policy products_supplier_insert on public.products
  for insert with check (supplier_id is not null and supplier_id = public.my_active_supplier_id());
create policy products_supplier_update on public.products
  for update using (supplier_id is not null and supplier_id = public.my_supplier_id())
  with check (supplier_id = public.my_supplier_id());
create policy products_supplier_delete on public.products
  for delete using (supplier_id is not null and supplier_id = public.my_supplier_id()
                    and not public.product_has_orders(id));

-- Photos follow their product.
create policy product_images_read on public.product_images
  for select using (exists (select 1 from public.products p where p.id = product_images.product_id));
create policy product_images_admin_write on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());
create policy product_images_supplier_write on public.product_images
  for all using (public.owns_supplier_product(product_id)) with check (public.owns_supplier_product(product_id));

-- Shipments, fee lines and payouts: the supplier's own, and staff. Changes
-- go through the functions above.
drop policy if exists order_shipments_read on public.order_shipments;
create policy order_shipments_read on public.order_shipments
  for select using ((supplier_id = public.my_supplier_id() and status <> 'awaiting_payment')
                    or public.staff_can('suppliers') or public.staff_can('finance') or public.staff_can('customers'));
drop policy if exists order_supplier_lines_read on public.order_supplier_lines;
create policy order_supplier_lines_read on public.order_supplier_lines
  for select using (supplier_id = public.my_supplier_id() or public.staff_can('suppliers') or public.staff_can('finance'));
drop policy if exists supplier_payouts_read on public.supplier_payouts;
create policy supplier_payouts_read on public.supplier_payouts
  for select using (supplier_id = public.my_supplier_id() or public.staff_can('finance') or public.staff_can('suppliers'));

grant select on public.order_shipments, public.order_supplier_lines, public.supplier_payouts to authenticated;

-- The checkout's own functions: the server calls them, nobody else.
revoke execute on function public.quote_supplier_shipping(uuid[], text) from public, anon, authenticated;
revoke execute on function public.record_order_shipments(uuid) from public, anon, authenticated;
revoke execute on function public.sync_order_status_from_shipments(uuid) from public, anon, authenticated;
grant execute on function public.quote_supplier_shipping(uuid[], text) to service_role;
grant execute on function public.record_order_shipments(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Product photos
-- ---------------------------------------------------------------------------
-- Public, so the shop can show them; a supplier writes only inside a folder
-- named with their own supplier id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('supplier-products', 'supplier-products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists supplier_products_upload on storage.objects;
create policy supplier_products_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'supplier-products'
              and (storage.foldername(name))[1] = public.my_active_supplier_id()::text);

drop policy if exists supplier_products_remove on storage.objects;
create policy supplier_products_remove on storage.objects
  for delete to authenticated
  using (bucket_id = 'supplier-products'
         and (storage.foldername(name))[1] = public.my_supplier_id()::text);

-- ---------------------------------------------------------------------------
-- 9. Audit trail
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['supplier_applications', 'supplier_profiles', 'order_shipments', 'supplier_payouts'] loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.record_audit()', t, t
    );
  end loop;
end;
$$;

select 'supplier marketplace ready' as status,
       (select count(*) from public.supplier_applications) as applications,
       (select count(*) from public.supplier_profiles) as suppliers,
       (select count(*) from public.products where supplier_id is null and listing_status = 'approved') as shop_products_still_listed,
       (select count(*) from public.policy_backup where dropped_at > now() - interval '1 minute') as old_rules_backed_up;
