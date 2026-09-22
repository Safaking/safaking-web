import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { getStaff } from '@/lib/staff-auth';

export const runtime = 'nodejs';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Staff complete or cancel an account deletion (supabase/041).
 *
 * Complete: first the sign-in is removed through Supabase's own soft delete —
 * the account row stays, so orders and bookings that point at it stay valid —
 * then complete_account_deletion() clears the person out of the database,
 * run as the staff member so the database checks their permission too. If
 * the second step fails, pressing Complete again finishes the job.
 *
 * Cancel: the request is closed and the sign-in re-opened.
 */
export async function POST(request: Request) {
  const { staff, error: staffError } = await getStaff();
  if (staffError) return staffError;
  if (!staff.can('customers')) return bad('Your department does not handle customer accounts.', 403);

  let body: { id?: unknown; action?: unknown; note?: unknown; confirmedIdentity?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request.');
  }
  const id = typeof body.id === 'string' ? body.id : '';
  const action = body.action === 'complete' || body.action === 'cancel' ? body.action : null;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) || null : null;
  if (!id || !action) return bad('Missing request or action.');

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[account deletion]', error);
    return bad('Account deletion is not configured on this server.', 503);
  }

  const { data: req } = await admin
    .from('account_deletion_requests')
    .select('id, user_id, status, verified')
    .eq('id', id)
    .maybeSingle();
  if (!req) return bad('That request does not exist.', 404);
  if (req.status !== 'pending') return bad(`This request is already ${req.status}.`, 409);

  const cookieStore = await cookies();
  const asStaff = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  if (action === 'cancel') {
    const { data: userId, error } = await asStaff.rpc('cancel_account_deletion', { p_request: id, p_note: note });
    if (error) return bad(error.message, 400);
    if (userId) {
      const { error: unbanError } = await admin.auth.admin.updateUserById(userId as string, { ban_duration: 'none' });
      if (unbanError) console.error('[account deletion] unban', unbanError);
    }
    return NextResponse.json({ ok: true });
  }

  if (!req.user_id) return bad('Link this request to an account before completing it.');
  if (!req.verified && body.confirmedIdentity !== true) {
    return bad('This came from the web form. Call the person to confirm it is really them first.');
  }

  const { error: authError } = await admin.auth.admin.deleteUser(req.user_id as string, true);
  // Already removed by an earlier attempt that failed later on: carry on.
  if (authError && !/not.?found/i.test(authError.message)) {
    console.error('[account deletion] auth', authError);
    return bad(`The sign-in could not be removed: ${authError.message}`, 502);
  }

  const { data: result, error } = await asStaff.rpc('complete_account_deletion', { p_request: id, p_note: note });
  if (error) return bad(`${error.message} — the sign-in is already removed; press Complete again to finish.`, 500);
  return NextResponse.json({ ok: true, result });
}
