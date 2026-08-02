import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { buildMatchQuote, MatchingError } from '@/lib/matching';

export const runtime = 'nodejs';

/**
 * Smart Matching Engine quotation (spec STEP 6).
 *
 * Takes a pincode, an event date and a guest count, and returns the safas
 * needed, the artists needed, who is actually free, and one combined price.
 * Writes nothing — booking happens through /api/rentals/create-order.
 */
export async function POST(request: Request) {
  let body: { pincode: string; eventDate: string; guestCount: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[match]', error);
    return NextResponse.json(
      { error: 'Matching is not configured yet. Please contact us.' },
      { status: 503 }
    );
  }

  try {
    const quote = await buildMatchQuote(admin, body);
    return NextResponse.json(quote);
  } catch (error) {
    if (error instanceof MatchingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[match]', error);
    return NextResponse.json({ error: 'Could not build a quotation.' }, { status: 500 });
  }
}
