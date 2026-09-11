import { getStaff } from '@/lib/staff-auth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { INCIDENT_LABEL, IncidentKind } from '@/lib/artist-standing';
import { sendOpsIncidentEmail, sendCustomerReplacementEmail } from '@/lib/email';

export const runtime = 'nodejs';

const KINDS: IncidentKind[] = ['withdrew_after_accept', 'no_show', 'late_arrival', 'complaint_upheld'];

interface Body {
  bookingId?: string;
  rentalId?: string;
  kind?: IncidentKind;
  reason?: string;
}

interface Candidate {
  id: string;
  display_name: string;
  base_city: string | null;
  rating: number | null;
  match_rank: number;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * An artist incident, and everything the owner's rule says must follow it.
 *
 *   1. the reason is recorded
 *   2. operations are told
 *   3. backup artists are searched for
 *   4. the customer is told their booking stands
 *   5. the booking is freed for a replacement
 *   6. the incident is on the artist's record
 *
 * An artist can only record pulling out of a booking they accepted. Staff can
 * also record a no-show or a late arrival. Declining an OFFER is not an
 * incident — nothing had been promised yet.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  const { bookingId, rentalId, kind } = body;
  const reason = body.reason?.trim() ?? '';
  if (!bookingId && !rentalId) return bad('Which booking?');
  if (bookingId && rentalId) return bad('One booking at a time.');
  if (!kind || !KINDS.includes(kind)) return bad('Unknown incident type.');
  if (reason.length < 10) return bad('Please explain what happened in a little more detail.');

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[incident]', error);
    return bad('Not configured yet.', 503);
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
  if (!user) return bad('Sign in.', 401);

  const { data: me } = await admin.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
  let isStaff = false;
  if (me?.role === 'admin' || me?.role === 'manager') {
    const { staff, error: staffErr } = await getStaff();
    if (staffErr) return staffErr;
    isStaff = staff.can('bookings');
  }

  // ---- The booking ---------------------------------------------------------
  type Row = {
    id: string; artist_id: string | null; artist_name: string | null; customer_id: string | null;
    customer_name: string; status: string; date: string; pincode: string | null; customer_email: string | null;
  };
  let row: Row | null = null;

  if (bookingId) {
    const { data } = await admin
      .from('artist_bookings')
      .select('id, artist_id, artist_name, customer_id, customer_name, status, event_date, city_venue')
      .eq('id', bookingId)
      .maybeSingle();
    if (data) {
      row = {
        id: data.id, artist_id: data.artist_id, artist_name: data.artist_name, customer_id: data.customer_id,
        customer_name: data.customer_name, status: data.status, date: data.event_date,
        pincode: (data.city_venue as string | null)?.match(/\b(\d{6})\b/)?.[1] ?? null, customer_email: null,
      };
    }
  } else {
    const { data } = await admin
      .from('rental_bookings')
      .select('id, artist_id, artist_name, customer_id, customer_name, customer_email, status, start_date, pincode')
      .eq('id', rentalId!)
      .maybeSingle();
    if (data) {
      row = {
        id: data.id, artist_id: data.artist_id, artist_name: data.artist_name, customer_id: data.customer_id,
        customer_name: data.customer_name, status: data.status, date: data.start_date,
        pincode: data.pincode, customer_email: data.customer_email,
      };
    }
  }
  if (!row) return bad('Booking not found.', 404);
  if (!row.artist_id) return bad('No artist is on this booking.');

  const isTheArtist = row.artist_id === user.id;
  if (!isTheArtist && !isStaff) return bad('You are not the artist on this booking.', 403);
  if (isTheArtist && !isStaff) {
    if (kind !== 'withdrew_after_accept') return bad('Artists can only record pulling out of a booking.', 403);
    const accepted = bookingId ? row.status === 'assigned' : ['confirmed', 'dispatched'].includes(row.status);
    if (!accepted) return bad('Only a booking you have accepted can be pulled out of. To turn down an offer, decline it.');
  }
  if (['cancelled', 'completed', 'returned'].includes(row.status)) return bad('That booking is already closed.');

