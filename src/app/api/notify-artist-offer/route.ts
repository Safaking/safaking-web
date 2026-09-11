import { getStaff } from '@/lib/staff-auth';
import { NextResponse } from 'next/server';
import { sendArtistBookingOfferEmail } from '@/lib/email';

export const runtime = 'nodejs';

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Role check via the caller's own session (RLS allows reading your own
// profiles row) — not the service-role client, which throws when
// SUPABASE_SERVICE_ROLE_KEY isn't set and would 500 every offer email.
async function requireAdmin() {
  const { staff, error } = await getStaff();
  if (error) return { error };
  if (!staff.can('assign_artist')) return { error: bad('Your department cannot offer bookings to artists.', 403) };
  return { error: null };
}

/** Admin only: fires the "new booking offer" email when an artist is offered a booking. */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { email: string; name: string; eventDate: string; cityVenue: string; safaStyle: string };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  if (!body.email || !body.name) return bad('Email and name are required.');

  const result = await sendArtistBookingOfferEmail({
    to: body.email,
    name: body.name,
    eventDate: body.eventDate ?? '',
    cityVenue: body.cityVenue ?? '',
    safaStyle: body.safaStyle ?? 'Safa',
  });
  return NextResponse.json(result);
}
