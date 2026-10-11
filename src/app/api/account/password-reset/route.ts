import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendPasswordResetEmail } from '@/lib/email';

/**
 * Sends a "set a new password" link.
 *
 * Supabase can send this itself, but its built-in mail is rate-limited to a
 * handful an hour and lands in spam often enough that customers ring up
 * instead. So the link is minted here with the service key and sent through
 * the same service as every other SafaKing email — branded, in Hindi and
 * English, and not rate-limited.
 *
 * When email is not configured the route says so, and the browser falls back
 * to Supabase's own email rather than leaving somebody locked out.
 *
 * It never says whether an address has an account: the answer is the same
 * either way, so nobody can use this to find out who is a customer.
 */

export const runtime = 'nodejs';

/** One link a minute per address — enough for a mistyped click, not for a flood. */
const lastSent = new Map<string, number>();
const COOLDOWN_MS = 60_000;

export async function POST(req: Request) {
  let email = '';
  try {
    const body = await req.json();
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Send an email address.' }, { status: 400 });
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    // Nothing to send with — let the browser ask Supabase to send its own.
    return NextResponse.json({ ok: true, fallback: true });
  }

  const now = Date.now();
  for (const [key, at] of lastSent) if (now - at > COOLDOWN_MS) lastSent.delete(key);
  if (now - (lastSent.get(email) ?? 0) < COOLDOWN_MS) {
    // Quietly succeed: a second click should not tell anyone anything either.
    return NextResponse.json({ ok: true });
  }
  lastSent.set(email, now);

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.safaking.in';

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${site}/reset-password` },
    });

    // No account for that address — the caller is told the same as everyone else.
    if (error || !data?.properties?.action_link) return NextResponse.json({ ok: true });

    const sent = await sendPasswordResetEmail({ to: email, link: data.properties.action_link });
    // Mail service refused: let the browser fall back to Supabase's own email.
    if (!sent.ok) return NextResponse.json({ ok: true, fallback: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Password reset link failed:', err);
    return NextResponse.json({ ok: true, fallback: true });
  }
}
