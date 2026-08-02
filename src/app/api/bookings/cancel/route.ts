import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

interface CancelBody {
  rentalId?: string;
  bookingId?: string;
  reason: string;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Whole days between today and the event. Negative once the date has passed. */
function daysUntil(eventDate: string): number {
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const event = new Date(`${eventDate}T00:00:00Z`).getTime();
  return Math.floor((event - start) / 86_400_000);
}

/**
 * Requests cancellation of a paid booking.
 *
 * The refund percentage is read from refund_rules on the server and frozen onto
 * the cancellation row, so a later policy edit cannot change what someone was
 * already promised, and the client cannot propose its own figure.
 *
 * Money is NOT moved here. An admin approves the refund in the panel, which is
 * what actually calls Razorpay — cancellation and payout stay separate steps.
 */
export async function POST(request: Request) {
  let body: CancelBody;
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  const { rentalId, bookingId, reason } = body;

  if (!rentalId && !bookingId) return bad('Nothing to cancel.');
  if (rentalId && bookingId) return bad('Cancel one booking at a time.');
  if (!reason?.trim() || reason.trim().length < 5) {
    return bad('Tell us briefly why you are cancelling.');
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[cancel]', error);
    return bad('Cancellations are not configured yet. Please contact us.', 503);
  }

  // ---- Who is asking -------------------------------------------------------
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return bad('Sign in to cancel a booking.', 401);

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = profile?.role === 'admin';

  // ---- Load the booking and confirm the requester is a party to it ---------
  const table = rentalId ? 'rental_bookings' : 'artist_bookings';
  const id = rentalId ?? bookingId!;
  const dateColumn = rentalId ? 'start_date' : 'event_date';

  const { data: booking, error: loadErr } = await admin
    .from(table)
    .select(`id, customer_id, artist_id, status, payment_status, advance_amount, ${dateColumn}`)
    .eq('id', id)
    .maybeSingle();

  if (loadErr || !booking) return bad('That booking could not be found.', 404);

  const row = booking as unknown as {
    customer_id: string | null; artist_id: string | null;
    status: string; payment_status: string | null; advance_amount: number | null;
    start_date?: string; event_date?: string;
  };

  const isCustomer = row.customer_id === user.id;
  const isArtist = row.artist_id === user.id;

  if (!isCustomer && !isArtist && !isAdmin) {
    return bad('You are not a party to this booking.', 403);
  }
  if (row.status === 'cancelled') return bad('That booking is already cancelled.');
  if (['completed', 'returned'].includes(row.status)) {
    return bad('That event is already finished. Raise a dispute instead.');
  }

  const eventDate = row.start_date ?? row.event_date ?? null;
  if (!eventDate) return bad('That booking has no event date.', 500);

  // ---- Refund entitlement, decided by the database -------------------------
  const daysBefore = daysUntil(eventDate);

  const { data: percentRow, error: percentErr } = await admin.rpc('refund_percent_for', {
    p_days_before: daysBefore,
  });
  if (percentErr) return bad(`Could not read the refund policy: ${percentErr.message}`, 500);

  const advanceAmount = row.advance_amount ?? 0;
  const paid = ['advance_paid', 'fully_paid'].includes(row.payment_status ?? '');

  // An artist pulling out is not the customer's fault, so the customer is made
  // whole regardless of how late it is.
  const refundPercent = isArtist && !isCustomer ? 100 : Number(percentRow ?? 0);
  const refundAmount = paid ? Math.round((advanceAmount * refundPercent) / 100) : 0;

  const requestedRole = isAdmin && !isCustomer && !isArtist
    ? 'admin'
    : isArtist && !isCustomer
    ? 'artist'
    : 'customer';

  const { data: cancellation, error: insertErr } = await admin
    .from('cancellations')
    .insert({
      rental_id: rentalId ?? null,
      booking_id: bookingId ?? null,
      requested_by: user.id,
      requested_role: requestedRole,
      reason: reason.trim(),
      event_date: eventDate,
      days_before: daysBefore,
      refund_percent: refundPercent,
      advance_amount: advanceAmount,
      refund_amount: refundAmount,
      // Unpaid bookings need no refund decision, so they settle immediately.
      status: paid ? 'requested' : 'no_refund',
    })
    .select('id')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      return bad('A cancellation for this booking is already being reviewed.');
    }
    return bad(`Could not record the cancellation: ${insertErr.message}`, 500);
  }

  // The cancellations row now exists, so the paid-booking guard will allow this.
  const { error: statusErr } = await admin
    .from(table)
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (statusErr) {
    await admin.from('cancellations').delete().eq('id', cancellation.id);
    return bad(`Could not cancel the booking: ${statusErr.message}`, 500);
  }

  return NextResponse.json({
    cancellationId: cancellation.id,
    daysBefore,
    refundPercent,
    refundAmount,
    advanceAmount,
    needsRefund: paid && refundAmount > 0,
    message: !paid
      ? 'Booking cancelled. Nothing had been paid, so there is nothing to refund.'
      : refundAmount > 0
      ? `Booking cancelled. ₹${refundAmount.toLocaleString()} (${refundPercent}% of your advance) will be refunded once approved.`
      : 'Booking cancelled. Under the cancellation policy this date is not eligible for a refund.',
  });
}
