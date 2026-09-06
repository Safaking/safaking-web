import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { sendArtistBookingOfferEmail } from '@/lib/email';

export const runtime = 'nodejs';

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Role check via the caller's own session (RLS allows reading your own
// profiles row) — not the service-role client, which throws when
// SUPABASE_SERVICE_ROLE_KEY isn't set and would 500 every offer email.
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
  if (!user) return { error: bad('Sign in.', 401) };

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    return { error: bad('Administrators only.', 403) };
  }
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
