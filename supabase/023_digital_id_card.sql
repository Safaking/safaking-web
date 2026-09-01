-- Digital ID Card + QR Profile (App module.docx items 21/24): every verified
-- artist gets a unique, stable ID code once admin verification is granted.
-- The QR itself just encodes a link to the existing /artists/[id] public
-- profile page — no new column needed for that part.

create sequence if not exists public.artist_digital_id_seq start 1;

alter table public.artist_profiles
  add column if not exists digital_id_code text unique;

-- Mirrors guard_artist_verified() in 005_smart_matching.sql: the code is
-- assigned automatically the moment `verified` flips true (by an admin, via
-- the same update chain refresh_verification_status() already drives — see
-- 006_verification.sql), and is otherwise immutable by anyone but an admin.
create or replace function public.guard_and_assign_digital_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.digital_id_code is distinct from old.digital_id_code
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an administrator can change the digital ID code';
  end if;

  if new.verified = true and old.verified is distinct from true and new.digital_id_code is null then
    new.digital_id_code := 'SK-ART-' || lpad(nextval('public.artist_digital_id_seq')::text, 5, '0');
  end if;

  return new;
end; $$;

drop trigger if exists artist_profiles_guard_digital_id on public.artist_profiles;
create trigger artist_profiles_guard_digital_id
  before update on public.artist_profiles
  for each row execute function public.guard_and_assign_digital_id();

-- Backfill: the trigger only fires on a future verified-false->true
-- transition, so anyone already verified before this migration ran would
-- otherwise never get a code. Assign in a stable order (oldest first).
with to_backfill as (
  select id from public.artist_profiles
  where verified = true and digital_id_code is null
  order by created_at
)
update public.artist_profiles a
set digital_id_code = 'SK-ART-' || lpad(nextval('public.artist_digital_id_seq')::text, 5, '0')
from to_backfill b
where a.id = b.id;
