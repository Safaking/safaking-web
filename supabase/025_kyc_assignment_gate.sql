-- 025_kyc_assignment_gate.sql
--
-- KYC is now a hard requirement, not a badge.
--
-- Until now an artist became bookable the moment an admin approved their
-- application; whether their ID documents had ever been checked only showed
-- as a "[KYC not done]" label on the assignment dropdown, which nothing
-- enforced. Work could therefore be dispatched to an unverified person
-- through any of four separate paths (admin dropdown, Live-Ops replacement,
-- Team Builder crew, accept_quote on a marketplace lead), so the check lives
-- in the database where every path has to pass through it.

-- ---------------------------------------------------------------------------
-- Is this artist allowed to receive work right now?
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
       from public.artist_profiles ap
      where ap.id = p_artist_id),
    false  -- no artist_profiles row at all == never approved == not assignable
  );
$$;

grant execute on function public.artist_is_assignable(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Refuse any assignment to an artist who is not assignable
-- ---------------------------------------------------------------------------
create or replace function public.enforce_artist_kyc_on_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_name   text;
begin
  -- Only when an artist is actually being put onto this job. Rows that
  -- already have an artist are left alone, so historical data and unrelated
  -- column updates (status, codes, payment) never trip this.
  if new.artist_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.artist_id is not distinct from new.artist_id then
    return new;
  end if;

  if public.artist_is_assignable(new.artist_id) then
    return new;
  end if;

  select ap.verification_status, coalesce(ap.display_name, 'This artist')
    into v_status, v_name
    from public.artist_profiles ap
   where ap.id = new.artist_id;

  if v_status is null then
    raise exception 'This artist has no approved profile yet, so they cannot be assigned.'
      using errcode = 'P0001';
  else
    raise exception '% cannot be assigned: KYC is %, or the account is inactive/blacklisted. Approve their documents in Admin → Verification first.',
      v_name, coalesce(v_status, 'not started')
      using errcode = 'P0001';
  end if;
end;
$$;

drop trigger if exists artist_bookings_kyc_gate on public.artist_bookings;
create trigger artist_bookings_kyc_gate
  before insert or update on public.artist_bookings
  for each row execute function public.enforce_artist_kyc_on_assignment();

drop trigger if exists rental_bookings_kyc_gate on public.rental_bookings;
create trigger rental_bookings_kyc_gate
  before insert or update on public.rental_bookings
  for each row execute function public.enforce_artist_kyc_on_assignment();

-- ---------------------------------------------------------------------------
-- Same gate one step earlier: an unverified artist should not be able to
-- quote on a marketplace lead, since accepting that quote would assign them.
-- Better to stop it at the quote than to let a customer pick a quote that
-- then fails at accept time.
-- ---------------------------------------------------------------------------
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
  raise exception 'Your KYC is not approved yet, so you cannot send quotes. Upload your documents in the artist portal and wait for approval.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists lead_quotes_kyc_gate on public.lead_quotes;
create trigger lead_quotes_kyc_gate
  before insert on public.lead_quotes
  for each row execute function public.enforce_artist_kyc_on_quote();

-- ---------------------------------------------------------------------------
-- Who is affected right now — run this to see which approved artists are
-- about to become unassignable until their documents are approved.
-- ---------------------------------------------------------------------------
select ap.id,
       ap.display_name,
       ap.verification_status,
       ap.active,
       ap.blacklisted,
       public.artist_is_assignable(ap.id) as assignable_now
  from public.artist_profiles ap
 order by assignable_now, ap.display_name;
