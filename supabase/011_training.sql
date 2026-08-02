-- ============================================================================
-- SafaKing — 011 Training Academy  (spec item 9, plus Digital Certificate
--   and Student Dashboard from STEP 5, and Certificate Approval from STEP 10)
--
-- Run AFTER 010_live_ops.sql, in the Supabase SQL Editor. Idempotent.
--
-- academy_enrollments stays as it is: it is the public "I'm interested" lead
-- form. This file adds what happens after someone actually joins — courses,
-- dated batches with real seats, attendance, and a certificate that can only
-- exist if the training behind it did.
-- ============================================================================

do $$ begin
  create type batch_state as enum ('scheduled','running','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type student_state as enum ('enrolled','attending','completed','dropped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type certificate_state as enum ('pending','approved','issued','revoked');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Courses
-- ---------------------------------------------------------------------------
create table if not exists public.training_courses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  duration_days integer not null default 5,
  fee           integer not null default 0,
  syllabus      text[],
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

insert into public.training_courses (name, description, duration_days, fee, syllabus)
select
  'Safa Tying Foundation',
  'Learn the three signature SafaKing styles from a master artist, with hands-on practice on real fabric.',
  5, 5000,
  array['Fabric handling and pleating','Rounded safa','Jodhpuri safa','Barati safa','Kalgi and brooch placement','Speed tying for baraat']
where not exists (select 1 from public.training_courses);

-- ---------------------------------------------------------------------------
-- 2. Batches — a course actually running, at a centre, on dates
-- ---------------------------------------------------------------------------
create table if not exists public.training_batches (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.training_courses(id) on delete cascade,
  centre        text not null,
  start_date    date not null,
  end_date      date not null,
  seats         integer not null default 15 check (seats > 0),
  trainer_id    uuid references public.profiles(id) on delete set null,
  trainer_name  text,
  status        batch_state not null default 'scheduled',
  notes         text,
  created_at    timestamptz not null default now(),
  constraint batch_dates_valid check (end_date >= start_date)
);

create index if not exists batches_start_idx on public.training_batches (start_date);

-- ---------------------------------------------------------------------------
-- 3. Students in a batch
-- ---------------------------------------------------------------------------
create table if not exists public.training_students (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.training_batches(id) on delete cascade,
  -- A student may be a registered user, or a walk-in the admin typed in.
  user_id       uuid references public.profiles(id) on delete set null,
  enrollment_id uuid references public.academy_enrollments(id) on delete set null,
  full_name     text not null,
  phone         text not null,
  city          text,
  status        student_state not null default 'enrolled',
  days_attended integer not null default 0,
  score         integer check (score is null or score between 0 and 100),
  fee_paid      integer not null default 0,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists students_batch_idx on public.training_students (batch_id);
create unique index if not exists students_one_per_batch
  on public.training_students (batch_id, phone);

/** Seats left in a batch. Dropped students free their seat. */
create or replace function public.batch_seats_left(p_batch_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    coalesce((select seats from public.training_batches where id = p_batch_id), 0)
    - coalesce((select count(*) from public.training_students
                where batch_id = p_batch_id and status <> 'dropped'), 0)
  )::integer;
$$;

-- Refuse to overfill a batch. A classroom has a real capacity; letting the
-- table exceed it would put someone on a course with nowhere to stand.
create or replace function public.guard_batch_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.batch_id is distinct from old.batch_id then
    if public.batch_seats_left(new.batch_id) <= 0 then
      raise exception 'That batch is full.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists training_students_capacity on public.training_students;
create trigger training_students_capacity
  before insert or update on public.training_students
  for each row execute function public.guard_batch_capacity();

-- ---------------------------------------------------------------------------
-- 4. Certificates
--
-- A certificate is a claim about a person's skill that customers will rely on
-- when booking them. It therefore cannot be self-serve: it requires a completed
-- enrolment AND an explicit admin approval.
-- ---------------------------------------------------------------------------
create sequence if not exists public.certificate_seq start 1;

create table if not exists public.certificates (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.training_students(id) on delete cascade,
  user_id            uuid references public.profiles(id) on delete set null,
  certificate_number text unique,
  student_name       text not null,
  course_name        text not null,
  centre             text,
  completed_on       date,
  score              integer,
  status             certificate_state not null default 'pending',
  approved_by        uuid references public.profiles(id) on delete set null,
  approved_at        timestamptz,
  revoked_reason     text,
  created_at         timestamptz not null default now()
);

create unique index if not exists certificates_one_per_student
  on public.certificates (student_id);

/**
 * Raises a certificate for a student who has finished.
 * Refuses if the enrolment is not marked completed — the paperwork must follow
 * the training, not replace it.
 */
create or replace function public.request_certificate(p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  existing uuid;
begin
  select ts.*, tb.centre, tb.end_date, tc.name as course_name
  into s
  from public.training_students ts
  join public.training_batches tb on tb.id = ts.batch_id
  join public.training_courses tc on tc.id = tb.course_id
  where ts.id = p_student_id;

  if s is null then
    raise exception 'Student not found';
  end if;
  if s.status <> 'completed' then
    raise exception 'This student has not completed the course yet';
  end if;

  select id into existing from public.certificates where student_id = p_student_id;
  if existing is not null then
    return existing;
  end if;

  insert into public.certificates
    (student_id, user_id, student_name, course_name, centre, completed_on, score, status)
  values
    (p_student_id, s.user_id, s.full_name, s.course_name, s.centre, s.end_date, s.score, 'pending')
  returning id into existing;

  return existing;
end;
$$;

/**
 * Admin approval mints the number. Numbering only ever happens here, so an
 * unapproved certificate can never carry one.
 */
create or replace function public.approve_certificate(p_certificate_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  minted text;
  current_number text;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can approve a certificate';
  end if;

  select certificate_number into current_number
  from public.certificates where id = p_certificate_id;

  if current_number is not null then
    return current_number;
  end if;

  minted := 'SK-CERT-' || to_char(now(), 'YYYY') || '-'
            || lpad(nextval('public.certificate_seq')::text, 4, '0');

  update public.certificates
  set certificate_number = minted,
      status = 'issued',
      approved_by = auth.uid(),
      approved_at = now()
  where id = p_certificate_id;

  return minted;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Student dashboard view
-- ---------------------------------------------------------------------------
create or replace view public.my_training
with (security_invoker = true)
as
select
  ts.id            as student_id,
  ts.user_id,
  ts.full_name,
  ts.phone,
  ts.status,
  ts.days_attended,
  ts.score,
  ts.fee_paid,
  tb.id            as batch_id,
  tb.centre,
  tb.start_date,
  tb.end_date,
  tb.status        as batch_status,
  tb.trainer_name,
  tc.name          as course_name,
  tc.description   as course_description,
  tc.duration_days,
  tc.fee,
  tc.syllabus,
  c.id             as certificate_id,
  c.certificate_number,
  c.status         as certificate_status
from public.training_students ts
join public.training_batches tb on tb.id = ts.batch_id
join public.training_courses tc on tc.id = tb.course_id
left join public.certificates c on c.student_id = ts.id;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.training_courses  enable row level security;
alter table public.training_batches  enable row level security;
alter table public.training_students enable row level security;
alter table public.certificates      enable row level security;

-- Courses and batches are public: people need to see what is on offer and when.
drop policy if exists courses_select on public.training_courses;
create policy courses_select on public.training_courses for select using (active or public.is_admin());

drop policy if exists courses_write on public.training_courses;
create policy courses_write on public.training_courses
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists batches_select on public.training_batches;
create policy batches_select on public.training_batches for select using (true);

drop policy if exists batches_write on public.training_batches;
create policy batches_write on public.training_batches
  for all using (public.is_admin()) with check (public.is_admin());

-- A student sees their own row; the trainer sees their batch; admin sees all.
drop policy if exists students_select on public.training_students;
create policy students_select on public.training_students
  for select using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (select 1 from public.training_batches b
               where b.id = batch_id and b.trainer_id = auth.uid())
  );

drop policy if exists students_write on public.training_students;
create policy students_write on public.training_students
  for all using (public.is_admin()) with check (public.is_admin());

-- A certificate is publicly verifiable once issued: anyone given the number can
-- confirm it is real. Pending ones stay private to the student and admin.
drop policy if exists certificates_select on public.certificates;
create policy certificates_select on public.certificates
  for select using (
    status = 'issued' or public.is_admin() or user_id = auth.uid()
  );

drop policy if exists certificates_write on public.certificates;
create policy certificates_write on public.certificates
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Verification
-- ---------------------------------------------------------------------------
select name, duration_days, fee from public.training_courses;
select count(*) as batches from public.training_batches;
