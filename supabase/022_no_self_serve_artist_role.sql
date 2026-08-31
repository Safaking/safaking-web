-- handle_new_user() previously trusted whatever role a signup request sent
-- (blocking only 'admin'), so anyone POSTing role: 'artist' directly to
-- Supabase's signup endpoint got instant /artist-portal access — completely
-- bypassing the artist_applications review the admin panel is built around.
-- The UI-level signup form no longer offers this (see AuthModal.tsx), but
-- that alone doesn't stop a direct API call, so this closes it server-side
-- too: every new account is now 'customer', full stop. Artist role is
-- granted only by an admin approving a submitted application, which flips
-- an existing account's role via a plain UPDATE, not this trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email, city, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    new.email,
    new.raw_user_meta_data ->> 'city',
    'customer'::user_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
