-- 036_complaint_tickets_and_artist_standing.sql
--
-- Phase 2 of the owner's operating rules.
--
--   1. Every complaint is a ticket: an ID a customer can quote on the phone,
--      a priority the system sets (P1 critical .. P4 low) and an SLA clock.
--      A customer never picks their own priority; staff may change it, with
--      a reason, and the SLA moves with it.
--   2. Artist incidents — pulling out after accepting, not turning up,
--      arriving late — are recorded with who reported them, the backup
--      artists found, and whether operations and the customer were told.
--   3. Standing: warning -> temporary restriction -> performance review ->
--      suspension. The system RECOMMENDS a level from points in the last 90
--      days; a person applies it, with a note. Suspension is owner-only.
--      Restriction, review and suspension genuinely block new work.

-- ---------------------------------------------------------------------------
-- 1. Complaint tickets
-- ---------------------------------------------------------------------------
create sequence if not exists public.complaint_ticket_seq;

alter table public.complaints add column if not exists ticket_no bigint;

do $$
declare
  v_max bigint;
begin
  select coalesce(max(ticket_no), 0) into v_max from public.complaints;

  with numbered as (
    select id, v_max + row_number() over (order by created_at, id) as n
      from public.complaints
     where ticket_no is null
  )
  update public.complaints c set ticket_no = numbered.n
    from numbered where c.id = numbered.id;

  if exists (select 1 from public.complaints) then
    perform setval('public.complaint_ticket_seq', (select max(ticket_no) from public.complaints), true);
  end if;
end;
$$;

alter table public.complaints alter column ticket_no set default nextval('public.complaint_ticket_seq');
alter table public.complaints alter column ticket_no set not null;
create unique index if not exists complaints_ticket_no_key on public.complaints (ticket_no);

alter table public.complaints
  add column if not exists ticket_id text generated always as ('SK-' || lpad(ticket_no::text, 5, '0')) stored;

create or replace function public.complaint_sla(p_priority text)
returns interval
language sql
immutable
as $$
  select case p_priority
    when 'P1' then interval '2 hours'
    when 'P2' then interval '8 hours'
    when 'P3' then interval '48 hours'
    else interval '7 days'
  end;
$$;

alter table public.complaints
  add column if not exists priority        text,
  add column if not exists category        text,
  add column if not exists sla_due_at      timestamptz,
  add column if not exists priority_reason text;

-- Existing complaints keep the weight they already had.
update public.complaints
   set priority = case severity when 'high' then 'P2' when 'low' then 'P4' else 'P3' end
 where priority is null;
update public.complaints set category = 'other' where category is null;
update public.complaints set sla_due_at = created_at + public.complaint_sla(priority) where sla_due_at is null;

alter table public.complaints alter column priority set default 'P3';
alter table public.complaints alter column priority set not null;
alter table public.complaints alter column category set default 'other';
alter table public.complaints alter column category set not null;

alter table public.complaints drop constraint if exists complaints_priority_check;
alter table public.complaints add constraint complaints_priority_check
  check (priority in ('P1', 'P2', 'P3', 'P4'));

alter table public.complaints drop constraint if exists complaints_category_check;
alter table public.complaints add constraint complaints_category_check
  check (category in (
    'artist_no_show', 'event_failure', 'artist_late', 'payment', 'replacement',
    'quality', 'behaviour', 'product', 'suggestion', 'other'
  ));

create index if not exists complaints_priority_idx on public.complaints (priority, sla_due_at);

-- P1  artist did not come / the event is failing / artist late while it runs
-- P2  payment or replacement trouble, or anything within 72h of the event
-- P3  everything else
-- P4  suggestions
create or replace function public.triage_complaint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff boolean := coalesce(auth.role(), '') = 'service_role' or public.is_staff();
  v_event timestamptz;
  v_hours numeric;
