-- 041: Account deletion
--
-- Google Play requires every app that lets people sign up to let them delete
-- their account, from inside the app and from a web page. A customer asks
-- from the More menu or /delete-account; the server records the request and
-- closes the sign-in at once; staff complete it from Admin → Account
-- Deletions, which runs complete_account_deletion() below and then removes
-- the sign-in itself through Supabase's own (soft) delete.
--
-- What goes: the person on the profile (name, phone, email, photo, city) and
-- the rows that are only about them — wishlist, contact-form messages, login
-- history, job applications.
-- What stays: orders, bookings, rentals, invoices, payments and signed
-- booking terms. GST law needs those kept, and other rows point at them; they
-- now point at a profile called "Deleted user".
--
-- Safe to run more than once.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  -- Null for a request from the web form that matched no account.
  user_id uuid references auth.users (id) on delete set null,
  source text not null check (source in ('app', 'web', 'web_form')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  -- True when it came from a signed-in session. A web-form request is only a
  -- claim until staff have confirmed it with the person.
  verified boolean not null default false,
  account_role text,
  contact_name text,
  contact_phone text,
  contact_email text,
  reason text,
  requested_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null,
  handled_note text
);

-- One open request per account.
create unique index if not exists account_deletion_one_open
  on public.account_deletion_requests (user_id)
  where status = 'pending' and user_id is not null;

create index if not exists account_deletion_status_idx
  on public.account_deletion_requests (status, requested_at);

alter table public.account_deletion_requests enable row level security;

-- Staff who look after customers see every request; a person sees their own.
-- Nobody writes through the API: the server inserts with the service role
-- after checking the session, and the functions below do the rest.
drop policy if exists account_deletion_staff_read on public.account_deletion_requests;
create policy account_deletion_staff_read on public.account_deletion_requests
  for select using (public.staff_can('customers'));

drop policy if exists account_deletion_own_read on public.account_deletion_requests;
create policy account_deletion_own_read on public.account_deletion_requests
  for select using (user_id = auth.uid());

revoke insert, update, delete on public.account_deletion_requests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- complete_account_deletion: clears the person out of the database.
-- Runs in one transaction. Checks which columns and tables exist rather than
-- assuming — the live schema has drifted from these files before.
-- ---------------------------------------------------------------------------
create or replace function public.complete_account_deletion(p_request uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.account_deletion_requests;
  v_user uuid;
  v_role text;
  v_cleared text[] := '{}';
  v_kept text[] := '{}';
  r record;
begin
  if not (public.staff_can('customers') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Only SafaKing staff can complete an account deletion.' using errcode = '42501';
  end if;

  select * into v_req from public.account_deletion_requests where id = p_request for update;
  if not found then
    raise exception 'That deletion request does not exist.' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request is already %.', v_req.status using errcode = 'P0001';
  end if;
  if v_req.user_id is null then
    raise exception 'This request is not linked to an account yet.' using errcode = 'P0001';
  end if;
  v_user := v_req.user_id;

  -- A staff account is taken out of Users & Roles first, never from here.
  select role into v_role from public.profiles where id = v_user;
  if v_role in ('admin', 'manager') then
    raise exception 'This is a staff account. Change its role in Users & Roles first.' using errcode = 'P0001';
  end if;

  -- 1. The profile row stays — orders and bookings point at it — but the
  --    person leaves it.
  for r in
    select column_name, is_nullable
      from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name in ('full_name', 'phone', 'email', 'avatar_url', 'city')
  loop
    if r.column_name = 'full_name' then
      execute 'update public.profiles set full_name = $1 where id = $2' using 'Deleted user', v_user;
    elsif r.is_nullable = 'YES' then
      execute format('update public.profiles set %I = null where id = $1', r.column_name) using v_user;
    else
      -- A NOT NULL column gets a placeholder that identifies nobody.
      execute format('update public.profiles set %I = $1 where id = $2', r.column_name)
        using 'deleted-' || left(v_user::text, 8), v_user;
    end if;
    v_cleared := v_cleared || ('profile ' || r.column_name);
  end loop;

  -- 2. Rows that are only about the person go. One that something else still
  --    points at is kept and reported rather than failing the whole deletion.
  for r in
    select t.tbl, t.col
      from (values
        ('wishlists', 'user_id'),
        ('contact_messages', 'user_id'),
        ('login_events', 'user_id'),
        ('job_applications', 'user_id')
      ) as t (tbl, col)
     where exists (
       select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.tbl and c.column_name = t.col
     )
  loop
    begin
      execute format('delete from public.%I where %I = $1', r.tbl, r.col) using v_user;
      v_cleared := v_cleared || r.tbl;
    exception when foreign_key_violation then
      v_kept := v_kept || (r.tbl || ' (still referenced)');
    end;
  end loop;

  -- The request itself held their contact details so staff could reach them;
  -- those go too. The account id and the reason stay as the record.
  update public.account_deletion_requests
     set status = 'completed', handled_at = now(), handled_by = auth.uid(), handled_note = p_note,
         contact_name = null, contact_phone = null, contact_email = null
   where id = p_request;

  return jsonb_build_object('user_id', v_user, 'cleared', v_cleared, 'kept', v_kept);
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_account_deletion: the person changed their mind, or the web-form
-- request could not be confirmed. The server re-opens the sign-in.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_account_deletion(p_request uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.account_deletion_requests;
begin
  if not (public.staff_can('customers') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Only SafaKing staff can cancel an account deletion.' using errcode = '42501';
  end if;

  select * into v_req from public.account_deletion_requests where id = p_request for update;
  if not found then
    raise exception 'That deletion request does not exist.' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request is already %.', v_req.status using errcode = 'P0001';
  end if;

  update public.account_deletion_requests
     set status = 'cancelled', handled_at = now(), handled_by = auth.uid(), handled_note = p_note
   where id = p_request;

  return v_req.user_id;
end;
$$;

revoke all on function public.complete_account_deletion(uuid, text) from public, anon;
revoke all on function public.cancel_account_deletion(uuid, text) from public, anon;
grant execute on function public.complete_account_deletion(uuid, text) to authenticated, service_role;
grant execute on function public.cancel_account_deletion(uuid, text) to authenticated, service_role;

select 'account deletion ready' as status,
       (select count(*) from public.account_deletion_requests where status = 'pending') as pending_requests;
