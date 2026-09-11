-- 039_close_public_data_leaks.sql
--
-- A signed-out check of every table found three that hand private data to
-- anyone on the internet — through access rules that exist on the live
-- database but not in this repo:
--
--   artist_profiles        every active artist's phone, WhatsApp, UPI id,
--                          bank holder name and IFSC, last digits of bank
--                          account and Aadhaar, and the staff standing note
--   artist_bookings        a booking with no customer account: customer
--                          phone, address, map pin, arrival and completion codes
--   supplier_applications  applicant name, phone and email
--
-- Every read rule on those tables is copied into policy_backup and dropped,
-- then only the intended rules are recreated. Public pages keep working: the
-- artist directory reads artist_public_profiles (safe columns only), and
-- matching runs through security-definer functions.
--
-- If something that used to work stops, the dropped rule is in policy_backup.

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

-- RLS on and no policies: only the database owner (SQL editor) can read it.
alter table public.policy_backup enable row level security;

do $$
declare
  p record;
begin
  for p in
    select * from pg_policies
     where schemaname = 'public'
       and cmd in ('SELECT', 'ALL')
       and tablename in ('artist_profiles', 'artist_bookings', 'supplier_applications')
  loop
    insert into public.policy_backup (tablename, policyname, cmd, roles, qual, with_check)
    values (p.tablename, p.policyname, p.cmd, p.roles::text, p.qual, p.with_check);
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

-- ---- artist_profiles: the artist and staff -----------------------------------
create policy artist_profiles_select on public.artist_profiles
  for select using (id = auth.uid() or public.is_admin());

create policy artist_profiles_manager_read on public.artist_profiles
  for select using (public.is_manager());

create policy artist_profiles_artist_ops on public.artist_profiles
  for all using (public.staff_can('artists')) with check (public.staff_can('artists'));

-- ---- artist_bookings: the customer, the artist, staff ---------------------------
create policy bookings_select on public.artist_bookings
  for select using (public.is_admin() or customer_id = auth.uid() or artist_id = auth.uid());

create policy artist_bookings_manager_all on public.artist_bookings
  for all using (public.is_manager()) with check (public.is_manager());

-- ---- supplier_applications: the applicant and the owner ------------------------
create policy suppliers_admin_read on public.supplier_applications
  for select using (public.is_admin() or user_id = auth.uid());

select tablename, count(*) as read_rules_backed_up_and_replaced
  from public.policy_backup
 where dropped_at > now() - interval '1 minute'
 group by tablename
 order by tablename;
