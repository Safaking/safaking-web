-- ---------------------------------------------------------------------------
-- 020_product_gallery.sql
--
-- Multi-image product galleries (Flipkart/Amazon style — a main photo plus
-- alternate angles/close-ups). `products.image` stays the single "main"
-- photo used everywhere today (cards, listings); this table holds the
-- ADDITIONAL photos shown in the product detail/quick-view gallery.
--
-- Populated by the desktop app's product sync (see
-- POST /api/sync/desktop-product) — same pattern as the rest of the
-- catalogue sync, replace-all-for-product on every push so deleting an
-- alternate photo on desktop removes it here too.
-- ---------------------------------------------------------------------------

create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_id_idx on public.product_images(product_id);

alter table public.product_images enable row level security;

drop policy if exists product_images_select on public.product_images;
create policy product_images_select
  on public.product_images for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and (p.active or public.is_admin())
    )
  );

drop policy if exists product_images_admin_write on public.product_images;
create policy product_images_admin_write
  on public.product_images for all
  using (public.is_admin())
  with check (public.is_admin());

-- No client-writable path beyond that — the sync endpoint uses the
-- service-role key, which bypasses RLS entirely, same as every other
-- sync-populated table.

-- ---------------------------------------------------------------------------
-- Fold the gallery into the existing availability view so the storefront
-- gets it in the same round trip. `create or replace view` can't be used
-- here — `p.*` now expands to more columns than when the view was first
-- created (018 added synced_from_desktop/pending_sync/desktop_price after
-- the fact), which breaks replace-view's "same column positions" rule — so
-- this drops and recreates it instead.
-- ---------------------------------------------------------------------------
drop view if exists public.products_with_availability;

create view public.products_with_availability
with (security_invoker = true)
as
select
  p.*,
  greatest(p.stock - coalesce(d.desktop_committed, 0), 0) as available_quantity,
  coalesce(
    (select array_agg(pi.url order by pi.sort_order) from public.product_images pi where pi.product_id = p.id),
    array[]::text[]
  ) as gallery_images
from public.products p
left join public.desktop_inventory d on d.sku = p.code;
