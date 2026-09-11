import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendNewDeviceSignInEmail } from '@/lib/email';

export const runtime = 'nodejs';

const SIGNED_IN_EVENTS = ['sign_in', 'sign_out', 'mfa_verified', 'failed_mfa', 'mfa_enrolled', 'mfa_removed'];

const done = () => new NextResponse(null, { status: 204 });

function claimsOf(accessToken: string | undefined): Record<string, unknown> {
  if (!accessToken) return {};
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

/**
 * Writes one row of login history.
 *
 * The browser says what happened; the server supplies everything that
 * matters and cannot be faked from the browser — who (from the session),
 * where from (IP and city from Vercel's headers), and on what device. A
 * staff sign-in from a device never seen before is emailed to the owner:
 * that is how a shared password shows up.
 */
export async function POST(request: Request) {
  let body: { event?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }
  const event = body.event ?? '';

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return done();
  }

  const headers = request.headers;
  const city = headers.get('x-vercel-ip-city');
  const meta = {
    ip: headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || null,
    user_agent: headers.get('user-agent')?.slice(0, 400) ?? null,
    city: city ? decodeURIComponent(city) : null,
    country: headers.get('x-vercel-ip-country'),
  };

  // A failed password has no session. Only attempts on real accounts are
  // kept, so the table cannot be filled with made-up addresses.
  if (event === 'failed_password') {
    const email = body.email?.trim().toLowerCase();
    if (!email || email.length > 200) return done();
    const { data: account } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
    if (account) {
      await admin.from('login_events').insert({ user_id: account.id, email, event, ...meta });
    }
    return done();
  }

  if (!SIGNED_IN_EVENTS.includes(event)) {
    return NextResponse.json({ error: 'Unknown event.' }, { status: 400 });
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
  if (!user) return done();

  const { data: sessionData } = await supabase.auth.getSession();
  const claims = claimsOf(sessionData.session?.access_token);

  await admin.from('login_events').insert({
    user_id: user.id,
    email: user.email ?? null,
    event,
    session_id: typeof claims.session_id === 'string' ? claims.session_id : null,
    aal: typeof claims.aal === 'string' ? claims.aal : null,
    ...meta,
  });

  if ((event === 'sign_in' || event === 'mfa_verified') && meta.user_agent) {
    const { data: me } = await admin.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
    if (me?.role === 'admin' || me?.role === 'manager') {
      const { count } = await admin
        .from('login_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('user_agent', meta.user_agent)
        .in('event', ['sign_in', 'mfa_verified']);
      // The row just written is the only one: this device is new.
      if ((count ?? 0) <= 1) {
        const { data: owners } = await admin.from('profiles').select('id, email').eq('role', 'admin');
        await Promise.all(
          ((owners ?? []) as { id: string; email: string | null }[])
            .filter((o) => o.email && o.id !== user.id)
            .map((o) =>
              sendNewDeviceSignInEmail({
                to: o.email!,
                staffName: me.full_name || user.email || 'A staff member',
                userAgent: meta.user_agent!,
                place: [meta.city, meta.country].filter(Boolean).join(', ') || 'unknown location',
                ip: meta.ip,
              }).catch(() => null)
            )
        );
      }
    }
  }

  return done();
}
