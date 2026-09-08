-- 030_public_verified_follows_kyc.sql
--
-- The green "verified" shield on the public artist directory was reading
-- artist_profiles.verified — a boolean that drifted away from the KYC state
-- once refresh_verification_status() stopped writing it. Live right now, both
-- artists show verified = true while their verification_status is
-- 'unverified': the site is telling the public we checked IDs we have never
-- seen. The badge is derived from the KYC state from here on, so it cannot
-- drift again, and it also fixes the ordering that puts "verified" first.
--
-- Artists whose documents are not yet approved are still listed — they are
-- real artists — they simply do not carry the badge.

create or replace view public.artist_public_profiles as
select
  a.id,
  a.display_name,
  a.base_city,
  a.specialties,
  a.experience_years,
  a.safas_per_day,
  a.per_safa_rate,
  a.team_size,
  a.rating,
  a.total_events,
  (a.verification_status = 'verified') as verified,
  (select count(*) from public.reviews r
    where r.subject_type = 'artist' and r.subject_id = a.id and r.visible) as review_count,
  (select count(*) from public.portfolio_items p
    where p.artist_id = a.id and p.visible) as portfolio_count
from public.artist_profiles a
where a.active and not coalesce(a.blacklisted, false);

select display_name, verified from public.artist_public_profiles order by display_name;
