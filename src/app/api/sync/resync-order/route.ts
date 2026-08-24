import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { pushWebCommittedForSkus, skusForOrder } from '@/lib/desktop-sync';

export const runtime = 'nodejs';

/**
 * Called from the admin panel after any order status change (e.g. cancelling
 * an order frees up stock the desktop POS should see again). Recomputes and
 * pushes the current web-committed count for every SKU on that order.
 */
export async function POST(request: Request) {
  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'malformed body' }, { status: 400 });
  }

  if (!body.orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const skus = await skusForOrder(admin, body.orderId);
  await pushWebCommittedForSkus(admin, skus);

  return NextResponse.json({ ok: true, skus });
}