begin
  if tg_op = 'INSERT' then
    if new.booking_id is not null then
      select public.event_starts_at(event_date, coalesce(nullif(booking_start_time, ''), nullif(event_time, '')))
        into v_event from public.artist_bookings where id = new.booking_id;
    elsif new.rental_id is not null then
      select public.event_starts_at(start_date, null) into v_event
        from public.rental_bookings where id = new.rental_id;
    end if;

    v_hours := case when v_event is null then null
                    else extract(epoch from (v_event - now())) / 3600.0 end;

    new.priority := case
      when new.category in ('artist_no_show', 'event_failure') then 'P1'
      when new.category = 'artist_late' and v_hours is not null and v_hours between -12 and 2 then 'P1'
      when new.category = 'suggestion' then 'P4'
      when new.category in ('payment', 'replacement', 'artist_late') then 'P2'
      when v_hours is not null and v_hours between -24 and 72 then 'P2'
      else 'P3'
    end;
    new.priority_reason := 'Set automatically from the category and how close the event is';
    new.sla_due_at := coalesce(new.created_at, now()) + public.complaint_sla(new.priority);
    return new;
  end if;

  if new.priority is distinct from old.priority then
    if not v_staff then
      raise exception 'Only SafaKing staff can change a complaint''s priority.' using errcode = 'P0001';
    end if;
    if coalesce(btrim(new.priority_reason), '') = '' or new.priority_reason is not distinct from old.priority_reason then
      raise exception 'Record why the priority is changing.' using errcode = 'P0001';
    end if;
    new.sla_due_at := old.created_at + public.complaint_sla(new.priority);
  end if;

  if new.ticket_no is distinct from old.ticket_no then
    raise exception 'A ticket number cannot be changed.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists complaints_triage on public.complaints;
create trigger complaints_triage
  before insert or update on public.complaints
  for each row execute function public.triage_complaint();

-- ---------------------------------------------------------------------------
-- 2. Artist incidents
-- ---------------------------------------------------------------------------
create table if not exists public.artist_incidents (
  id                    uuid primary key default gen_random_uuid(),
  artist_id             uuid not null references public.profiles (id) on delete cascade,
  booking_id            uuid references public.artist_bookings (id) on delete set null,
  rental_id             uuid references public.rental_bookings (id) on delete set null,
  kind                  text not null,
  reason                text not null,
  points                integer not null default 1,
  reported_by           uuid references public.profiles (id) on delete set null,
  reported_role         text,
  backup_candidates     jsonb,
  ops_notified_at       timestamptz,
  customer_notified_at  timestamptz,
  replacement_artist_id uuid references public.profiles (id) on delete set null,
  resolved_at           timestamptz,
  resolved_by           uuid references public.profiles (id) on delete set null,
  resolution_note       text,
  created_at            timestamptz not null default now()
);

alter table public.artist_incidents drop constraint if exists artist_incidents_kind_check;
alter table public.artist_incidents add constraint artist_incidents_kind_check
  check (kind in ('withdrew_after_accept', 'no_show', 'late_arrival', 'complaint_upheld'));

create index if not exists artist_incidents_artist_idx on public.artist_incidents (artist_id, created_at desc);
create index if not exists artist_incidents_open_idx on public.artist_incidents (resolved_at) where resolved_at is null;

-- Weights live here so nobody can hand an incident a lighter score.
create or replace function public.score_artist_incident()
returns trigger
language plpgsql
as $$
begin
  new.points := case new.kind
    when 'no_show' then 3
    when 'withdrew_after_accept' then 2
    when 'complaint_upheld' then 2
    else 1
  end;
  return new;
end;
$$;

drop trigger if exists artist_incidents_score on public.artist_incidents;
create trigger artist_incidents_score
  before insert or update of kind, points on public.artist_incidents
  for each row execute function public.score_artist_incident();

alter table public.artist_incidents enable row level security;

drop policy if exists artist_incidents_staff on public.artist_incidents;
create policy artist_incidents_staff on public.artist_incidents
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists artist_incidents_own on public.artist_incidents;
create policy artist_incidents_own on public.artist_incidents
  for select using (artist_id = auth.uid());

drop trigger if exists artist_incidents_audit on public.artist_incidents;
create trigger artist_incidents_audit
  after insert or update or delete on public.artist_incidents
  for each row execute function public.record_audit();

-- ---------------------------------------------------------------------------
-- 3. Standing
-- ---------------------------------------------------------------------------
alter table public.artist_profiles
  add column if not exists standing         text not null default 'good',
  add column if not exists restricted_until timestamptz,
  add column if not exists standing_note    text,
  add column if not exists standing_set_by  uuid references public.profiles (id) on delete set null,
  add column if not exists standing_set_at  timestamptz;

