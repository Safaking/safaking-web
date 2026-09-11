-- 037_departments_and_staff_security.sql
--
-- Phase 3 of the owner's operating rules: employee access control and data
-- security.
--
--   1. Departments. A manager now belongs to one: Customer Support
--      (customers + bookings), Artist Manager (artists + bookings), Finance
--      (payments + finance), or Operations (the manager role as it was).
--      The admin is the Owner, with full access. staff_can() is the one
--      permission matrix; src/lib/departments.ts mirrors it for the panel.
--   2. The database enforces it where it matters: payments and expenses are
--      Finance's, identity documents are the Artist Manager's, and each step
--      of a refund needs the right department on top of maker-checker.
--   3. Two-step verification. When the owner switches it on, admin and
--      manager rights only exist in a session that entered its code (aal2).
--      The owner cannot switch it on without having set it up themselves.
--   4. Login history, device list, sign-out of a device or of everyone, and
--      the date each password was last changed.
--   5. The audit trail now also covers payments, prices and KYC documents.
--
-- Locked out? In the Supabase SQL editor:
--   update public.security_settings set staff_2fa_required = false;

-- ---------------------------------------------------------------------------
-- 1. Departments
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists department          text,
  add column if not exists password_changed_at timestamptz,
  add column if not exists security_ack_at     timestamptz;

alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles add constraint profiles_department_check
  check (department is null or department in ('operations', 'support', 'artist_ops', 'finance'));

-- Existing managers keep exactly what they had.
update public.profiles set department = 'operations'
 where role::text = 'manager' and department is null;

-- ---------------------------------------------------------------------------
-- 2. Security settings — one row
-- ---------------------------------------------------------------------------
create table if not exists public.security_settings (
  id                 boolean primary key default true check (id),
  staff_2fa_required boolean not null default false,
  updated_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now()
);

insert into public.security_settings (id) values (true) on conflict (id) do nothing;

alter table public.security_settings enable row level security;

drop policy if exists security_settings_read on public.security_settings;
create policy security_settings_read on public.security_settings
  for select using (auth.uid() is not null);
-- No write policy: it changes only through set_staff_2fa_required().

-- ---------------------------------------------------------------------------
-- 3. Staff rights, now conditional on two-step verification when required
-- ---------------------------------------------------------------------------
create or replace function public.staff_mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not coalesce((select staff_2fa_required from public.security_settings where id), false)
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text from public.profiles where id = auth.uid()) = 'admin', false)
     and public.staff_mfa_satisfied();
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text from public.profiles where id = auth.uid()) = 'manager', false)
     and public.staff_mfa_satisfied();
$$;

create or replace function public.staff_department()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when not public.staff_mfa_satisfied() then null
           when p.role::text = 'admin' then 'owner'
           when p.role::text = 'manager' then coalesce(p.department, 'operations')
         end
    from public.profiles p
   where p.id = auth.uid();
$$;

-- The permission matrix. Keep src/lib/departments.ts in step with this.
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
        'expenses_read', 'refund_verify', 'refund_approve', 'refund_send', 'refund_exception'])
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

grant execute on function public.staff_mfa_satisfied() to authenticated;
grant execute on function public.staff_department() to authenticated;
grant execute on function public.staff_can(text) to authenticated;

