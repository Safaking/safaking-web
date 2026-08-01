import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { createRazorpayOrder, publicKeyId, toPaise } from '@/lib/razorpay';

export const runtime = 'nodejs';

/** Fallback only — the real rate lives in app_settings.advance_rate. */
const DEFAULT_ADVANCE_RATE = 0.2;

interface CartLine {
  productId: string;
  quantity: number;
}

interface CreateOrderBody {
  items: CartLine[];
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  pincode: string;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Creates a Razorpay order and the matching pending SafaKing order.
 *
 * The request body carries only product ids and quantities. Every price, the
 * line total, the order total and the advance are recomputed here from the
 * products table — the client cannot influence what is charged.
 */
export async function POST(request: Request) {
  let body: CreateOrderBody;
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  const { items, customerName, customerPhone, shippingAddress, pincode } = body;

  if (!Array.isArray(items) || items.length === 0) return bad('Your bag is empty.');
  if (items.length > 50) return bad('Too many items in one order.');
  if (!customerName?.trim()) return bad('Full name is required.');
  if (!customerPhone?.trim()) return bad('Phone number is required.');
  if (!shippingAddress?.trim()) return bad('Shipping address is required.');

  // Normalise and reject anything malformed before touching the network.
  const lines: CartLine[] = [];
  for (const item of items) {
    const quantity = Number(item?.quantity);
    if (!item?.productId || typeof item.productId !== 'string') {
      return bad('This bag contains an item that is no longer in the catalogue. Please clear it and add the item again.');
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return bad('Item quantity must be a whole number between 1 and 99.');
    }
    lines.push({ productId: item.productId, quantity });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    // Misconfiguration, not a customer mistake — say so without leaking keys.
    console.error('[checkout]', error);
    return bad('Payments are not configured yet. Please contact us to place this order.', 503);
  }

  // ---- Who is ordering (optional: guest checkout is allowed) --------------
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* read-only in a route handler */
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ---- Deliverability -----------------------------------------------------
  const cleanPincode = String(pincode ?? '').replace(/\D/g, '');
  if (cleanPincode.length !== 6) return bad('Enter a valid 6-digit pincode.');

  const { data: pin } = await admin
    .from('deliverable_pincodes')
    .select('pincode')
    .eq('pincode', cleanPincode)
    .eq('active', true)
    .maybeSingle();

  if (!pin) return bad(`We do not deliver to ${cleanPincode} yet.`);

  // ---- Authoritative pricing ---------------------------------------------
  const { data: products, error: productErr } = await admin
    .from('products')
    .select('id, name, price, stock, active')
    .in('id', lines.map((l) => l.productId));

  if (productErr) return bad(`Could not price this order: ${productErr.message}`, 500);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const priced: { productId: string; name: string; price: number; quantity: number }[] = [];

  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product || !product.active) {
      return bad('One of the safas in your bag is no longer available. Please review your bag.');
    }
    if (product.stock < line.quantity) {
      return bad(
        `Only ${product.stock} left of "${product.name}". Please reduce the quantity.`
      );
    }
    priced.push({
      productId: product.id,
      name: product.name,
      price: product.price, // <- from the database, never from the request
      quantity: line.quantity,
    });
  }

  // Advance percentage is admin-controlled (10-30% per the business rules), so
  // it is read from the database rather than hardcoded.
  const { data: rateRow } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'advance_rate')
    .maybeSingle();

  const advanceRate = Number(rateRow?.value ?? DEFAULT_ADVANCE_RATE);

  const totalAmount = priced.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const advanceAmount = Math.round(totalAmount * advanceRate);
  const balanceAmount = totalAmount - advanceAmount;

  if (totalAmount <= 0) return bad('Order total must be greater than zero.');

  // ---- Create the SafaKing order first, so a payment always has a home ----
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      customer_id: user?.id ?? null,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: user?.email ?? null,
      shipping_address: `${shippingAddress.trim()} (Pincode: ${cleanPincode})`,
      total_amount: totalAmount,
      advance_amount: advanceAmount,
      balance_amount: balanceAmount,
      payment_status: 'advance_pending',
      status: 'pending',
    })
    .select('id')
    .single();

  if (orderErr || !order) {
    return bad(`Could not create the order: ${orderErr?.message ?? 'unknown error'}`, 500);
  }

  const { error: itemsErr } = await admin.from('order_items').insert(
    priced.map((l) => ({
      order_id: order.id,
      product_id: l.productId,
      product_name: l.name,
      price: l.price,
      quantity: l.quantity,
    }))
  );

  if (itemsErr) {
    await admin.from('orders').delete().eq('id', order.id); // don't leave a half order
    return bad(`Could not save the order items: ${itemsErr.message}`, 500);
  }

  // ---- Razorpay -----------------------------------------------------------
  try {
    const rzpOrder = await createRazorpayOrder(
      toPaise(advanceAmount),
      `safaking_${order.id.slice(0, 8)}`,
      { safaking_order_id: order.id, customer_phone: customerPhone.trim() }
    );

    await admin.from('orders').update({ razorpay_order_id: rzpOrder.id }).eq('id', order.id);

    await admin.from('payments').insert({
      order_id: order.id,
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      status: 'created',
      notes: { total_amount: totalAmount, advance_amount: advanceAmount },
    });

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: publicKeyId(),
      // Echoed back so the UI shows the server's figures, not its own guess.
      totalAmount,
      advanceAmount,
      balanceAmount,
      advanceRate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment setup failed.';
    await admin
      .from('orders')
      .update({ status: 'cancelled', payment_status: 'failed' })
      .eq('id', order.id);
    return bad(message, 502);
  }
}
