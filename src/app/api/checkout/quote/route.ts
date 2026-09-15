import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QuoteBody {
  items?: { productId?: string }[];
  pincode?: string;
}

const none = { shippingAmount: 0, hasSupplierItems: false, dispatchDays: 0 };

/**
 * The delivery charge for a bag, before checkout. Writes nothing. It says
 * what the customer pays — never which suppliers are in the bag or where they
 * are. Checkout works the charge out again for itself.
 */
export async function POST(request: Request) {
  let body: QuoteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const ids = [
    ...new Set(
      (Array.isArray(body.items) ? body.items : [])
        .map((item) => item?.productId)
        .filter((id): id is string => typeof id === 'string' && UUID.test(id))
    ),
  ].slice(0, 50);
  if (ids.length === 0) return NextResponse.json(none);

  const pincode = String(body.pincode ?? '').replace(/\D/g, '');
  if (pincode.length !== 6) {
    return NextResponse.json({ error: 'Enter a valid 6-digit pincode.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[checkout/quote]', error);
    return NextResponse.json({ error: 'Checkout is not configured yet.' }, { status: 503 });
  }

  const { data: products, error: productErr } = await admin.from('products').select('id, supplier_id').in('id', ids);
  if (productErr) return NextResponse.json({ error: 'Could not work out delivery.' }, { status: 500 });

  const supplierProductIds = (products ?? []).filter((p) => p.supplier_id).map((p) => p.id);
  if (supplierProductIds.length === 0) return NextResponse.json(none);

  const { data: quote, error: quoteErr } = await admin.rpc('quote_supplier_shipping', {
    p_product_ids: supplierProductIds,
    p_pincode: pincode,
  });
  if (quoteErr) {
    return NextResponse.json(
      { error: quoteErr.code === 'P0001' ? quoteErr.message : 'Could not work out delivery.' },
      { status: 400 }
    );
  }

  const charges = (quote ?? []) as { amount: number | null; dispatch_days: number | null }[];
  if (charges.some((c) => c.amount == null)) {
    return NextResponse.json({ error: 'One of the items cannot be delivered to this pincode right now.' }, { status: 400 });
  }

  return NextResponse.json({
    shippingAmount: charges.reduce((sum, c) => sum + Number(c.amount), 0),
    hasSupplierItems: true,
    dispatchDays: charges.reduce((most, c) => Math.max(most, Number(c.dispatch_days ?? 0)), 0),
  });
}