alter table public.artist_profiles drop constraint if exists artist_profiles_standing_check;
alter table public.artist_profiles add constraint artist_profiles_standing_check
  check (standing in ('good', 'warning', 'restricted', 'under_review', 'suspended'));

create or replace function public.artist_standing_recommendation(p_artist_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_count  integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_staff()
     and auth.uid() is distinct from p_artist_id then
    raise exception 'Not allowed.' using errcode = 'P0001';
  end if;

  select coalesce(sum(points), 0), count(*) into v_points, v_count
    from public.artist_incidents
   where artist_id = p_artist_id and created_at > now() - interval '90 days';

  return jsonb_build_object(
    'points', v_points,
    'incidents', v_count,
    'window_days', 90,
    'recommended', case
      when v_points >= 7 then 'suspended'
      when v_points >= 5 then 'under_review'
      when v_points >= 3 then 'restricted'
      when v_points >= 1 then 'warning'
      else 'good'
    end
  );
end;
$$;

grant execute on function public.artist_standing_recommendation(uuid) to authenticated;

create or replace function public.guard_artist_standing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client boolean := coalesce(auth.role(), '') <> 'service_role';
begin
  -- Artists can edit their own profile row, so every standing column is
  -- guarded, not just the level: otherwise the reason could be rewritten.
  if v_client and not public.is_staff() and (
       new.standing         is distinct from old.standing
    or new.restricted_until is distinct from old.restricted_until
    or new.standing_note    is distinct from old.standing_note
    or new.standing_set_by  is distinct from old.standing_set_by
    or new.standing_set_at  is distinct from old.standing_set_at
  ) then
    raise exception 'Only SafaKing staff can change an artist''s standing.' using errcode = 'P0001';
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

drop trigger if exists artist_profiles_standing_guard on public.artist_profiles;
create trigger artist_profiles_standing_guard
  before update on public.artist_profiles
  for each row execute function public.guard_artist_standing();

-- ---------------------------------------------------------------------------
-- 4. Standing blocks work, in the same place KYC does
-- ---------------------------------------------------------------------------
create or replace function public.artist_is_assignable(p_artist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select ap.verification_status = 'verified'
            and coalesce(ap.active, true)
            and not coalesce(ap.blacklisted, false)
            and coalesce(ap.standing, 'good') not in ('suspended', 'under_review')
            and not (coalesce(ap.standing, 'good') = 'restricted'
                     and (ap.restricted_until is null or ap.restricted_until > now()))
       from public.artist_profiles ap
      where ap.id = p_artist_id),
    false
  );
$$;

create or replace function public.enforce_artist_kyc_on_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status   text;
  v_name     text;
  v_standing text;
begin
  if new.artist_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.artist_id is not distinct from new.artist_id then
    return new;
  end if;
  if public.artist_is_assignable(new.artist_id) then
    return new;
  end if;

  select ap.verification_status, coalesce(ap.display_name, 'This artist'), coalesce(ap.standing, 'good')
    into v_status, v_name, v_standing
    from public.artist_profiles ap
   where ap.id = new.artist_id;

  if v_status is null then
    raise exception 'This artist has no approved profile yet, so they cannot be assigned.' using errcode = 'P0001';
  elsif v_standing in ('suspended', 'under_review', 'restricted') then
    raise exception '% cannot be assigned: their standing is "%".', v_name, replace(v_standing, '_', ' ')
      using errcode = 'P0001';
  else
    raise exception '% cannot be assigned: KYC is %, or the account is inactive/blacklisted. Approve their documents in Admin -> Verification first.',
      v_name, coalesce(v_status, 'not started')
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.enforce_artist_kyc_on_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.artist_is_assignable(new.artist_id) then
    return new;
  end if;
  raise exception 'You cannot send quotes right now — your KYC is not approved, or your account is restricted. Check the notice in your artist portal.'
    using errcode = 'P0001';
end;
$$;

select 'tickets, incidents and standing ready' as status,
       (select count(*) from public.complaints where ticket_id is not null) as ticketed_complaints;
