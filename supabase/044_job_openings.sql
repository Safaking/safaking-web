-- ============================================================================
-- 044 — Job openings you can post yourself
--
-- Run in the Supabase SQL Editor. Safe to run again.
--
-- The four roles on /careers were written into the website's code, so posting
-- a job, changing a salary or closing a role all needed a developer. They now
-- live here and are edited in Admin → Job Applications → Openings.
--
-- The four existing roles are inserted below exactly as the page shows them
-- today, so nothing changes for a visitor the moment this runs.
-- ============================================================================

create table if not exists public.job_openings (
  id              uuid primary key default gen_random_uuid(),
  -- Stays in the application row, so applications survive a renamed job.
  slug            text not null unique,
  title           text not null,
  department      text not null default '',
  location        text not null default '',
  employment_type text not null default 'Full-time',
  experience      text,
  salary          text,
  summary         text not null default '',
  responsibilities text[] not null default '{}',
  requirements     text[] not null default '{}',
  -- Keys, not CSS: the page maps them to an icon and a colour it already has.
  -- crown | trainer | business | content | artist
  icon            text not null default 'crown',
  -- royal | amber | emerald | pink
  accent          text not null default 'royal',
  -- Shows the "Hiring Fast" badge.
  highlight       boolean not null default false,
  -- Unticked means closed: off the careers page, still here with its applications.
  active          boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists job_openings_active_idx on public.job_openings (active, sort_order);

alter table public.job_openings enable row level security;

-- Anyone may read an open role — that is the point of a careers page.
drop policy if exists job_openings_public_read on public.job_openings;
create policy job_openings_public_read on public.job_openings
  for select using (active or public.is_admin());

-- Only the owner posts, edits or closes one.
drop policy if exists job_openings_admin_write on public.job_openings;
create policy job_openings_admin_write on public.job_openings
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.job_openings to anon, authenticated;
grant insert, update, delete on public.job_openings to authenticated;

-- updated_at, so the admin list can show when a role was last touched.
create or replace function public.touch_job_opening()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_openings_touch on public.job_openings;
create trigger job_openings_touch before update on public.job_openings
  for each row execute function public.touch_job_opening();

-- ---------------------------------------------------------------------------
-- The four roles the page shows today
-- ---------------------------------------------------------------------------
insert into public.job_openings
  (slug, title, department, location, employment_type, experience, salary,
   summary, responsibilities, requirements, icon, accent, highlight, sort_order)
values
  ('master-safa-artist', 'Master Safa Artist', 'Artist Network', 'Jaipur / Delhi / Mumbai',
   'Full-time', '2+ years', '₹25,000 – ₹50,000/month',
   'Join our elite network of safa artists and travel across India to tie safas at premium weddings and events. Work with top grooms, receive premium bookings, and grow your career.',
   array[
     'Tie safas at client weddings & events across India',
     'Style Jodhpuri, Rounded & Barati safa variations',
     'Place kalgi, brooch & accessory elements',
     'Coordinate with wedding planners & event teams',
     'Maintain high client satisfaction standards'],
   array[
     'Minimum 2 years of safa tying experience',
     'Proficiency in 2+ safa styles',
     'Willingness to travel for events',
     'Good communication with clients',
     'SafaKing training certification (preferred)'],
   'crown', 'royal', true, 10),

  ('safa-tying-trainer', 'Safa Tying Trainer', 'SafaKing Academy', 'Jaipur / Delhi',
   'Full-time', '4+ years', '₹30,000 – ₹55,000/month',
   'Teach the next generation of safa artists at SafaKing Academy. Conduct hands-on training sessions, demonstrate regional tying styles, and certify new artists.',
   array[
     'Conduct daily safa tying training sessions',
     'Demonstrate all 3 signature styles',
     'Evaluate and certify student performance',
     'Maintain training materials and curriculum',
     'Report batch progress to academy head'],
   array[
     '4+ years of professional safa tying',
     'Previous teaching or mentoring experience',
     'Strong knowledge of regional safa styles',
     'Patient and effective communication',
     'Available for both Jaipur & Delhi centers'],
   'trainer', 'amber', false, 20),

  ('sales-supplier-coordinator', 'Sales & Supplier Coordinator', 'Business Development', 'Jaipur (On-site)',
   'Full-time', '1+ year', '₹18,000 – ₹30,000/month',
   'Grow the SafaKing supplier network and keep orders moving between suppliers, artists and customers.',
   array[
     'Onboard and verify new safa suppliers',
     'Follow up on orders and dispatches',
     'Keep product and pricing data accurate',
     'Handle customer and supplier calls',
     'Report weekly on sales and stock'],
   array[
     '1+ year in sales or coordination',
     'Comfortable on the phone all day',
     'Basic computer and spreadsheet skills',
     'Hindi and basic English',
     'Based in or near Jaipur'],
   'business', 'emerald', false, 30),

  ('social-media-content-creator', 'Social Media & Content Creator', 'Marketing', 'Remote / Jaipur',
   'Full-time / Part-time', 'Fresher welcome', '₹12,000 – ₹22,000/month',
   'Create stunning Reels, posts, and content showcasing SafaKing safas, artists, and training. Help us grow our social presence and attract grooms across India.',
   array[
     'Create Instagram & YouTube video content',
     'Shoot behind-the-scenes safa tying videos',
     'Write product captions and campaign copy',
     'Manage daily posting schedule',
     'Track engagement metrics and report'],
   array[
     'Portfolio of social media content',
     'Experience with Reels / short video editing',
     'Eye for Indian wedding aesthetics',
     'Basic Canva / CapCut / Adobe skills',
     'Passion for Indian culture & fashion'],
   'content', 'pink', false, 40)
on conflict (slug) do nothing;

select slug, title, active, sort_order from public.job_openings order by sort_order;
