-- 047 — make referral codes possible at all.
--
-- my_referral_code() built its code with gen_random_bytes(), which belongs to
-- pgcrypto. On Supabase pgcrypto lives in the "extensions" schema, and the
-- function is declared `set search_path = public` — so the call never
-- resolved. Every customer who opened the refer page got
--
--   function gen_random_bytes(integer) does not exist
--
-- which the page swallowed, showing "…" where the code should be. No referral
-- code has ever been issued; the feature has been dead since it shipped.
--
-- gen_random_uuid() is in pg_catalog, which search_path always includes, so it
-- needs no extension and cannot be moved out from under us. Its hex output has
-- no O or I to be misread, and 0 and 1 are translated away for the same
-- reason — a code is read out across a counter.
--
-- Only the code-making line changes; the rest of the function is as it was.

create or replace function public.my_referral_code()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_try  text;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;

  select code into v_code from public.referral_codes where owner_id = v_user;
  if v_code is not null then
    return v_code;
  end if;

  for _ in 1..12 loop
    v_try := 'SK' || upper(
      substr(translate(replace(gen_random_uuid()::text, '-', ''), '01', 'jk'), 1, 5)
    );
    begin
      insert into public.referral_codes (code, owner_id, label)
      values (v_try, v_user, 'Customer code');
      return v_try;
    exception when unique_violation then
      -- Taken; try another.
    end;
  end loop;

  raise exception 'Could not make a referral code. Please try again.';
end;
$$;

grant execute on function public.my_referral_code() to authenticated;

select 'referral codes can be issued' as status;
