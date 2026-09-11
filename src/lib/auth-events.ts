'use client';

export type AuthEvent =
  | 'sign_in' | 'sign_out' | 'mfa_verified' | 'failed_password' | 'failed_mfa'
  | 'mfa_enrolled' | 'mfa_removed';

/**
 * Records a sign-in event in the login history. Best effort by design: a
 * history row that fails to write must never stop someone signing in.
 */
export async function logAuthEvent(event: AuthEvent, extra: { email?: string } = {}) {
  try {
    await fetch('/api/auth/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...extra }),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}
