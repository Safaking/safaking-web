-- 031_audit_log.sql
--
-- Section 16 of the reporting spec: every change to a booking, payment,
-- refund, status or assignment must be attributable — who changed what, and
-- when. Until now nothing recorded it, so "किस user ने amount, discount,
-- status या artist assignment बदला" had no answer at all.
--
-- Only the fields that actually changed are stored, not a copy of the row:
-- a full before/after on every edit turns into gigabytes of duplicated
-- addresses, and buries the one field somebody is looking for.

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   uuid,
  action      text not null check (action in ('insert', 'update', 'delete')),
  actor_id    uuid,
  actor_role  text,
  changed     jsonb,          -- { field: { from, to } } for updates
  snapshot    jsonb,          -- the identifying fields, for inserts/deletes
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id, created_at desc);
create index if not exists audit_log_actor_idx  on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_time_idx   on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- Staff read it; nobody writes it by hand. The trigger below is SECURITY
-- DEFINER, so it writes regardless of these policies — which is the point:
-- an immutable trail (spec §18) needs no INSERT, UPDATE or DELETE policy.
drop policy if exists audit_log_staff_read on public.audit_log;
create policy audit_log_staff_read on public.audit_log
  for select using (public.is_staff());

-- ---------------------------------------------------------------------------
-- The recorder
-- ---------------------------------------------------------------------------
create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed jsonb := '{}'::jsonb;
  v_key     text;
  v_old     jsonb;
  v_new     jsonb;
  v_role    text;
  v_id      uuid;
  v_raw     text;
  -- Noise: touched on nearly every write and interesting to nobody.
  v_skip    text[] := array['updated_at', 'created_at'];
begin
  select role::text into v_role from public.profiles where id = auth.uid();

  v_old := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new := case when tg_op = 'DELETE' then null else to_jsonb(new) end;

  -- app_settings is keyed by `key`, not `id`; reading the id out of the row
  -- as JSON keeps one recorder working for every table instead of needing a
  -- variant per primary-key shape.
  v_raw := coalesce(v_new ->> 'id', v_old ->> 'id');
  begin
    v_id := v_raw::uuid;
  exception when others then
    v_id := null;
  end;

  if tg_op = 'UPDATE' then

    for v_key in select jsonb_object_keys(v_new) loop
      if v_key = any (v_skip) then continue; end if;
      if v_old -> v_key is distinct from v_new -> v_key then
        v_changed := v_changed || jsonb_build_object(
          v_key, jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key)
        );
      end if;
    end loop;

    -- A write that changed nothing is not an event.
    if v_changed = '{}'::jsonb then
      return new;
    end if;

    insert into public.audit_log (table_name, record_id, action, actor_id, actor_role, changed, snapshot)
    values (tg_table_name, v_id, 'update', auth.uid(), v_role, v_changed,
            case when v_id is null then jsonb_build_object('key', v_new ->> 'key') else null end);
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, actor_id, actor_role, snapshot)
    values (tg_table_name, v_id, 'insert', auth.uid(), v_role, v_new);
    return new;
  end if;

  insert into public.audit_log (table_name, record_id, action, actor_id, actor_role, snapshot)
  values (tg_table_name, v_id, 'delete', auth.uid(), v_role, v_old);
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- What gets watched: money, commitments and trust. Not catalogue edits.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'artist_bookings', 'rental_bookings', 'orders', 'expenses',
    'complaints', 'artist_profiles', 'profiles', 'app_settings'
  ] loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.record_audit()', t, t
    );
  end loop;
end;
$$;

select 'audit log recording' as status;
