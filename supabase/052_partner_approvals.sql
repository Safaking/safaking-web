-- 052 — approving a business partner from the admin desk.
--
-- The partner rate is only paid to an approved partner, and until now the only
-- way to approve one was to edit the row by hand. That is not a thing anybody
-- is going to do reliably for every shop that applies, so the higher rate was
-- in practice never paid to anyone.
--
-- Reading goes through a function rather than the table, so the admin screen
-- cannot accidentally be given more than it needs, and writing goes through a
-- function for the reason 046 did: the table's policies stay shut and the
-- decision is taken in one place that checks who is asking.

create or replace function public.admin_list_partners()
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then coalesce(
    (select jsonb_agg(row_to_json(p) order by
       -- Waiting first: a shop that applied and heard nothing is the one
       -- thing on this screen that needs doing.
       case p.status when 'pending' then 0 when 'approved' then 1 else 2 end,
       p.created_at desc)
     from (
       select rp.id, rp.business_name, rp.contact_name, rp.phone, rp.whatsapp,
              rp.kind, rp.city, rp.address_line, rp.village, rp.tehsil,
              rp.district, rp.state, rp.pincode, rp.payout_upi, rp.status,
              rp.created_at, rp.reviewed_at,
              c.code,
              -- What they have actually earned, so a decision is not taken on
              -- the name alone.
              coalesce((select sum(l.amount) from public.credit_ledger l
                         where l.user_id = rp.user_id and l.amount > 0), 0) as earned,
              coalesce((select count(*) from public.referrals r
                         join public.referral_codes rc on rc.code = r.code
                        where rc.owner_id = rp.user_id), 0) as joined_count
         from public.referral_partners rp
         left join public.referral_codes c on c.owner_id = rp.user_id
     ) p),
    '[]'::jsonb)
  else '[]'::jsonb end;
$$;

create or replace function public.admin_set_partner_status(
  p_id uuid,
  p_status text
)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Admins only.');
  end if;
  if p_status not in ('pending', 'approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'Unknown status.');
  end if;

  update public.referral_partners
     set status = p_status,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'No such partner.');
  end if;

  -- Deliberately nothing retrospective. Credit already earned at the old rate
  -- stays earned: approving somebody is a decision about what happens next,
  -- not a reason to rewrite what the shop has already paid out.
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

grant execute on function public.admin_list_partners() to authenticated;
grant execute on function public.admin_set_partner_status(uuid, text) to authenticated;

select 'partner approvals ready' as status;
