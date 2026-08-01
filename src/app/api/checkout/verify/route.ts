import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { verifyPaymentSignature } from '@/lib/razorpay';

export const runtime = 'nodejs';

interface VerifyBody {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Confirms a Razorpay payment.
 *
 * The signature is the whole security model here: the browser reports success,
 * and only an HMAC that could have been produced by our key secret makes that
 * report believable. An unsigned or mis-signed call marks the payment failed.
 */
export async function POST(request: Request) {
  let body: VerifyBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Incomplete payment confirmation.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[verify]', error);
    return NextResponse.json(
      { error: 'Payments are not configured. Contact us with your payment id before retrying.' },
      { status: 503 }
    );
  }

  const { data: payment } = await admin
    .from('payments')
    .select('id, order_id, status')
    .eq('razorpay_order_id', razorpay_order_id)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: 'Unknown payment reference.' }, { status: 404 });
  }

  // Replay of an already-verified payment: succeed without touching stock again.
  if (payment.status === 'paid') {
    return NextResponse.json({ success: true, orderId: payment.order_id, alreadyVerified: true });
  }

  const signatureValid = verifyPaymentSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!signatureValid) {
    await admin.from('payments').update({ status: 'failed' }).eq('id', payment.id);
    if (payment.order_id) {
      await admin
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', payment.order_id);
    }
    return NextResponse.json({ error: 'Payment signature verification failed.' }, { status: 400 });
  }

  await admin
    .from('payments')
    .update({
      razorpay_payment_id,
      razorpay_signature,
      status: 'paid',
      verified_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  if (!payment.order_id) {
    return NextResponse.json({ success: true, orderId: null });
  }

  await admin
    .from('orders')
    .update({ payment_status: 'advance_paid', razorpay_payment_id })
    .eq('id', payment.order_id);

  // Reserve the physical stock now that money has actually arrived.
  // Returns any line we could not satisfy; the payment still stands, so the
  // order is flagged for the admin rather than silently overselling.
  const { data: shortfalls, error: stockErr } = await admin.rpc('apply_order_stock', {
    p_order_id: payment.order_id,
  });

  if (stockErr) {
    return NextResponse.json({
      success: true,
      orderId: payment.order_id,
      warning: `Payment recorded, but stock could not be updated: ${stockErr.message}`,
    });
  }

  if (Array.isArray(shortfalls) && shortfalls.length > 0) {
    const detail = shortfalls
      .map((s: { product_name: string; shortfall: number }) => `${s.product_name} (short ${s.shortfall})`)
      .join(', ');

    await admin
      .from('orders')
      .update({ status: 'pending', notes: `STOCK SHORTFALL: ${detail}` })
      .eq('id', payment.order_id);

    return NextResponse.json({
      success: true,
      orderId: payment.order_id,
      warning: 'Payment received. Some items are short in stock; our team will contact you.',
    });
  }

  return NextResponse.json({ success: true, orderId: payment.order_id });
}
