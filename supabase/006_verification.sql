-- ============================================================================
-- SafaKing — 006 Verification System  (spec: "1. Verification System — बहुत जरूरी")
--
-- Run AFTER 005_smart_matching.sql, in the Supabase SQL Editor. Idempotent.
--
-- Artist:   Aadhaar · Selfie · Experience · Certificate
-- Supplier: GST (optional) · Shop details · Bank account
--
-- PII HANDLING — read before changing anything here:
--   * Aadhaar numbers are NEVER stored in full. Only the last 4 digits, for the
--     admin to eyeball against the uploaded image. Storing full Aadhaar creates
--     a legal obligation (and a breach liability) this project should not carry.
--   * Bank account numbers are likewise stored as last 4 + IFSC only. When you
--     wire up artist payouts, push the full number straight to Razorpay's Fund
--     Account API and keep the token here — never the number itself.
--   * The document images live in a PRIVATE storage bucket. Only the owner and
--     an admin can read them, enforced by storage policies at the bottom.
-- ============================================================================

do $$ begin
  create type verification_state as enum ('unverified','pending','verified','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type doc_review_state as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Private bucket for identity documents
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Supplier operating profile (mirrors artist_profiles)
--
-- supplier_applications is a lead form; this is the approved, operating
-- supplier that can actually be verified and paid.
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique references public.profiles(id) on delete set null,
  application_id      uuid references public.supplier_applications(id) on delete set null,
  business_name       text not null,
  contact_name        text not null,
  phone               text not null,
  email               text,
  city                text,
  category            text,
  shop_address        text,
  gst_number          text,
  -- Payout details: last 4 only. See the PII note at the top of this file.
  bank_account_last4  text,
  bank_ifsc           text,
  bank_holder_name    text,
  verification_status verification_state not null default 'unverified',
  verified            boolean not null default false,
  active              boolean not null default true,
  rating              numeric(2,1) default 5.0,
  created_at          timestamptz not null default now(),
  constraint gst_format check (gst_number is null or length(gst_number) = 15),
  constraint bank_last4_format check (bank_account_last4 is null or bank_account_last4 ~ '^[0-9]{4}$')
);

create index if not exists supplier_profiles_city_idx on public.supplier_profiles (city);

-- ---------------------------------------------------------------------------
-- 3. Verification fields on the artist profile
-- ---------------------------------------------------------------------------
alter table public.artist_profiles add column if not exists verification_status verification_state not null default 'unverified';
alter table public.artist_profiles add column if not exists aadhaar_last4       text;
alter table public.artist_profiles add column if not exists bank_account_last4  text;
alter table public.artist_profiles add column if not exists bank_ifsc           text;
alter table public.artist_profiles add column if not exists bank_holder_name    text;

do $$ begin
  alter table public.artist_profiles
    add constraint artist_aadhaar_last4_format
    check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 4. The documents themselves
-- ---------------------------------------------------------------------------
create table if not exists public.verification_documents (
  id             uuid primary key default gen_random_uuid(),
  -- Who this document belongs to. owner_id is always a profiles.id so RLS can
  -- be written once for both artists and suppliers.
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  subject_type   text not null check (subject_type in ('artist','supplier')),
  doc_type       text not null check (doc_type in (
                   'aadhaar_front','aadhaar_back','selfie','certificate','experience_proof',
                   'gst_certificate','shop_photo','bank_proof','pan'
                 )),
  -- Path inside the private verification-docs bucket.
  storage_path   text not null,
  original_name  text,
  -- Only ever the last 4 digits of an Aadhaar / account number.
  reference_last4 text,
  status         doc_review_state not null default 'pending',
  rejection_reason text,
  reviewed_by    uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint ref_last4_format check (reference_last4 is null or reference_last4 ~ '^[0-9]{4}$')
);

create index if not exists verification_docs_owner_idx  on public.verification_documents (owner_id);
create index if not exists verification_docs_status_idx on public.verification_documents (status);
create unique index if not exists verification_docs_one_live_per_type
  on public.verification_documents (owner_id, doc_type)
  where status <> 'rejected';

-- ---------------------------------------------------------------------------
-- 5. Which documents each role must supply
-- ---------------------------------------------------------------------------
create or replace function public.required_docs(p_subject_type text)
returns text[]
language sql
immutable
as $$
  select case p_subject_type
    -- GST is optional per the spec ("GST (यदि हो)"), so it is not required here.
    when 'artist'   then array['aadhaar_front','selfie','certificate']
    when 'supplier' then array['shop_photo','bank_proof']
    else array[]::text[]
  end;
