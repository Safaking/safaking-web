-- ============================================================================
-- Promote the first administrator.
--
-- 'admin' can never be chosen at signup (the handle_new_user trigger forces
-- customer/artist), so the very first admin has to be created here, by hand.
-- After that, an admin can change anyone's role from the Users tab of /admin.
--
-- 1. Sign up normally on the site with the email you want to be the admin.
-- 2. Replace the email below and run this in the SQL Editor.
-- ============================================================================

update public.profiles
set role = 'admin'
where email = 'you@example.com';

-- Verify:
select id, email, full_name, role from public.profiles order by created_at desc;
