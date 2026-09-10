-- 034_staff_profiles_and_artist_terms.sql
--
-- 1. Staff photo and designation, so an employee working the admin panel is
--    a named person with a role on the screen rather than an email address.
-- 2. Artist agreement v2: an artist may not take a booking directly from a
--    customer they reached through SafaKing, nor try to move that customer
--    off the platform for future events.

alter table public.profiles
  add column if not exists designation text,
  add column if not exists avatar_url  text;

-- A new version rather than an edit to v1: artists who signed v1 agreed to
-- v1, and contract_acceptances has to keep meaning what they actually saw.
-- Atomic, because only one artist contract may be active at a time and a
-- half-finished swap would leave artist signup with no agreement at all.
do $$
declare
  v_next integer;
begin
  select coalesce(max(version), 0) + 1 into v_next
    from public.contracts where audience = 'artist';

  update public.contracts set active = false
   where audience = 'artist' and active;

  insert into public.contracts (audience, version, title, body, active)
  values ('artist', v_next, 'Safa Artist Service Agreement', $body$By accepting a booking I agree to: arrive at the venue on time; wear a helmet while riding to the venue; carry valid personal insurance for travel; never accept payment directly from the customer — all payment is handled by SafaKing; never take a booking directly from a customer I reached through SafaKing, and never ask or encourage such a customer to book me directly for any future event — every booking and payment with them goes through SafaKing, and trying to move a SafaKing customer off the platform is a violation of platform policy; if I cannot reach a booking after accepting it, I will arrange a replacement artist through SafaKing so the order is still completed — the order cannot simply be cancelled once accepted; and I will maintain professional conduct throughout. I understand that changing an accepted date within 3 days of the wedding without a valid reason affects my rating.$body$, true);
end;
$$;

select audience, version, active, left(body, 60) as starts
  from public.contracts
 where audience = 'artist'
 order by version;
