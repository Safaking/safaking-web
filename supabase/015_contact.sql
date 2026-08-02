-- ============================================================================
-- SafaKing — 015 Contact messages
--
-- Run AFTER 014_fix_rls_recursion.sql, in the Supabase SQL Editor. Idempotent.
--
-- Backs the Contact Us form. Kept deliberately small: a contact form that
-- silently discards messages is worse than no form at all, so the page needs a
-- real table behind it before it ships.
-- ============================================================================

do $$ begin
  create type contact_state as enum ('new','read','replied','closed');
exception when duplicate_object then null; end $$;

create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  full_name  text not null,
  phone      text not null,
  email      text,
  subject    text,
  message    text not null,
  status     contact_state not null default 'new',
  admin_note text,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_status_idx
  on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;

-- Anyone may write to us, including a guest who is not signed in.
drop policy if exists contact_insert on public.contact_messages;
create policy contact_insert on public.contact_messages
  for insert with check (user_id is null or user_id = auth.uid());

-- Only staff read the inbox; a signed-in sender can see their own messages.
drop policy if exists contact_select on public.contact_messages;
create policy contact_select on public.contact_messages
  for select using (public.is_admin() or user_id = auth.uid());

drop policy if exists contact_update on public.contact_messages;
create policy contact_update on public.contact_messages
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists contact_delete on public.contact_messages;
create policy contact_delete on public.contact_messages
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
select count(*) as contact_messages from public.contact_messages;
