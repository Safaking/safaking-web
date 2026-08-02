import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Emergency replacement (spec item 7).
 *
 * GET  ?rentalId=… | ?bookingId=…  -> artists who could step in right now
 * POST { …, replacementArtistId }  -> reassign the booking to that artist
 *
 * Admin only. Reassigning mid-event changes who is legally expected at a venue,
 * which is not a decision to hand to either party in the dispute.
 */
async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: null, error: bad('Sign in.', 401) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).maybeSingle();

  if (profile?.role !== 'admin') {
    return { user, admin, error: bad('Administrators only.', 403) };
  }
  return { user, admin, error: null };
}

async function loadBooking(
  admin: ReturnType<typeof createAdminClient>,
  rentalId?: string | null,
  bookingId?: string | null
) {
  if (rentalId) {
    const { data } = await admin
      .from('rental_bookings')
      .select('id, artist_id, artist_name, pincode, start_date, customer_name, customer_phone, safa_count')
      .eq('id', rentalId)
      .maybeSingle();
    return data
      ? {
          table: 'rental_bookings' as const,
          id: data.id,
          artistId: data.artist_id,
          pincode: data.pincode,
          date: data.start_date,
          customerName: data.customer_name,
          safaCount: data.safa_count,
        }
      : null;
  }

  const { data } = await admin
    .from('artist_bookings')
    .select('id, artist_id, artist_name, city_venue, event_date, customer_name')
    .eq('id', bookingId!)
    .maybeSingle();

  if (!data) return null;

  // artist_bookings stores the pincode inside the free-text venue string, so it
  // has to be recovered rather than read from a column.
  const pincode = data.city_venue?.match(/\b(\d{6})\b/)?.[1] ?? null;

  return {
    table: 'artist_bookings' as const,
    id: data.id,
    artistId: data.artist_id,
    pincode,
    date: data.event_date,
    customerName: data.customer_name,
    safaCount: null as number | null,
  };
}

export async function GET(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const url = new URL(request.url);
  const rentalId = url.searchParams.get('rentalId');
  const bookingId = url.searchParams.get('bookingId');
  if (!rentalId && !bookingId) return bad('Which booking?');

  const booking = await loadBooking(admin!, rentalId, bookingId);
  if (!booking) return bad('Booking not found.', 404);

  if (!booking.pincode) {
    return bad(
      'This booking has no pincode on record, so nearby artists cannot be suggested. Assign one manually.',
      409
    );
  }

  const { data, error: matchErr } = await admin!.rpc('emergency_matches', {
    p_pincode: booking.pincode,
    p_date: booking.date,
    p_exclude: booking.artistId,
  });

  if (matchErr) return bad(`Could not find replacements: ${matchErr.message}`, 500);

  return NextResponse.json({
    booking: {
      id: booking.id,
      pincode: booking.pincode,
      date: booking.date,
      customerName: booking.customerName,
      safaCount: booking.safaCount,
      currentArtistId: booking.artistId,
    },
    candidates: data ?? [],
  });
}

export async function POST(request: Request) {
  const { user, admin, error } = await requireAdmin();
  if (error) return error;

  let body: {
    rentalId?: string;
    bookingId?: string;
    replacementArtistId: string;
    reason: string;
  };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  const { rentalId, bookingId, replacementArtistId, reason } = body;

  if (!rentalId && !bookingId) return bad('Which booking?');
  if (!replacementArtistId) return bad('Choose a replacement artist.');
  if (!reason?.trim()) return bad('Record why the artist is being replaced.');

  const booking = await loadBooking(admin!, rentalId, bookingId);
  if (!booking) return bad('Booking not found.', 404);

  if (booking.artistId === replacementArtistId) {
    return bad('That is already the assigned artist.');
  }

  const { data: replacement } = await admin!
    .from('artist_profiles')
    .select('id, display_name, active')
    .eq('id', replacementArtistId)
    .maybeSingle();

  if (!replacement || !replacement.active) {
    return bad('That artist is not available.', 409);
  }

  // Re-check availability at the moment of assignment — the candidate list may
  // be seconds old, and double-booking the rescue artist would compound the
  // original failure.
  const { data: isFree } = await admin!.rpc('artist_is_free', {
    p_artist_id: replacementArtistId,
    p_date: booking.date,
  });

  if (isFree === false) {
    return bad(
      `${replacement.display_name} has just been booked for that date. Pick another artist.`,
      409
    );
  }

  const { error: reassignErr } = await admin!
    .from(booking.table)
    .update({ artist_id: replacementArtistId, artist_name: replacement.display_name })
    .eq('id', booking.id);

  if (reassignErr) return bad(`Could not reassign: ${reassignErr.message}`, 500);

  const { data: record, error: recordErr } = await admin!
    .from('replacement_requests')
    .insert({
      rental_id: rentalId ?? null,
      booking_id: bookingId ?? null,
      original_artist_id: booking.artistId,
      replacement_artist_id: replacementArtistId,
      reason: reason.trim(),
      status: 'assigned',
      raised_by: user!.id,
      resolved_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (recordErr) {
    // The reassignment already happened; surface it rather than pretending the
    // whole operation failed and inviting a second reassignment.
    return NextResponse.json({
      success: true,
      warning: `Artist reassigned, but the replacement record failed to save: ${recordErr.message}`,
      replacementArtistName: replacement.display_name,
    });
  }

  return NextResponse.json({
    success: true,
    replacementId: record.id,
    replacementArtistName: replacement.display_name,
  });
}