$$;

/**
 * Recomputes an owner's overall verification state from their documents, and
 * mirrors it onto the artist/supplier profile.
 *
 * unverified — nothing uploaded
 * pending    — uploaded, awaiting review
 * rejected   — at least one required document was rejected
 * verified   — every required document approved
 */
create or replace function public.refresh_verification_status(p_owner_id uuid)
returns verification_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type    text;
  v_required text[];
  v_approved int;
  v_rejected int;
  v_total    int;
  v_state    verification_state;
begin
  select subject_type into v_type
  from public.verification_documents
  where owner_id = p_owner_id
  order by created_at desc
  limit 1;

  if v_type is null then
    return 'unverified';
  end if;

  v_required := public.required_docs(v_type);

  select count(*) into v_total
  from public.verification_documents
  where owner_id = p_owner_id;

  select count(*) into v_approved
  from public.verification_documents
  where owner_id = p_owner_id and status = 'approved' and doc_type = any (v_required);

  select count(*) into v_rejected
  from public.verification_documents
  where owner_id = p_owner_id and status = 'rejected' and doc_type = any (v_required);

  if v_total = 0 then
    v_state := 'unverified';
  elsif v_approved >= array_length(v_required, 1) then
    v_state := 'verified';
  elsif v_rejected > 0 then
    v_state := 'rejected';
  else
    v_state := 'pending';
  end if;

  if v_type = 'artist' then
    update public.artist_profiles
    set verification_status = v_state,
        verified = (v_state = 'verified')
    where id = p_owner_id;
  else
    update public.supplier_profiles
    set verification_status = v_state,
        verified = (v_state = 'verified')
    where user_id = p_owner_id;
  end if;

  return v_state;
end;
$$;

create or replace function public.on_verification_doc_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_verification_status(coalesce(new.owner_id, old.owner_id));
  return coalesce(new, old);
end; $$;

drop trigger if exists verification_docs_refresh on public.verification_documents;
create trigger verification_docs_refresh
  after insert or update or delete on public.verification_documents
  for each row execute function public.on_verification_doc_change();

-- Only an admin may review. An owner uploading their own document must not be
-- able to set it to 'approved'.
create or replace function public.guard_doc_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an administrator can review a verification document';
  end if;

  if new.status is distinct from old.status and public.is_admin() then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;

  return new;
end; $$;

drop trigger if exists verification_docs_guard_review on public.verification_documents;
create trigger verification_docs_guard_review
  before update on public.verification_documents
  for each row execute function public.guard_doc_review();

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.verification_documents enable row level security;
alter table public.supplier_profiles      enable row level security;

drop policy if exists verification_docs_select on public.verification_documents;
create policy verification_docs_select on public.verification_documents
  for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists verification_docs_insert on public.verification_documents;
create policy verification_docs_insert on public.verification_documents
  for insert with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists verification_docs_update on public.verification_documents;
create policy verification_docs_update on public.verification_documents
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists verification_docs_delete on public.verification_documents;
create policy verification_docs_delete on public.verification_documents
  for delete using (owner_id = auth.uid() or public.is_admin());

-- Suppliers: a verified supplier is public information (customers should see
-- who is vetted); bank details are not, so they are excluded from the public
-- read path by only exposing this table to the owner and admins.
drop policy if exists supplier_profiles_select on public.supplier_profiles;
create policy supplier_profiles_select on public.supplier_profiles
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists supplier_profiles_write on public.supplier_profiles;
create policy supplier_profiles_write on public.supplier_profiles
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Storage policies — private documents
--
-- Files are stored as: <owner_id>/<doc_type>-<timestamp>.<ext>
-- so the first path segment is the owner and can be checked directly.
-- ---------------------------------------------------------------------------
drop policy if exists verification_docs_read on storage.objects;
create policy verification_docs_read on storage.objects
  for select using (
    bucket_id = 'verification-docs'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists verification_docs_upload on storage.objects;
create policy verification_docs_upload on storage.objects
  for insert with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists verification_docs_replace on storage.objects;
create policy verification_docs_replace on storage.objects
  for update using (
    bucket_id = 'verification-docs'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists verification_docs_remove on storage.objects;
create policy verification_docs_remove on storage.objects
  for delete using (
    bucket_id = 'verification-docs'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- 8. Verification
-- ---------------------------------------------------------------------------
select 'artist required docs' as label, public.required_docs('artist') as docs
union all
select 'supplier required docs', public.required_docs('supplier');

select id, name, public from storage.buckets where id = 'verification-docs';
