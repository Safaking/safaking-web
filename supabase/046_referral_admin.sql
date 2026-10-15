-- ============================================================================
-- 046 — Letting the shop make and retire its own codes
--
-- Run in the Supabase SQL Editor, after 045. Safe to run again.
--
-- 045 revoked every write on referral_codes so that nothing from a browser
-- could mint a code — which also stopped the owner making the counter card.
-- These two functions put that back for admins only, and nobody else: they
-- run as the database owner and refuse anyone who is not an admin, so the
-- table itself stays closed.
-- ============================================================================

create or replace function public.create_shop_code(p_code text, p_label text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Only an admin can make a code.');
  end if;
  if length(v_code) < 4 or length(v_code) > 16 then
    return jsonb_build_object('ok', false, 'error', 'A code is 4 to 16 letters and numbers.');
  end if;
  if exists (select 1 from public.referral_codes where code = v_code) then
    return jsonb_build_object('ok', false, 'error', 'That code already exists.');
  end if;

  -- owner_id stays null: a shop code gives the customer their credit and
  -- earns nobody a commission.
  insert into public.referral_codes (code, owner_id, label)
  values (v_code, null, nullif(trim(coalesce(p_label, '')), ''));

  return jsonb_build_object('ok', true, 'code', v_code);
end;
$$;

create or replace function public.set_referral_code_active(p_code text, p_active boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Only an admin can change a code.');
  end if;
  update public.referral_codes set active = coalesce(p_active, true) where code = upper(trim(p_code));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'No such code.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.create_shop_code(text, text) to authenticated;
grant execute on function public.set_referral_code_active(text, boolean) to authenticated;

select 'referral admin functions ready' as status;
