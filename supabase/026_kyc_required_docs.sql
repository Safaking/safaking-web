-- 026_kyc_required_docs.sql
--
-- Only Aadhaar + selfie are required to reach 'verified'.
--
-- required_docs('artist') also demanded a training certificate, which most
-- experienced artists simply do not have — under the KYC gate added in
-- supabase/025_kyc_assignment_gate.sql that left them stuck at 'pending' and
-- permanently unassignable. A certificate and experience proof are still
-- uploadable and still shown to the reviewer; whether what an artist provides
-- is good enough is the admin's judgement at approval time, not a hard rule.

create or replace function public.required_docs(p_subject_type text)
returns text[]
language sql
immutable
as $$
  select case p_subject_type
    when 'artist'   then array['aadhaar_front','selfie']
    when 'supplier' then array['shop_photo','bank_proof']
    else array[]::text[]
  end;
$$;

-- Recompute everyone against the new list: an artist whose Aadhaar and selfie
-- are already approved should become 'verified' now, not on their next upload.
do $$
declare
  r record;
begin
  for r in select distinct owner_id from public.verification_documents loop
    perform public.refresh_verification_status(r.owner_id);
  end loop;
end;
$$;

select ap.id,
       ap.display_name,
       ap.verification_status,
       public.artist_is_assignable(ap.id) as assignable_now
  from public.artist_profiles ap
 order by assignable_now, ap.display_name;
