-- ---------------------------------------------------------------------------
-- 018_desktop_product_sync.sql
--
-- Lets products created in JoshiSafaHouse's desktop app show up in
-- SafaKing's web catalogue automatically — but never live/public without an
-- admin actually looking at it first, and never with a price the admin
-- didn't choose. Desktop's price is carried along only as a reference
-- (`desktop_price`); it is never written into `price` after the first
-- import, so the two shops can charge differently on purpose.
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists synced_from_desktop boolean not null default false,
  add column if not exists pending_sync boolean not null default false,
  add column if not exists desktop_price numeric;

comment on column public.products.pending_sync is
  'True only until an admin first reviews/saves a product that arrived via '
  'desktop sync — see POST /api/sync/desktop-product. Cleared on first save '
  'from the admin panel, same row after that behaves like any other product.';
comment on column public.products.desktop_price is
  'Reference only — what JoshiSafaHouse currently charges for this SKU. '
  'Never auto-applied to `price`; shown in the admin panel so a human '
  'decides whether the web price should follow it.';
