import { getStaff } from '@/lib/staff-auth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { CANCEL_REASON_LABEL, isCancelReason, reasonsFor } from '@/lib/cancellation-reasons';

export const runtime = 'nodejs';

interface CancelBody {
  rentalId?: string;
  bookingId?: string;
  reasonCode?: string;
  reason?: string;
}

interface Quote {
  event_at: string | null;
  hours_before: number;
  days_before: number;
  refund_percent: number;
  rule_label: string;
  paid_amount: number;
  tax_amount: number;
  non_refundable_fee: number;
  eligible_amount: number;
  refund_amount: number;
  paid: boolean;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Cancels a booking and records what is owed back.
 *
 * The refund is not calculated here. quote_cancellation() in the database
 * works it out from the event's real start time, the active tiers and the
 * amount actually paid less taxes and non-refundable charges — the same call
 * the customer's preview makes, so the number they were shown is the number
 * that gets recorded, and neither side can supply its own.
 *
 * Money is NOT moved here. Refunds go through verify -> approve -> send ->
 * reconcile in /api/bookings/refund, with different people at each gate.
 */
export async function POST(request: Request) {
  let body: CancelBody;
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  const { rentalId, bookingId } = body;
  const reasonCode = body.reasonCode ?? '';
  const note = body.reason?.trim() ?? '';

  if (!rentalId && !bookingId) return bad('Nothing to cancel.');
  if (rentalId && bookingId) return bad('Cancel one booking at a time.');
  if (!isCancelReason(reasonCode)) return bad('Choose why you are cancelling.');
  if (reasonCode === 'other' && note.length < 5) return bad('Tell us briefly why you are cancelling.');

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[cancel]', error);
    return bad('Cancellations are not configured yet. Please contact us.', 503);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad('Sign in to cancel a booking.', 401);

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = (profile?.role as string | undefined) ?? 'customer';
  let isStaff = false;
  if (role === 'admin' || role === 'manager') {
    const { staff, error: staffErr } = await getStaff();
    if (staffErr) return staffErr;
    if (!staff.can('bookings')) return bad('Your department cannot cancel bookings.', 403);
    isStaff = true;
  }

  const kind = rentalId ? 'rental' : 'booking';
  const table = rentalId ? 'rental_bookings' : 'artist_bookings';
  const id = rentalId ?? bookingId!;

  const { data: row, error: loadErr } = await admin
    .from(table)
    .select('id, customer_id, artist_id, status')
    .eq('id', id)
    .maybeSingle();
  if (loadErr || !row) return bad('That booking could not be found.', 404);

  const isCustomer = row.customer_id === user.id;
  const isArtist = row.artist_id === user.id;
  if (!isCustomer && !isArtist && !isStaff) return bad('You are not a party to this booking.', 403);

  if (['cancelled', 'declined'].includes(row.status)) return bad('That booking is already cancelled.');
  if (['completed', 'returned'].includes(row.status)) {
    return bad('That event is already finished. Raise a complaint from My Bookings instead.');
  }

  const actingAs = isCustomer ? 'customer' : isArtist ? 'artist' : 'staff';
  if (!reasonsFor(actingAs).includes(reasonCode)) return bad('That reason does not apply here.');

  const { data: quoteData, error: quoteErr } = await admin.rpc('quote_cancellation', {
    p_kind: kind,
    p_id: id,
  });
  if (quoteErr || !quoteData) {
    return bad(`Could not calculate the refund: ${quoteErr?.message ?? 'no quote'}`, 500);
  }
  const quote = quoteData as Quote;

  // An artist pulling out is not the customer's doing, so the customer gets
  // the full eligible amount back, however late it is.
  const artistFault = isArtist && !isCustomer;
  const refundPercent = artistFault ? 100 : quote.refund_percent;
  const refundAmount = artistFault ? quote.eligible_amount : quote.refund_amount;
  const ruleLabel = artistFault
    ? 'The artist could not serve this booking — full eligible amount refunded'
    : quote.rule_label;

  // SafaKing failing a booking is 100% by policy — but an employee cannot hand
  // out 100% on their own word. It is recorded at the policy figure with an
  // exception attached, which a second manager or the owner must approve.
  const staffFault = actingAs === 'staff' && reasonCode === 'safaking_fault' && quote.paid;
  const now = new Date().toISOString();

  const { data: cancellation, error: insertErr } = await admin
    .from('cancellations')
    .insert({
      rental_id: rentalId ?? null,
      booking_id: bookingId ?? null,
      requested_by: user.id,
      requested_role: isCustomer ? 'customer' : isArtist ? 'artist' : role,
      reason: [CANCEL_REASON_LABEL[reasonCode], note].filter(Boolean).join(' — '),
      reason_code: reasonCode,
      event_date: quote.event_at ? quote.event_at.slice(0, 10) : null,
      days_before: quote.days_before,
      hours_before: quote.hours_before,
      rule_label: ruleLabel,
      refund_percent: refundPercent,
      advance_amount: quote.paid_amount,
      paid_amount: quote.paid_amount,
      tax_amount: quote.tax_amount,
      non_refundable_fee: quote.non_refundable_fee,
      eligible_amount: quote.eligible_amount,
      refund_amount: refundAmount,
      status: quote.paid && refundAmount > 0 ? 'requested' : 'no_refund',
      ...(staffFault
        ? {
            exception_percent: 100,
            exception_reason: 'SafaKing could not serve this booking',
            exception_requested_by: user.id,
            exception_requested_at: now,
          }
        : {}),
    })
    .select('id')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') return bad('A cancellation for this booking is already being reviewed.');
    return bad(`Could not record the cancellation: ${insertErr.message}`, 500);
  }

  // With the cancellation on record the paid-booking guard allows this, and the
  // artist's schedule, offers and check-in all drop the booking.
  const { error: statusErr } = await admin.from(table).update({ status: 'cancelled' }).eq('id', id);
  if (statusErr) {
    await admin.from('cancellations').delete().eq('id', cancellation.id);
    return bad(`Could not cancel the booking: ${statusErr.message}`, 500);
  }

  const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  return NextResponse.json({
    cancellationId: cancellation.id,
    hoursBefore: quote.hours_before,
    daysBefore: quote.days_before,
    ruleLabel,
    refundPercent,
    paidAmount: quote.paid_amount,
    taxAmount: quote.tax_amount,
    nonRefundableFee: quote.non_refundable_fee,
    eligibleAmount: quote.eligible_amount,
    refundAmount,
    needsRefund: quote.paid && refundAmount > 0,
    exceptionPending: staffFault,
    message: !quote.paid
      ? 'Booking cancelled. Nothing had been paid, so there is nothing to refund.'
      : refundAmount > 0
      ? `Booking cancelled. ${money(refundAmount)} will be refunded to your original payment method once two members of our team have checked and approved it.`
      : `Booking cancelled. ${ruleLabel}.`,
  });
}
