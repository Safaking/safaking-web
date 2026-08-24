import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * Receives a product-listing push from JoshiSafaHouse whenever a product is
 * created or edited there. A brand new SKU lands as an inactive, pending
 * row — invisible on the storefront (RLS: `active or is_admin()`) until an
 * admin reviews it in the Products tab and saves it. An already-known SKU
 * gets its catalogue fields refreshed, but never its `price`, `active`, or
 * `stock` — those stay whatever the web admin set, on purpose (see
 * supabase/018_desktop_product_sync.sql).
 */

interface DesktopProductPayload {
  sku?: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  image?: string | null;
  desktopPrice?: number;
  isRentable?: boolean;
  rentPricePerDay?: number | null;
}

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

  let body: DesktopProductPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'malformed body' }, { status: 400 });
  }

  const sku = body.sku?.trim();
  const name = body.name?.trim();
  const desktopPrice = Number(body.desktopPrice);

  if (!sku || !name || !Number.isFinite(desktopPrice)) {
    return NextResponse.json({ error: 'sku, name and desktopPrice are required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin.from('products').select('id').eq('code', sku).maybeSingle();

  if (existing) {
    const { error } = await admin
      .from('products')
      .update({
        name,
        description: body.description ?? null,
        category: body.category ?? null,
        image: body.image ?? null,
        desktop_price: desktopPrice,
        synced_from_desktop: true,
      })
      .eq('id', existing.id);

    if (error) {
      console.error('[sync/desktop-product]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: 'updated' });
  }

  const { error } = await admin.from('products').insert({
    code: sku,
    name,
    description: body.description ?? null,
    category: body.category ?? null,
    image: body.image ?? null,
    price: desktopPrice, // sensible starting default only — admin can change before approving
    stock: 0, // web keeps its own baseline; starts at 0 until admin stocks it
    is_rentable: !!body.isRentable,
    rent_price_per_day: body.rentPricePerDay ?? null,
    active: false, // invisible until an admin reviews and saves it
    synced_from_desktop: true,
    pending_sync: true,
    desktop_price: desktopPrice,
  });

  if (error) {
    console.error('[sync/desktop-product]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, action: 'created' });
}
