import { NextResponse } from 'next/server';
import { getStaff } from '@/lib/staff-auth';
import { sendPushToUsers } from '@/lib/push';

export const runtime = 'nodejs';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Staff send a notification to someone's phone — "your artist is assigned",
 * "a new job for you" — or to themselves as a test (supabase/042).
 *
 * Free: Google charges nothing and no DLT registration is involved. It only
 * reaches people who installed the app and allowed notifications.
 */
export async function POST(request: Request) {
  const { staff, error: staffError } = await getStaff();
  if (staffError) return staffError;
  if (!staff.can('customers') && !staff.can('bookings')) {
    return bad('Your department cannot send notifications.', 403);
  }

  let body: { userIds?: unknown; userId?: unknown; title?: unknown; body?: unknown; path?: unknown; test?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request.');
  }

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const asked = [
    ...(Array.isArray(body.userIds) ? body.userIds : []),
    ...(typeof body.userId === 'string' ? [body.userId] : []),
  ].filter((id): id is string => typeof id === 'string' && UUID.test(id));
  // A test goes to the person pressing the button.
  const userIds = body.test === true ? [staff.userId] : asked;
  if (userIds.length === 0) return bad('Nobody to notify.');
  if (userIds.length > 100) return bad('Too many people at once.');

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 300) : '';
  const path = typeof body.path === 'string' && body.path.startsWith('/') ? body.path.slice(0, 200) : undefined;
  if (!title || !text) return bad('A notification needs a title and a line of text.');

  const result = await sendPushToUsers(userIds, { title, body: text, path });
  if (result.error) return bad(result.error, 503);
  if (result.sent === 0 && result.failed === 0) {
    return NextResponse.json({ ...result, note: 'Nobody there has the app with notifications turned on yet.' });
  }
  return NextResponse.json(result);
}
