import { getStaff } from '@/lib/staff-auth';
import { NextResponse } from 'next/server';
import { sendArtistApprovedEmail } from '@/lib/email';

export const runtime = 'nodejs';

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Checks the caller's own role through their session (RLS lets anyone read
// their own profiles row) — deliberately NOT via the service-role client,
// which throws when SUPABASE_SERVICE_ROLE_KEY isn't configured and would
// turn every approval email into a 500.
async function requireAdmin() {
  const { staff, error } = await getStaff();
  if (error) return { error };
  if (!staff.can('artists')) return { error: bad('Only the owner or the Artist Manager approves artists.', 403) };
  return { error: null };
}

/** Admin only: fires the "you're approved" email when an artist application is approved. */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { email: string; name: string };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  if (!body.email || !body.name) return bad('Email and name are required.');

  const result = await sendArtistApprovedEmail({ to: body.email, name: body.name });
  return NextResponse.json(result);
}
