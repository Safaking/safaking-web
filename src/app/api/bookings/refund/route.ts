import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { refundPayment, toPaise } from '@/lib/razorpay';

export const runtime = 'nodejs';

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Admin-only: pays out an approved cancellation refund via Razorpay.
 *
 * Deliberately separate from /cancel. Cancelling releases the date immediately —
 * the customer should not wait on a payment gateway for that — while moving
 * money stays a decision a human makes, with the amount already fixed by the
 * policy at cancellation time.
 */
export async function POST(request: Request) {
  let body: { cancellationId: string; approve: boolean; adminNote?: string };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  if (!body.cancellationId) return bad('Which cancellation?');

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[refund]', error);
    return bad('Refunds are not configured yet.', 503);
  }

  // ---- Admin only ---------------------------------------------------------
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad('Sign in.', 401);

  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return bad('Administrators only.', 403);

  // ---- Load the cancellation ----------------------------------------------
  const { data: cancellation, error: loadErr } = await admin
    .from('cancellations')
    .select('*')
    .eq('id', body.cancellationId)
    .maybeSingle();

  if (loadErr || !cancellation) return bad('Cancellation not found.', 404);

  if (['refunded', 'rejected', 'no_refund'].includes(cancellation.status)) {
    return bad(`This cancellation is already ${cancellation.status}.`);
  }

  if (!body.approve) {
    await admin
      .from('cancellations')
      .update({
        status: 'rejected',
        admin_note: body.adminNote?.trim() ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', cancellation.id);

    return NextResponse.json({ success: true, refunded: false });
  }

  if (cancellation.refund_amount <= 0) {
    await admin
      .from('cancellations')
      .update({
        status: 'no_refund',
        admin_note: body.adminNote?.trim() ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', cancellation.id);

    return NextResponse.json({ success: true, refunded: false, amount: 0 });
  }

  // ---- Find the captured payment to refund against ------------------------
  const paymentQuery = admin.from('payments').select('razorpay_payment_id, amount, status');
  const { data: payment } = cancellation.rental_id
    ? await paymentQuery.eq('rental_id', cancellation.rental_id).eq('status', 'paid').maybeSingle()
    : await paymentQuery.eq('order_id', cancellation.order_id).eq('status', 'paid').maybeSingle();

  if (!payment?.razorpay_payment_id) {
    return bad(
      'No verified Razorpay payment is on file for this booking, so there is nothing to refund automatically. Settle it manually and add a note.',
      409
    );
  }

  const refundPaise = toPaise(cancellation.refund_amount);

  // Never try to return more than was actually captured.
  if (refundPaise > payment.amount) {
    return bad(
      `Refund (₹${cancellation.refund_amount}) exceeds the ₹${payment.amount / 100} captured. Check the policy calculation.`,
      409
    );
  }

  try {
    const refund = await refundPayment(payment.razorpay_payment_id, refundPaise, {
      cancellation_id: cancellation.id,
      reason: cancellation.reason.slice(0, 100),
    });

    await admin
      .from('cancellations')
      .update({
        status: 'refunded',
        razorpay_refund_id: refund.id,
        admin_note: body.adminNote?.trim() ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', cancellation.id);

    return NextResponse.json({
      success: true,
      refunded: true,
      amount: cancellation.refund_amount,
      refundId: refund.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refund failed.';
    // Leave the row in 'requested' so it can be retried rather than lost.
    await admin
      .from('cancellations')
      .update({ admin_note: `Refund attempt failed: ${message}` })
      .eq('id', cancellation.id);

    return bad(message, 502);
  }
}
