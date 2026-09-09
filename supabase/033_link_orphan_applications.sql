-- 033_link_orphan_applications.sql
--
-- Two live applications (Nakul joshi, Aj singh) carry user_id = null: they
-- were submitted before the join form required an account. Approval attaches
-- the artist profile to an account, so an application without one can never
-- be approved — and the only remedy on offer was "ask them to fill the whole
-- form again", which for a ten-year artist who already did is not a remedy.
--
-- From here, an account claims its own application: when someone signs up (or
-- adds their phone later) any unlinked application with that phone attaches
-- itself. Linking is not approving — an admin still decides that.

create or replace function public.claim_artist_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  v_phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  if length(v_phone) < 10 then
    return new;
  end if;

  -- Last 10 digits, so +91 / 0 prefixes match the number as typed on the form.
  update public.artist_applications a
     set user_id = new.id
   where a.user_id is null
     and right(regexp_replace(coalesce(a.phone, ''), '\D', '', 'g'), 10) = right(v_phone, 10);

  return new;
end;
$$;

drop trigger if exists profiles_claim_application on public.profiles;
create trigger profiles_claim_application
  after insert or update of phone on public.profiles
  for each row execute function public.claim_artist_application();

-- Attach the ones already sitting there, if their artist has since signed up.
update public.artist_applications a
   set user_id = p.id
  from public.profiles p
 where a.user_id is null
   and length(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')) >= 10
   and right(regexp_replace(coalesce(a.phone, ''), '\D', '', 'g'), 10)
     = right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10);

-- An admin also needs to attach one by hand when the artist signed up with a
-- different number. SECURITY DEFINER because artist_applications is not
-- writable by the panel's session for this column.
create or replace function public.link_artist_application(p_application_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can link an application to an account.' using errcode = 'P0001';
  end if;

  update public.artist_applications
     set user_id = p_user_id
   where id = p_application_id;
end;
$$;

grant execute on function public.link_artist_application(uuid, uuid) to authenticated;

select a.full_name, a.phone, a.status, a.user_id
  from public.artist_applications a
 order by a.created_at;