create or replace function public.set_staff_2fa_required(p_required boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the owner can change this.' using errcode = 'P0001';
  end if;
  if p_required and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Turn on two-step verification for your own account and sign in with your code first, so you cannot lock yourself out.'
      using errcode = 'P0001';
  end if;
  update public.security_settings
     set staff_2fa_required = p_required, updated_by = auth.uid(), updated_at = now()
   where id;
  insert into public.login_events (user_id, event)
  values (auth.uid(), case when p_required then '2fa_required_on' else '2fa_required_off' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Who may change a role or a department
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    -- Approving an artist turns a customer account into an artist account;
    -- the Artist Manager may do that one change and nothing else.
    if new.role is distinct from old.role
       and not (old.role::text = 'customer' and new.role::text = 'artist' and public.staff_can('artists')) then
      raise exception 'Only an administrator can change a user role';
    end if;
    if new.department is distinct from old.department then
      raise exception 'Only the owner can change a department.' using errcode = 'P0001';
    end if;
    if new.password_changed_at is distinct from old.password_changed_at
       and coalesce(current_setting('safaking.stamping_password', true), '') <> 'on' then
      new.password_changed_at := old.password_changed_at;
    end if;
  end if;

  if new.role::text <> 'manager' then
    new.department := null;
  elsif new.department is null then
    new.department := 'operations';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

create or replace function public.grant_artist_role(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.staff_can('artists') then
    raise exception 'Only the owner or the Artist Manager can approve artists.' using errcode = 'P0001';
  end if;
  select role::text into v_role from public.profiles where id = p_user;
  if v_role is null then
    raise exception 'That account does not exist.' using errcode = 'P0001';
  elsif v_role = 'artist' then
    return;
  elsif v_role <> 'customer' then
    raise exception 'Only a customer account can be made an artist.' using errcode = 'P0001';
  end if;
  update public.profiles set role = 'artist' where id = p_user;
end;
$$;

grant execute on function public.grant_artist_role(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Department boundaries on the data
-- ---------------------------------------------------------------------------
-- Artists: the Artist Manager runs the roster and the applications.
drop policy if exists artist_profiles_artist_ops on public.artist_profiles;
create policy artist_profiles_artist_ops on public.artist_profiles
  for all using (public.staff_can('artists')) with check (public.staff_can('artists'));

drop policy if exists artist_applications_artist_ops on public.artist_applications;
create policy artist_applications_artist_ops on public.artist_applications
  for all using (public.staff_can('artists')) with check (public.staff_can('artists'));

-- Identity documents: the Artist Manager and the owner, nobody else on staff.
drop policy if exists verification_docs_kyc_read on public.verification_documents;
create policy verification_docs_kyc_read on public.verification_documents
  for select using (public.staff_can('kyc'));

drop policy if exists verification_docs_kyc_update on public.verification_documents;
create policy verification_docs_kyc_update on public.verification_documents
  for update using (public.staff_can('kyc')) with check (public.staff_can('kyc'));

drop policy if exists verification_docs_kyc_staff_read on storage.objects;
create policy verification_docs_kyc_staff_read on storage.objects
  for select using (bucket_id = 'verification-docs' and public.staff_can('kyc'));

-- Money: Finance. Operations keeps the read access it already had.
drop policy if exists payments_finance_read on public.payments;
create policy payments_finance_read on public.payments
  for select using (public.staff_can('finance'));

drop policy if exists expenses_manager_read on public.expenses;
drop policy if exists expenses_staff_read on public.expenses;
create policy expenses_staff_read on public.expenses
  for select using (public.staff_can('expenses_read'));

drop policy if exists expenses_finance_write on public.expenses;
create policy expenses_finance_write on public.expenses
  for all using (public.staff_can('expenses')) with check (public.staff_can('expenses'));

-- Refunds: maker-checker (035) still decides WHO; this decides WHICH TEAM.
create or replace function public.guard_cancellation_department()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;  -- the refund route checks departments itself
  end if;

  if new.verified_by is distinct from old.verified_by and new.verified_by is not null
     and not public.staff_can('refund_verify') then
    raise exception 'Your department cannot verify refunds.' using errcode = 'P0001';
  end if;
  if new.reviewed_by is distinct from old.reviewed_by and new.reviewed_by is not null
     and not public.staff_can('refund_approve') then
    raise exception 'Your department cannot approve or refuse refunds.' using errcode = 'P0001';
  end if;
  if (new.processed_by is distinct from old.processed_by and new.processed_by is not null
      or new.reconciled_by is distinct from old.reconciled_by and new.reconciled_by is not null)
     and not public.staff_can('refund_send') then
    raise exception 'Your department cannot send or reconcile refunds.' using errcode = 'P0001';
  end if;
  if new.exception_requested_by is distinct from old.exception_requested_by and new.exception_requested_by is not null
     and not public.staff_can('refund_verify') then
    raise exception 'Your department cannot propose a refund exception.' using errcode = 'P0001';
  end if;
  if new.exception_approved_by is distinct from old.exception_approved_by and new.exception_approved_by is not null
     and not public.staff_can('refund_exception') then
    raise exception 'Only an operations manager or the owner can decide a refund exception.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists cancellations_department_guard on public.cancellations;
create trigger cancellations_department_guard
  before update on public.cancellations
  for each row execute function public.guard_cancellation_department();

-- Standing (036), now for the teams that manage artists.
create or replace function public.guard_artist_standing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client boolean := coalesce(auth.role(), '') <> 'service_role';
begin
  if v_client and not public.staff_can('standing') and (
       new.standing         is distinct from old.standing
    or new.restricted_until is distinct from old.restricted_until
    or new.standing_note    is distinct from old.standing_note
    or new.standing_set_by  is distinct from old.standing_set_by
    or new.standing_set_at  is distinct from old.standing_set_at
  ) then
    raise exception 'Only the owner, operations or the Artist Manager can change an artist''s standing.' using errcode = 'P0001';
  end if;

  if new.standing is distinct from old.standing or new.restricted_until is distinct from old.restricted_until then
    if new.standing = 'suspended' and old.standing is distinct from 'suspended'
       and v_client and not public.is_admin() then
      raise exception 'Only the owner can suspend an artist.' using errcode = 'P0001';
    end if;
    if coalesce(btrim(new.standing_note), '') = '' or new.standing_note is not distinct from old.standing_note then
      raise exception 'Record why the standing is changing.' using errcode = 'P0001';
    end if;
    if new.standing = 'restricted' and new.restricted_until is null then
      raise exception 'A temporary restriction needs an end date.' using errcode = 'P0001';
    end if;
    if new.standing <> 'restricted' then
      new.restricted_until := null;
    end if;
    if v_client then
      new.standing_set_by := auth.uid();
    end if;
    new.standing_set_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Login history
-- ---------------------------------------------------------------------------
create table if not exists public.login_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  email      text,
  event      text not null,
  ip         text,
  user_agent text,
  city       text,
  country    text,
  session_id uuid,
  aal        text,
  detail     text,
  created_at timestamptz not null default now()
);

alter table public.login_events drop constraint if exists login_events_event_check;
alter table public.login_events add constraint login_events_event_check check (event in (
  'sign_in', 'sign_out', 'mfa_verified', 'failed_password', 'failed_mfa', 'mfa_enrolled', 'mfa_removed',
  'password_changed', 'session_revoked', 'forced_sign_out', '2fa_required_on', '2fa_required_off'
));

create index if not exists login_events_user_idx on public.login_events (user_id, created_at desc);
create index if not exists login_events_time_idx on public.login_events (created_at desc);

alter table public.login_events enable row level security;

-- Everyone sees their own; the owner sees all. Rows are written by the
-- server and by the functions below, never by a browser.
drop policy if exists login_events_read on public.login_events;
create policy login_events_read on public.login_events
  for select using (user_id = auth.uid() or public.is_admin());

-- A password change is stamped by the auth system itself, so it cannot be
-- claimed without actually happening.
create or replace function public.stamp_password_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    perform set_config('safaking.stamping_password', 'on', true);
    update public.profiles set password_changed_at = now() where id = new.id;
    perform set_config('safaking.stamping_password', 'off', true);
    insert into public.login_events (user_id, event)
    select new.id, 'password_changed' where exists (select 1 from public.profiles where id = new.id);
  end if;
  return new;
exception when others then
  -- Never block a password change over bookkeeping.
  return new;
end;
$$;

drop trigger if exists on_auth_user_password_changed on auth.users;
create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row execute function public.stamp_password_change();

-- ---------------------------------------------------------------------------
-- 7. Devices and sessions
-- ---------------------------------------------------------------------------
create or replace function public.my_sessions()
returns table (
  id uuid, created_at timestamptz, last_active_at timestamptz,
  user_agent text, ip text, aal text, is_current boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select s.id, s.created_at, coalesce(s.refreshed_at::timestamptz, s.updated_at),
           s.user_agent, host(s.ip), s.aal::text,
           s.id::text = coalesce(auth.jwt() ->> 'session_id', '')
      from auth.sessions s
     where s.user_id = auth.uid()
       and (s.not_after is null or s.not_after > now())
     order by 3 desc nulls last;
end;
$$;

create or replace function public.revoke_my_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.sessions where id = p_session and user_id = auth.uid();
  if found then
    insert into public.login_events (user_id, event, session_id) values (auth.uid(), 'session_revoked', p_session);
  end if;
end;
$$;

-- Lets the server refuse a request from a device that was signed out, even
-- while its access token has not yet expired.
create or replace function public.session_is_active()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sid text := auth.jwt() ->> 'session_id';
begin
  if auth.uid() is null or v_sid is null then
    return null;
  end if;
  return exists (select 1 from auth.sessions where id = v_sid::uuid and user_id = auth.uid());
end;
$$;

create or replace function public.staff_security_overview()
returns table (
  user_id uuid, full_name text, email text, role text, department text,
  has_2fa boolean, active_sessions integer, devices_24h integer,
  last_sign_in_at timestamptz, password_changed_at timestamptz, security_ack_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the owner can see this.' using errcode = 'P0001';
  end if;
  return query
    select p.id, p.full_name, p.email, p.role::text, p.department,
           exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status::text = 'verified'),
           (select count(*)::integer from auth.sessions s
             where s.user_id = p.id and (s.not_after is null or s.not_after > now())),
           (select count(distinct coalesce(s.user_agent, '') || coalesce(host(s.ip), ''))::integer from auth.sessions s
             where s.user_id = p.id and coalesce(s.refreshed_at::timestamptz, s.updated_at) > now() - interval '24 hours'),
           u.last_sign_in_at, p.password_changed_at, p.security_ack_at
      from public.profiles p
      left join auth.users u on u.id = p.id
     where p.role::text in ('admin', 'manager')
     order by p.role::text, p.full_name;
end;
$$;

create or replace function public.revoke_user_sessions(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only the owner can sign someone out.' using errcode = 'P0001';
  end if;
  delete from auth.sessions where user_id = p_user;
  get diagnostics v_count = row_count;
  insert into public.login_events (user_id, event, detail)
  values (p_user, 'forced_sign_out', 'by ' || auth.uid()::text);
  return v_count;
end;
$$;

grant execute on function public.set_staff_2fa_required(boolean) to authenticated;
grant execute on function public.my_sessions() to authenticated;
grant execute on function public.revoke_my_session(uuid) to authenticated;
grant execute on function public.session_is_active() to authenticated;
grant execute on function public.staff_security_overview() to authenticated;
grant execute on function public.revoke_user_sessions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Audit: prices, payments and identity documents too
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['payments', 'products', 'verification_documents'] loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.record_audit()', t, t
    );
  end loop;
end;
$$;

select 'departments, 2FA and login history ready' as status,
       (select count(*) from public.profiles where role::text = 'manager') as managers,
       (select staff_2fa_required from public.security_settings) as staff_2fa_required;
