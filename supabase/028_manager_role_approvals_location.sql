-- 028_manager_role_approvals_location.sql
--
-- Four related changes:
--   1. Every assignment now needs an admin's sign-off, and who assigned is
--      recorded — an artist accepting an offer is not the final word.
--   2. The customer can pin their exact location so the artist reaches the
--      right gate, not just the right pincode.
--   3. A 'manager' role that can run daily operations but cannot change
--      roles, pricing, or approve its own assignments.
--   4. is_staff() — admin OR manager — for the policies below.

-- ---------------------------------------------------------------------------
-- 1. Assignment approval + who did it
-- ---------------------------------------------------------------------------
alter table public.artist_bookings
  add column if not exists assigned_by            uuid references auth.users (id) on delete set null,
  add column if not exists assignment_approved_at timestamptz,
  add column if not exists assignment_approved_by uuid references auth.users (id) on delete set null;

alter table public.rental_bookings
  add column if not exists assigned_by            uuid references auth.users (id) on delete set null,
  add column if not exists assignment_approved_at timestamptz,
  add column if not exists assignment_approved_by uuid references auth.users (id) on delete set null;

-- Bookings that already have an artist predate this rule; treat them as
-- approved so nothing that is already running shows up as pending.
update public.artist_bookings
   set assignment_approved_at = coalesce(assignment_approved_at, now())
 where artist_id is not null and assignment_approved_at is null;

update public.rental_bookings
   set assignment_approved_at = coalesce(assignment_approved_at, now())
 where artist_id is not null and assignment_approved_at is null;

-- Changing the artist re-opens the approval: a swap is a new decision.
create or replace function public.reset_approval_on_artist_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.artist_id is distinct from old.artist_id then
    if new.assignment_approved_at is not distinct from old.assignment_approved_at then
      new.assignment_approved_at := null;
      new.assignment_approved_by := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists artist_bookings_reset_approval on public.artist_bookings;
create trigger artist_bookings_reset_approval
  before update on public.artist_bookings
  for each row execute function public.reset_approval_on_artist_change();

drop trigger if exists rental_bookings_reset_approval on public.rental_bookings;
create trigger rental_bookings_reset_approval
  before update on public.rental_bookings
  for each row execute function public.reset_approval_on_artist_change();

-- ---------------------------------------------------------------------------
-- 2. Exact customer location
-- ---------------------------------------------------------------------------
alter table public.artist_bookings
  add column if not exists customer_lat  numeric,
  add column if not exists customer_lng  numeric,
  add column if not exists location_note text;

alter table public.rental_bookings
  add column if not exists customer_lat  numeric,
  add column if not exists customer_lng  numeric,
  add column if not exists location_note text;

-- ---------------------------------------------------------------------------
-- 3 + 4. Manager role
-- ---------------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text from public.profiles where id = auth.uid()) = 'manager', false);
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_manager();
$$;

grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- Managers run the day: bookings, rentals, orders, dispatch. Policies are
-- permissive, so these sit alongside the existing admin ones rather than
-- replacing them.
do $$
declare
  t text;
begin
  foreach t in array array['artist_bookings', 'rental_bookings', 'orders'] loop
    execute format('drop policy if exists %I_manager_all on public.%I', t, t);
    execute format(
      'create policy %I_manager_all on public.%I for all using (public.is_manager()) with check (public.is_manager())',
      t, t
    );
  end loop;

  -- Read-only for a manager: they need to see who is available and what was
  -- spent, but roster flags, roles, pricing and money out stay with the admin.
  foreach t in array array['artist_profiles', 'artist_applications', 'profiles', 'expenses', 'app_settings'] loop
    execute format('drop policy if exists %I_manager_read on public.%I', t, t);
    execute format('create policy %I_manager_read on public.%I for select using (public.is_manager())', t, t);
  end loop;
end;
$$;

-- A manager must never approve their own assignment, and must never hand out
-- a role. Enforced here rather than only in the UI.
create or replace function public.guard_manager_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignment_approved_at is distinct from old.assignment_approved_at
     and new.assignment_approved_at is not null
     and not public.is_admin() then
    raise exception 'Only an admin can approve an artist assignment.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists artist_bookings_approval_guard on public.artist_bookings;
