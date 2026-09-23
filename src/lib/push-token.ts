/**
 * The FCM token this phone is currently registered with.
 *
 * Kept here so signing out can hand it to forget_device_token() before the
 * session goes — after sign-out the database no longer knows who is asking,
 * and the next person on this phone would keep receiving the old account's
 * alerts (supabase/042).
 */
let currentToken: string | null = null;

export function rememberPushToken(token: string) {
  currentToken = token;
}

export function currentPushToken(): string | null {
  return currentToken;
}

export function clearPushToken() {
  currentToken = null;
}
