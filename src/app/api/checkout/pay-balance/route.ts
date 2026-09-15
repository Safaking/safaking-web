import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { createRazorpayOrder, publicKeyId, toPaise } from '@/lib/razorpay';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Opens a Razorpay payment for the rest of an order. A supplier sends the
 * parcel only once this is paid (supabase/040). The amount comes from the
 * order row, never from the request, and only the customer who placed the
 * order can pay it here. /api/checkout/verify confirms it.
 */
export async function POST(request: Request) {
  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  const orderId = String(body.orderId ?? '');
  if (!UUID.test(orderId)) return bad('That order was not found.', 404);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad('Please sign in to pay for your order.', 401);

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[pay-balance]', error);
    return bad('Online payment is not set up yet. Please call us to pay the balance.', 503);
  }

  const { data: order } = await admin
    .from('orders')
    .select('id, customer_id, customer_phone, status, payment_status, balance_amount')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || order.customer_id !== user.id) return bad('That order was not found.', 404);
  if (order.status === 'cancelled') return bad('This order was cancelled.');
  if (order.payment_status === 'fully_paid') return bad('This order is already paid in full.');
  if (order.payment_status !== 'advance_paid') return bad('The advance for this order has not been received yet.');

  const balance = Number(order.balance_amount ?? 0);
  if (!(balance > 0)) return bad('Nothing is left to pay on this order.');

  try {
    const rzpOrder = await createRazorpayOrder(toPaise(balance), `safaking_bal_${order.id.slice(0, 8)}`, {
      safaking_order_id: order.id,
      purpose: 'balance',
    });

    const { error: paymentErr } = await admin.from('payments').insert({
      order_id: order.id,
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      status: 'created',
      purpose: 'balance',
      notes: { balance_amount: balance },
    });
    if (paymentErr) return bad(`Could not start the payment: ${paymentErr.message}`, 500);

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: publicKeyId(),
      balanceAmount: balance,
      customerPhone: order.customer_phone,
    });
  } catch (error) {
    return bad(error instanceof Error ? error.message : 'Payment setup failed.', 502);
  }
}
