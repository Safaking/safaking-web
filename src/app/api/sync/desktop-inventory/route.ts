import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * Receives a push from JoshiSafaHouse whenever a SKU's baseline stock or
 * committed (sold + out on rent) quantity changes. This is the only writer
 * of `desktop_inventory` — see supabase/017_desktop_inventory_sync.sql.
 */

function authorized(request: Request): boolean {
  const expected = process.env.SYNC_SHARED_SECRET;
  if (!expected) return false;

  const provided = request.headers.get('x-sync-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { sku?: string; totalQuantity?: number; desktopCommitted?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'malformed body' }, { status: 400 });
  }

  const sku = body.sku?.trim();
  const totalQuantity = Number(body.totalQuantity);
  const desktopCommitted = Number(body.desktopCommitted);

  if (!sku || !Number.isFinite(totalQuantity) || !Number.isFinite(desktopCommitted)) {
    return NextResponse.json({ error: 'sku, totalQuantity and desktopCommitted are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('desktop_inventory').upsert({
    sku,
    total_quantity: totalQuantity,
    desktop_committed: desktopCommitted,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[sync/desktop-inventory]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
