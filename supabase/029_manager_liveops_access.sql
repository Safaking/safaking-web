-- 029_manager_liveops_access.sql
--
-- Live tracking was written before the manager role existed, so its policies
-- say is_admin() — which left a manager unable to see where an artist is,
-- on the very screens their job is to work from.

do $$
declare
  t text;
begin
  foreach t in array array['booking_checkins', 'artist_locations', 'replacement_requests'] loop
    execute format('drop policy if exists %I_manager_read on public.%I', t, t);
    execute format('create policy %I_manager_read on public.%I for select using (public.is_manager())', t, t);
  end loop;
end;
$$;

-- Live-ops also lets staff mark a check-in on an artist's behalf when they
-- phone it in — that has to work for a manager too.
drop policy if exists checkins_manager_insert on public.booking_checkins;
create policy checkins_manager_insert on public.booking_checkins
  for insert with check (public.is_manager());

select 'manager can now see live tracking' as status;
