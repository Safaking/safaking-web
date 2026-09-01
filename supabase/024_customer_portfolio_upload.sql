-- App module.docx item 23 (Event Photo Collection): after an event, a
-- customer can upload a photo that joins the artist's portfolio — pending
-- the artist's own approval before it goes public (portfolio_items already
-- defaults to admin-moderated via `visible`; this extends that same gate to
-- customer-submitted items instead of only artist/admin-submitted ones).

alter table public.portfolio_items
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null;

-- Looser than can_review() (no specific rental/booking id needed) — a photo
-- upload isn't tied to one particular booking record the way a review is;
-- any completed engagement between this customer and this artist qualifies.
create or replace function public.has_completed_booking_with(p_customer uuid, p_artist uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rental_bookings
    where customer_id = p_customer and artist_id = p_artist and status in ('returned', 'completed')
  ) or exists (
    select 1 from public.artist_bookings
    where customer_id = p_customer and artist_id = p_artist and status = 'completed'
  );
$$;

-- A customer may add a portfolio item for an artist they actually booked;
-- it always lands hidden regardless of what the client sends, pending that
-- artist's approval (they already have full update rights on their own rows).
drop policy if exists portfolio_customer_insert on public.portfolio_items;
create policy portfolio_customer_insert on public.portfolio_items
  for insert with check (
    submitted_by = auth.uid()
    and public.has_completed_booking_with(auth.uid(), artist_id)
  );

create or replace function public.guard_customer_portfolio_visibility()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.submitted_by is not null and new.artist_id <> auth.uid() and not public.is_admin() then
    new.visible := false;
  end if;
  return new;
end; $$;

drop trigger if exists portfolio_guard_customer_visibility on public.portfolio_items;
create trigger portfolio_guard_customer_visibility
  before insert on public.portfolio_items
  for each row execute function public.guard_customer_portfolio_visibility();

-- Storage: a customer may upload into an artist's portfolio folder under the
-- same completed-booking gate.
drop policy if exists portfolio_upload_by_customer on storage.objects;
create policy portfolio_upload_by_customer on storage.objects
  for insert with check (
    bucket_id = 'portfolio'
    and auth.uid() is not null
    and public.has_completed_booking_with(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