  const artistId = row.artist_id;
  const freesBooking = kind === 'withdrew_after_accept' || kind === 'no_show';

  // ---- 3. Backup search, before the booking is freed -----------------------
  let candidates: Candidate[] = [];
  if (freesBooking && row.pincode) {
    const { data } = await admin.rpc('emergency_matches', {
      p_pincode: row.pincode,
      p_date: row.date,
      p_exclude: artistId,
    });
    candidates = ((data ?? []) as Candidate[]).slice(0, 5).map((c) => ({
      id: c.id, display_name: c.display_name, base_city: c.base_city, rating: c.rating, match_rank: c.match_rank,
    }));
  }

  // ---- 1 + 6. The record ---------------------------------------------------
  const { data: incident, error: insertErr } = await admin
    .from('artist_incidents')
    .insert({
      artist_id: artistId,
      booking_id: bookingId ?? null,
      rental_id: rentalId ?? null,
      kind,
      reason,
      reported_by: user.id,
      reported_role: isTheArtist && !isStaff ? 'artist' : me?.role ?? 'staff',
      backup_candidates: candidates,
    })
    .select('id, points')
    .single();
  if (insertErr) return bad(`Could not record the incident: ${insertErr.message}`, 500);

  // ---- 5. Free the booking for a replacement -------------------------------
  if (freesBooking) {
    const table = bookingId ? 'artist_bookings' : 'rental_bookings';
    const patch = bookingId
      ? { artist_id: null, artist_name: null, status: 'pending' }
      : { artist_id: null, artist_name: null };
    const { error: freeErr } = await admin.from(table).update(patch).eq('id', row.id);
    if (freeErr) {
      return NextResponse.json({
        incidentId: incident.id,
        warning: `Incident recorded, but the booking could not be freed: ${freeErr.message}. Reassign it by hand.`,
        candidates,
      });
    }
  }

  const label = INCIDENT_LABEL[kind];
  const now = new Date().toISOString();

  // ---- 2. Operations — best effort, the incident is already on record ------
  const { data: staff } = await admin.from('profiles').select('email').in('role', ['admin', 'manager']).not('email', 'is', null);
  const staffEmails = ((staff ?? []) as { email: string }[]).map((s) => s.email).filter(Boolean);
  if (staffEmails.length > 0) {
    const results = await Promise.all(
      staffEmails.map((to) =>
        sendOpsIncidentEmail({
          to,
          artistName: row!.artist_name ?? 'An artist',
          incident: label,
          reason,
          eventDate: row!.date,
          customerName: row!.customer_name,
          backupCount: candidates.length,
          freed: freesBooking,
        }).catch(() => ({ ok: false }))
      )
    );
    if (results.some((r) => r?.ok)) {
      await admin.from('artist_incidents').update({ ops_notified_at: now }).eq('id', incident.id);
    }
  }

  // ---- 4. The customer — their booking stands ------------------------------
  if (freesBooking) {
    let customerEmail = row.customer_email;
    if (!customerEmail && row.customer_id) {
      const { data: c } = await admin.from('profiles').select('email').eq('id', row.customer_id).maybeSingle();
      customerEmail = c?.email ?? null;
    }
    if (customerEmail) {
      const sent = await sendCustomerReplacementEmail({
        to: customerEmail, name: row.customer_name, eventDate: row.date,
      }).catch(() => ({ ok: false }));
      if (sent?.ok) {
        await admin.from('artist_incidents').update({ customer_notified_at: now }).eq('id', incident.id);
      }
    }
  }

  const { data: recommendation } = await admin.rpc('artist_standing_recommendation', { p_artist_id: artistId });

  return NextResponse.json({
    incidentId: incident.id,
    points: incident.points,
    candidates,
    recommendation,
    message: isTheArtist && !isStaff
      ? 'Recorded. SafaKing has been told and is arranging another artist for the customer. This counts toward your standing.'
      : `${label} recorded against ${row.artist_name ?? 'the artist'}.${freesBooking ? ` The booking is free for a replacement — ${candidates.length} backup artist${candidates.length === 1 ? '' : 's'} found.` : ''}`,
  });
}
