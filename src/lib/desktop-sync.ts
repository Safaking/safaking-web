import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Pushes "how many of this SKU the web has committed" to JoshiSafaHouse's
 * desktop POS, so its own availability figure accounts for web sales too.
 * SERVER ONLY.
 *
 * Best-effort: a sale or checkout must never fail because the other
 * project is briefly unreachable. Failures are logged, not thrown — the
 * desktop side's cached number just goes stale until the next successful
 * push, same trade-off as the desktop -> web direction (see
 * safa-king/supabase/017_desktop_inventory_sync.sql's header).
 */
export async function pushWebCommittedForSkus(admin: SupabaseClient, skus: string[]) {
  const uniqueSkus = [...new Set(skus.filter(Boolean))];
  if (uniqueSkus.length === 0) return;

  const desktopSyncUrl = process.env.DESKTOP_SYNC_URL;
  const secret = process.env.SYNC_SHARED_SECRET;
  if (!desktopSyncUrl || !secret) {
    console.warn('[desktop-sync] DESKTOP_SYNC_URL or SYNC_SHARED_SECRET not set — skipping push.');
    return;
  }

  await Promise.all(
    uniqueSkus.map(async (sku) => {
      try {
        const webCommitted = await computeWebCommittedForSku(admin, sku);
        const res = await fetch(desktopSyncUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-sync-secret': secret },
          body: JSON.stringify({ sku, webCommitted }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          console.warn(`[desktop-sync] push for ${sku} responded ${res.status}`);
        }
      } catch (err) {
        console.warn(`[desktop-sync] push for ${sku} failed:`, err instanceof Error ? err.message : err);
      }
    })
  );
}

/** Every safa committed to a non-cancelled order, for the product with this SKU (`products.code`). */
async function computeWebCommittedForSku(admin: SupabaseClient, sku: string): Promise<number> {
  const { data: product } = await admin.from('products').select('id').eq('code', sku).maybeSingle();
  if (!product) return 0;

  const { data: orderItems, error } = await admin
    .from('order_items')
    .select('quantity, orders!inner(status)')
    .eq('product_id', product.id)
    .neq('orders.status', 'cancelled');

  if (error) {
    console.warn(`[desktop-sync] could not compute web-committed for ${sku}:`, error.message);
    return 0;
  }

  return (orderItems ?? []).reduce((sum, row) => sum + (row.quantity ?? 0), 0);
}

/** SKUs (products.code) for every line item on an order — used to resync after any status change. */
export async function skusForOrder(admin: SupabaseClient, orderId: string): Promise<string[]> {
  const { data, error } = await admin
    .from('order_items')
    .select('products(code)')
    .eq('order_id', orderId);

  if (error) {
    console.warn(`[desktop-sync] could not load SKUs for order ${orderId}:`, error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => (row.products as unknown as { code: string | null } | null)?.code)
    .filter((code): code is string => !!code);
}
