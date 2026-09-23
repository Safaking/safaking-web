-- 042: Push notifications
--
-- Free alerts to the Android app — Google charges nothing for these, and they
-- need no DLT registration, unlike SMS. Each phone that allows notifications
-- registers a token here; the server sends to every token a person has.
--
-- A token belongs to a device, not a person: the same phone handed to someone
-- else must not keep the old account's alerts, so registering a token that
-- already exists moves it to the new owner.
--
-- Safe to run more than once.

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android', 'ios', 'web')),
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- A person manages only their own devices. The server reads them all with the
-- service role when it sends.
drop policy if exists device_tokens_own_read on public.device_tokens;
create policy device_tokens_own_read on public.device_tokens
  for select using (user_id = auth.uid());

drop policy if exists device_tokens_own_write on public.device_tokens;
create policy device_tokens_own_write on public.device_tokens
  for insert with check (user_id = auth.uid());

drop policy if exists device_tokens_own_update on public.device_tokens;
create policy device_tokens_own_update on public.device_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists device_tokens_own_delete on public.device_tokens;
create policy device_tokens_own_delete on public.device_tokens
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- register_device_token: the app calls this on every start.
-- Takes the token over if the phone previously belonged to another account.
-- ---------------------------------------------------------------------------
create or replace function public.register_device_token(
  p_token text,
  p_platform text default 'android',
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Sign in before registering a device.' using errcode = '42501';
  end if;
  if p_token is null or length(trim(p_token)) < 20 then
    raise exception 'That is not a device token.' using errcode = 'P0001';
  end if;
  if p_platform not in ('android', 'ios', 'web') then
    raise exception 'Unknown platform %.', p_platform using errcode = 'P0001';
  end if;

  insert into public.device_tokens (user_id, token, platform, app_version)
       values (v_user, trim(p_token), p_platform, p_app_version)
  on conflict (token) do update
          set user_id = excluded.user_id,
              platform = excluded.platform,
              app_version = coalesce(excluded.app_version, public.device_tokens.app_version),
              last_seen_at = now()
    returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- forget_device_token: on sign-out, so the next person on this phone does not
-- get the previous account's alerts.
-- ---------------------------------------------------------------------------
create or replace function public.forget_device_token(p_token text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_gone integer;
begin
  if v_user is null then
    return 0;
  end if;
  delete from public.device_tokens where token = trim(p_token) and user_id = v_user;
  get diagnostics v_gone = row_count;
  return v_gone;
end;
$$;

revoke all on function public.register_device_token(text, text, text) from public, anon;
revoke all on function public.forget_device_token(text) from public, anon;
grant execute on function public.register_device_token(text, text, text) to authenticated, service_role;
grant execute on function public.forget_device_token(text) to authenticated, service_role;

select 'push devices ready' as status, (select count(*) from public.device_tokens) as devices;
