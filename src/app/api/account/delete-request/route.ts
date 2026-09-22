import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const EMAIL = /^[^\s@,()<>;:"]+@[^\s@,()<>;:"]+\.[a-z]{2,}$/i;

/**
 * A deletion request from someone who cannot sign in — the web-link route
 * Google Play requires besides the in-app one (supabase/041).
 *
 * It is only a claim: nothing is closed or deleted until staff have called the
 * person back. The reply is the same whether or not an account matched, so
 * the form cannot be used to find out who has a SafaKing account.
 */
export async function POST(request: Request) {
  let body: { name?: unknown; phone?: unknown; email?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request.');
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '').slice(-10) : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;

  if (name.length < 2) return bad('Please enter your name.');
  if (!phone && !email) return bad('Enter the phone number or email on your SafaKing account.');
  if (phone && !/^[6-9]\d{9}$/.test(phone)) return bad('Enter a 10-digit Indian mobile number.');
  if (email && !EMAIL.test(email)) return bad('That email address does not look right.');

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[delete request]', error);
    return bad('This form is not available right now. Please email or call us.', 503);
  }

  const received = NextResponse.json({ ok: true });

  // A few requests a day for the same details is plenty; more is noise.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = admin
    .from('account_deletion_requests')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'web_form')
    .gte('requested_at', since);
  const { count } = phone ? await recent.eq('contact_phone', phone) : await recent.eq('contact_email', email);
  if ((count ?? 0) >= 3) return received;

  // Link the account only on a single clear match; staff confirm by phone.
  const matches = new Set<string>();
  if (phone) {
    const { data } = await admin.from('profiles').select('id').ilike('phone', `%${phone}`).limit(3);
    (data ?? []).forEach((row) => matches.add(row.id as string));
  }
  if (email) {
    const { data } = await admin.from('profiles').select('id').eq('email', email).limit(3);
    (data ?? []).forEach((row) => matches.add(row.id as string));
  }
  const userId = matches.size === 1 ? [...matches][0] : null;

  let role: string | null = null;
  if (userId) {
    const { data: open } = await admin
      .from('account_deletion_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();
    if (open) return received;
    const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    role = (profile?.role as string | undefined) ?? null;
  }

  const { error } = await admin.from('account_deletion_requests').insert({
    user_id: userId,
    source: 'web_form',
    verified: false,
    account_role: role,
    contact_name: name,
    contact_phone: phone || null,
    contact_email: email || null,
    reason,
  });
  if (error) {
    console.error('[delete request] insert', error);
    return bad('Your request could not be recorded. Please try again, or email or call us.', 500);
  }
  return received;
}
