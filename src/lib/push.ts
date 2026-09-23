import { createSign } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Sends notifications to the Android app through Firebase (supabase/042).
 *
 * SERVER ONLY — it holds the Firebase service-account key.
 *
 * Google charges nothing for these and they need no DLT registration, which
 * is why they are the first alert channel SafaKing uses. They only reach
 * people who installed the app and allowed notifications; SMS and WhatsApp
 * cover everyone else.
 *
 * Set FIREBASE_SERVICE_ACCOUNT to the whole service-account JSON, from
 * Firebase Console → Project settings → Service accounts → Generate new
 * private key.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping it should open, e.g. '/artist-portal'. */
  path?: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Tokens for phones that no longer have the app; removed from the database. */
  removed: number;
  error?: string;
}

function serviceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set.');
  const parsed = JSON.parse(raw) as ServiceAccount;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email or private_key.');
  }
  // Keys pasted into an env var usually arrive with escaped newlines.
  parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  return parsed;
}

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cachedToken: { value: string; expires: number } | null = null;

/** A Google access token, signed with the service-account key and reused until it nears expiry. */
async function accessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = base64url(createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Firebase refused the key: ${body.error_description ?? body.error ?? res.status}`);

  cachedToken = { value: body.access_token as string, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

/** Notify every phone belonging to these people. Never throws — alerts must not break a booking. */
export async function sendPushToUsers(userIds: string[], message: PushMessage): Promise<PushResult> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return { sent: 0, failed: 0, removed: 0 };

  let account: ServiceAccount;
  let token: string;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    account = serviceAccount();
    admin = createAdminClient();
    token = await accessToken(account);
  } catch (error) {
    return { sent: 0, failed: 0, removed: 0, error: error instanceof Error ? error.message : 'Push is not configured.' };
  }

  const { data: devices } = await admin.from('device_tokens').select('token').in('user_id', ids);
  const tokens = (devices ?? []).map((row) => row.token as string);
  if (tokens.length === 0) return { sent: 0, failed: 0, removed: 0 };

  const dead: string[] = [];
  const results = await Promise.allSettled(
    tokens.map(async (deviceToken) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: message.title, body: message.body },
            data: message.path ? { path: message.path } : undefined,
            android: {
              priority: 'HIGH',
              notification: { color: '#2D060E', default_sound: true },
            },
          },
        }),
      });
      if (res.ok) return true;
      const detail = await res.json().catch(() => ({}));
      const status = detail?.error?.status;
      // The app was uninstalled, or the token belongs to another project.
      if (res.status === 404 || status === 'UNREGISTERED' || status === 'INVALID_ARGUMENT') dead.push(deviceToken);
      throw new Error(`${res.status} ${status ?? ''}`.trim());
    })
  );

  if (dead.length) await admin.from('device_tokens').delete().in('token', dead);

  return {
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
    removed: dead.length,
  };
}