create trigger artist_bookings_approval_guard
  before update on public.artist_bookings
  for each row execute function public.guard_manager_approval();

drop trigger if exists rental_bookings_approval_guard on public.rental_bookings;
create trigger rental_bookings_approval_guard
  before update on public.rental_bookings
  for each row execute function public.guard_manager_approval();

-- ---------------------------------------------------------------------------
-- 5. Complaints — a conversation, not a flag
-- ---------------------------------------------------------------------------
create table if not exists public.complaints (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid references public.artist_bookings (id) on delete set null,
  rental_id       uuid references public.rental_bookings (id) on delete set null,
  artist_id       uuid references public.profiles (id) on delete set null,
  customer_id     uuid references public.profiles (id) on delete set null,
  customer_name   text not null,
  customer_phone  text,
  subject         text not null,
  description     text not null,
  severity        text not null default 'normal',
  status          text not null default 'open',
  -- Set when a manager cannot settle it and hands it up.
  escalated_at    timestamptz,
  escalated_by    uuid references auth.users (id) on delete set null,
  escalation_note text,
  resolution      text,
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.complaints drop constraint if exists complaints_status_check;
alter table public.complaints add constraint complaints_status_check check (status in (
  'open', 'awaiting_artist', 'awaiting_customer', 'escalated', 'resolved', 'dismissed'
));

alter table public.complaints drop constraint if exists complaints_severity_check;
alter table public.complaints add constraint complaints_severity_check check (severity in ('low', 'normal', 'high'));

create index if not exists complaints_artist_idx on public.complaints (artist_id);
create index if not exists complaints_status_idx on public.complaints (status);

-- Every reply, from whoever wrote it. `internal` messages are staff-only
-- notes — the customer and the artist never see them.
create table if not exists public.complaint_messages (
  id           uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  author_id    uuid references auth.users (id) on delete set null,
  author_role  text not null,
  author_name  text,
  body         text not null,
  internal     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists complaint_messages_complaint_idx
  on public.complaint_messages (complaint_id, created_at);

alter table public.complaints enable row level security;
alter table public.complaint_messages enable row level security;

-- Customer: sees and raises their own. Artist: sees the ones about them, so
-- they can answer — which is the point of asking them for a reply.
drop policy if exists complaints_customer_read on public.complaints;
create policy complaints_customer_read on public.complaints
  for select using (customer_id = auth.uid() or artist_id = auth.uid() or public.is_staff());

drop policy if exists complaints_customer_insert on public.complaints;
create policy complaints_customer_insert on public.complaints
  for insert with check (customer_id = auth.uid() or public.is_staff());

drop policy if exists complaints_staff_write on public.complaints;
create policy complaints_staff_write on public.complaints
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists complaint_messages_read on public.complaint_messages;
create policy complaint_messages_read on public.complaint_messages
  for select using (
    public.is_staff()
    or (
      not internal
      and exists (
        select 1 from public.complaints c
         where c.id = complaint_id
           and (c.customer_id = auth.uid() or c.artist_id = auth.uid())
      )
    )
  );

drop policy if exists complaint_messages_write on public.complaint_messages;
create policy complaint_messages_write on public.complaint_messages
  for insert with check (
    public.is_staff()
    or (
      not internal
      and exists (
        select 1 from public.complaints c
         where c.id = complaint_id
           and (c.customer_id = auth.uid() or c.artist_id = auth.uid())
      )
    )
  );

-- Only an admin closes an escalated complaint: escalation exists precisely
-- because the manager could not settle it.
create or replace function public.guard_complaint_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('resolved', 'dismissed')
     and old.status = 'escalated'
     and not public.is_admin() then
    raise exception 'This complaint was escalated — only an admin can close it.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists complaints_resolution_guard on public.complaints;
create trigger complaints_resolution_guard
  before update on public.complaints
  for each row execute function public.guard_complaint_resolution();

select 'manager role, approvals, location and complaints ready' as status;
