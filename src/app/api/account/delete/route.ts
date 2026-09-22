import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * A signed-in person asks for their account to be deleted (Google Play
 * requires this in the app and on the web — see supabase/041).
 *
 * The request is recorded and the sign-in closed straight away; staff then
 * complete the deletion from Admin → Account Deletions. Their orders and
 * bookings stay for tax, with their name taken off.
 */
export async function POST(request: Request) {
  let body: { reason?: unknown; confirm?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request.');
  }
  if (body.confirm !== true) return bad('Please confirm that you want your account deleted.');
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad('Sign in to delete your account.', 401);

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[account delete]', error);
    return bad('Account deletion is not available right now. Please email or call us.', 503);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name, phone, email')
    .eq('id', user.id)
    .maybeSingle();
  const role = (profile?.role as string | undefined) ?? 'customer';
  if (role === 'admin' || role === 'manager') {
    return bad('Staff accounts are closed by the owner from Users & Roles.', 403);
  }

  // Asking twice is fine — the first request stands.
  const { data: open } = await admin
    .from('account_deletion_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!open) {
    const inApp = (request.headers.get('user-agent') ?? '').includes('SafaKingApp');
    const { error } = await admin.from('account_deletion_requests').insert({
      user_id: user.id,
      source: inApp ? 'app' : 'web',
      verified: true,
      account_role: role,
      // Kept only until the deletion is done, so staff can reach them first.
      contact_name: profile?.full_name ?? null,
      contact_phone: profile?.phone ?? null,
      contact_email: profile?.email ?? user.email ?? null,
      reason,
    });
    if (error) {
      console.error('[account delete] insert', error);
      return bad('Your request could not be recorded. Please try again, or email or call us.', 500);
    }
  }

  // Close the sign-in now; staff finish the deletion within 7 days.
  const { error: banError } = await admin.auth.admin.updateUserById(user.id, { ban_duration: '876000h' });
  if (banError) console.error('[account delete] ban', banError);

  return NextResponse.json({ ok: true });
}
