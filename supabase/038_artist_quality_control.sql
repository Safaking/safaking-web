-- 038_artist_quality_control.sql
--
-- Phase 4 of the owner's operating rules: artist quality control.
--
--   "हर completed booking के बाद: Customer Rating + Complaint + Attendance +
--    Arrival Time record हो।"
--
-- Most of that is already captured as it happens — the customer's review,
-- complaints on the booking, check-ins (arrival is when the customer's
-- arrival code is entered) and pull-out / no-show incidents. This brings it
-- together, job by job, and scores it.
--
--   artist_job_records     what staff record when the app did not capture it
--                          (the artist never checked in, arrival by phone)
--   artist_job_quality     one row per job: the four facts and a score
--   artist_quality_scores  per artist: the average of their last 20 scored jobs
--
-- A job's score, out of 100:
--   Attendance   40  turned up (a no-show or a pull-out scores the whole job 0)
--   Arrival      20  within 10 minutes of the start time 20, by 30 minutes 12,
--                    by 60 minutes 6, later 0; never recorded 10
--   Rating       25  the customer's stars × 5 (left out while there is no review)
--   Complaints   15  none 15, one 5, two or more or any P1 0 (dismissed ones don't count)
-- Parts that do not apply are left out of the total rather than given away.
--
-- Both views run with the reader's own permissions (security_invoker), so an
-- artist sees only their own jobs and staff see what their access allows.

-- ---------------------------------------------------------------------------
-- 1. What staff record by hand
-- ---------------------------------------------------------------------------
create table if not exists public.artist_job_records (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.artist_bookings (id) on delete cascade,
  rental_id   uuid references public.rental_bookings (id) on delete cascade,
  job_id      uuid generated always as (coalesce(booking_id, rental_id)) stored,
  artist_id   uuid not null references public.profiles (id) on delete cascade,
  attendance  text not null,
  arrived_at  timestamptz,
  note        text not null,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.artist_job_records drop constraint if exists artist_job_records_one_job;
alter table public.artist_job_records add constraint artist_job_records_one_job
  check ((booking_id is not null)::int + (rental_id is not null)::int = 1);

alter table public.artist_job_records drop constraint if exists artist_job_records_attendance_check;
alter table public.artist_job_records add constraint artist_job_records_attendance_check
  check (attendance in ('attended', 'no_show'));

alter table public.artist_job_records drop constraint if exists artist_job_records_arrival_needs_attendance;
alter table public.artist_job_records add constraint artist_job_records_arrival_needs_attendance
  check (arrived_at is null or attendance = 'attended');

create unique index if not exists artist_job_records_job_artist_key on public.artist_job_records (job_id, artist_id);

create or replace function public.stamp_artist_job_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(btrim(new.note), '') = '' then
    raise exception 'Say how you know — who confirmed it, or what happened.' using errcode = 'P0001';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    new.recorded_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists artist_job_records_stamp on public.artist_job_records;
create trigger artist_job_records_stamp
  before insert or update on public.artist_job_records
  for each row execute function public.stamp_artist_job_record();

alter table public.artist_job_records enable row level security;

drop policy if exists artist_job_records_read on public.artist_job_records;
create policy artist_job_records_read on public.artist_job_records
  for select using (artist_id = auth.uid() or public.is_staff());

-- The teams that run artists record it: operations, the Artist Manager, the owner.
drop policy if exists artist_job_records_write on public.artist_job_records;
create policy artist_job_records_write on public.artist_job_records
  for all using (public.staff_can('assign_artist')) with check (public.staff_can('assign_artist'));

drop trigger if exists artist_job_records_audit on public.artist_job_records;
create trigger artist_job_records_audit
  after insert or update or delete on public.artist_job_records
  for each row execute function public.record_audit();

-- A complaint about a booking is a complaint about the artist on it, even
-- when the form did not say so. Without this the artist's own view of their
-- score could miss a complaint that staff can see.
create or replace function public.fill_complaint_artist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.artist_id is null and new.booking_id is not null then
    select artist_id into new.artist_id from public.artist_bookings where id = new.booking_id;
  elsif new.artist_id is null and new.rental_id is not null then
    select artist_id into new.artist_id from public.rental_bookings where id = new.rental_id;
  end if;
  return new;
end;
$$;

drop trigger if exists complaints_fill_artist on public.complaints;
create trigger complaints_fill_artist
  before insert on public.complaints
  for each row execute function public.fill_complaint_artist();

update public.complaints c set artist_id = b.artist_id
  from public.artist_bookings b
 where c.artist_id is null and c.booking_id = b.id and b.artist_id is not null;
update public.complaints c set artist_id = r.artist_id
  from public.rental_bookings r
 where c.artist_id is null and c.rental_id = r.id and r.artist_id is not null;

-- ---------------------------------------------------------------------------
-- 2. One row per job
-- ---------------------------------------------------------------------------
drop view if exists public.artist_quality_scores;
drop view if exists public.artist_job_quality;

create view public.artist_job_quality
with (security_invoker = true)
as
with jobs as (
  select 'booking'::text as kind, b.id as job_id, b.artist_id, b.customer_name, b.event_date,
         public.event_starts_at(b.event_date, coalesce(nullif(b.booking_start_time, ''), nullif(b.event_time, ''))) as event_at,
         b.status::text as status
    from public.artist_bookings b
   where b.artist_id is not null
     and b.status::text in ('assigned', 'completed')
  union all
  select 'rental', r.id, r.artist_id, r.customer_name, r.start_date,
         public.event_starts_at(r.start_date, null), r.status::text
    from public.rental_bookings r
   where r.artist_id is not null
     and r.needs_artist
     and r.status::text in ('confirmed', 'dispatched', 'active', 'returned', 'completed')
  union all
  -- The artist who failed a booking has already been taken off it; the job
  -- still belongs on their record.
  select case when i.booking_id is not null then 'booking' else 'rental' end,
         coalesce(i.booking_id, i.rental_id), i.artist_id,
         coalesce(b.customer_name, r.customer_name),
         coalesce(b.event_date, r.start_date, i.created_at::date),
         case when b.id is not null
              then public.event_starts_at(b.event_date, coalesce(nullif(b.booking_start_time, ''), nullif(b.event_time, '')))
              when r.id is not null then public.event_starts_at(r.start_date, null) end,
         i.kind
    from public.artist_incidents i
    left join public.artist_bookings b on b.id = i.booking_id
    left join public.rental_bookings r on r.id = i.rental_id
   where i.kind in ('no_show', 'withdrew_after_accept')
     and coalesce(i.booking_id, i.rental_id) is not null
     and coalesce(b.artist_id, r.artist_id) is distinct from i.artist_id
),
facts as (
  select j.*,
         rec.attendance as recorded_attendance,
         rec.arrived_at as recorded_arrival,
         rec.note as record_note,
         (select min(c.created_at) from public.booking_checkins c
           where coalesce(c.booking_id, c.rental_id) = j.job_id and c.artist_id = j.artist_id
             and c.stage::text in ('arrived', 'started')) as checkin_arrival,
         exists (select 1 from public.booking_checkins c
                  where coalesce(c.booking_id, c.rental_id) = j.job_id and c.artist_id = j.artist_id
                    and c.stage::text in ('arrived', 'started', 'completed')) as checked_in,
         exists (select 1 from public.booking_checkins c
                  where coalesce(c.booking_id, c.rental_id) = j.job_id and c.artist_id = j.artist_id
                    and c.stage::text = 'no_show') as checkin_no_show,
         (select i.kind from public.artist_incidents i
           where coalesce(i.booking_id, i.rental_id) = j.job_id and i.artist_id = j.artist_id
             and i.kind in ('no_show', 'withdrew_after_accept')
           order by i.created_at desc limit 1) as failure,
         exists (select 1 from public.artist_incidents i
                  where coalesce(i.booking_id, i.rental_id) = j.job_id and i.artist_id = j.artist_id
                    and i.kind = 'late_arrival') as reported_late,
         (select round(avg(v.rating)::numeric, 1) from public.reviews v
           where coalesce(v.booking_id, v.rental_id) = j.job_id and v.subject_id = j.artist_id and v.visible) as rating,
         (select count(*)::integer from public.complaints c
           where coalesce(c.booking_id, c.rental_id) = j.job_id
             and coalesce(c.artist_id, j.artist_id) = j.artist_id
             and c.status <> 'dismissed') as complaints,
         (select count(*)::integer from public.complaints c
           where coalesce(c.booking_id, c.rental_id) = j.job_id
             and coalesce(c.artist_id, j.artist_id) = j.artist_id
             and c.status <> 'dismissed' and c.priority = 'P1') as critical_complaints
    from jobs j
    left join public.artist_job_records rec on rec.job_id = j.job_id and rec.artist_id = j.artist_id
),
classified as (
  select f.*,
         case
           when f.recorded_attendance is not null then f.recorded_attendance
           when f.failure = 'withdrew_after_accept' then 'withdrew'
           when f.failure = 'no_show' or f.checkin_no_show then 'no_show'
           when f.checked_in or f.status in ('completed', 'returned') then 'attended'
         end as attendance,
         coalesce(f.recorded_arrival, f.checkin_arrival) as arrived_at
    from facts f
),
timed as (
  select c.*,
         case when c.attendance = 'attended' and c.arrived_at is not null and c.event_at is not null
              then round(extract(epoch from (c.arrived_at - c.event_at)) / 60)::integer end as minutes_late
    from classified c
),
scored as (
  select t.*,
         case
           when t.attendance is null or t.attendance <> 'attended' then null
           when t.minutes_late is null then case when t.reported_late then 6 else 10 end
           when t.minutes_late <= 10 then 20
           when t.minutes_late <= 30 then 12
           when t.minutes_late <= 60 then 6
           else 0
         end as arrival_points,
         case when t.attendance = 'attended' and t.rating is not null
              then round(t.rating / 5.0 * 25)::integer end as rating_points,
         case when t.attendance = 'attended' then
           case when t.critical_complaints > 0 or t.complaints >= 2 then 0
                when t.complaints = 1 then 5
                else 15 end
         end as complaint_points
    from timed t
)
select s.kind, s.job_id, s.artist_id, s.customer_name, s.event_date, s.event_at, s.status,
       s.attendance, s.arrived_at, s.minutes_late, s.reported_late,
       s.rating, s.complaints, s.critical_complaints, s.record_note,
       s.arrival_points, s.rating_points, s.complaint_points,
       case
         when s.attendance is null then null
         when s.attendance <> 'attended' then 0
         else round(100.0 * (40 + s.arrival_points + coalesce(s.rating_points, 0) + s.complaint_points)
                    / (40 + 20 + case when s.rating_points is null then 0 else 25 end + 15))::integer
       end as score,
       -- The event is over and the record is not complete: someone should
       -- confirm whether the artist came, and when.
       (s.event_date < (now() at time zone 'Asia/Kolkata')::date
        and (s.attendance is null or (s.attendance = 'attended' and s.arrived_at is null and not s.reported_late))
       ) as needs_record
  from scored s;

-- ---------------------------------------------------------------------------
-- 3. One row per artist
-- ---------------------------------------------------------------------------
create view public.artist_quality_scores
with (security_invoker = true)
as
with recent as (
  select q.*, row_number() over (partition by q.artist_id order by q.event_date desc, q.job_id) as n
    from public.artist_job_quality q
   where q.score is not null
)
select r.artist_id,
       count(*)::integer as scored_jobs,
       round(avg(r.score))::integer as quality_score,
       round(100.0 * count(*) filter (where r.attendance = 'attended') / count(*))::integer as attendance_pct,
       round(100.0 * count(*) filter (where r.minutes_late <= 10)
             / nullif(count(*) filter (where r.minutes_late is not null), 0))::integer as on_time_pct,
       count(*) filter (where r.attendance = 'attended' and r.arrived_at is null)::integer as arrival_unrecorded,
       round(avg(r.rating), 1) as avg_rating,
       count(r.rating)::integer as rated_jobs,
       coalesce(sum(r.complaints), 0)::integer as complaints,
       count(*) filter (where r.attendance in ('no_show', 'withdrew'))::integer as failures,
       max(r.event_date) as last_job
  from recent r
 where r.n <= 20
 group by r.artist_id;

grant select on public.artist_job_quality to authenticated;
grant select on public.artist_quality_scores to authenticated;

select 'artist quality control ready' as status,
       (select count(*) from public.artist_job_quality) as jobs_on_record,
       (select count(*) from public.artist_job_quality where needs_record) as jobs_needing_a_record;
