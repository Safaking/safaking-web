-- ---------------------------------------------------------------------------
-- 017_desktop_inventory_sync.sql
--
-- JoshiSafaHouse (desktop POS, store staff only) and SafaKing (this project,
-- public storefront) stay on two separate Supabase projects/databases — that
-- separation is deliberate, not something to merge away. The one thing that
-- has to agree between them is stock: a safa sold in the shop should not
-- still be sellable on the website, and vice versa.
--
-- `desktop_inventory` is a small local cache: "as of the last successful
-- push from the desktop app, this SKU had this many total and this many
-- already committed (sold + out on rent)." It is written ONLY by the
-- service-role sync endpoint (POST /api/sync/desktop-inventory), never by a
-- browser — RLS below allows public SELECT (the storefront needs to read it
-- to show accurate stock) but no client-side writes at all.
-- ---------------------------------------------------------------------------

create table if not exists public.desktop_inventory (
  sku               text primary key,
  total_quantity    integer not null default 0,
  desktop_committed integer not null default 0,
  updated_at        timestamptz not null default now()
);

alter table public.desktop_inventory enable row level security;

drop policy if exists desktop_inventory_select on public.desktop_inventory;
create policy desktop_inventory_select
  on public.desktop_inventory for select
  using (true);

-- No insert/update/delete policy for anon/authenticated — the sync endpoint
-- uses the service-role key, which bypasses RLS entirely, so this table has
-- no client-writable path at all.

-- ---------------------------------------------------------------------------
-- Availability = products.stock (the web's own baseline) minus whatever the
-- desktop side has committed against the matching SKU (products.code =
-- desktop_inventory.sku), minus what the web itself has committed — the web
-- side of that is computed live from order_items in application code, since
-- it is already local and fast; only the desktop side needs caching.
--
-- Note this intentionally does NOT use desktop_inventory.total_quantity as
-- the baseline — the web keeps its own `stock` as the number staff manage
-- from the web admin panel, and desktop keeps its own `totalQuantity`. If
-- the two shops stock the same SKU independently, each side's baseline is
-- allowed to differ; only "how much the other side has already sold" needs
-- to be shared, so nobody oversells against their own baseline.
-- ---------------------------------------------------------------------------
create or replace view public.products_with_availability
with (security_invoker = true)
as
select
  p.*,
  greatest(
    p.stock - coalesce(d.desktop_committed, 0),
    0
  ) as available_quantity
from public.products p
left join public.desktop_inventory d on d.sku = p.code;
