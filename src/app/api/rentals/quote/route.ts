import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { priceRental, RentalPricingError } from '@/lib/rental-pricing';

export const runtime = 'nodejs';

/**
 * Live price + availability preview for a rental.
 *
 * Writes nothing. The customer's UI calls this whenever the dates, safa count
 * or artist toggle change, so the figures on screen are always the ones the
 * server would actually charge.
 */
export async function POST(request: Request) {
  let body: {
    startDate: string;
    endDate: string;
    items: { productId: string; quantity: number }[];
    needsArtist?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[rental-quote]', error);
    return NextResponse.json(
      { error: 'Rentals are not configured yet. Please contact us.' },
      { status: 503 }
    );
  }

  try {
    const quote = await priceRental(admin, {
      startDate: body.startDate,
      endDate: body.endDate,
      lines: body.items ?? [],
      needsArtist: !!body.needsArtist,
    });
    return NextResponse.json(quote);
  } catch (error) {
    if (error instanceof RentalPricingError) {
      // Something the customer can fix by changing dates or quantities.
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[rental-quote]', error);
    return NextResponse.json({ error: 'Could not price this rental.' }, { status: 500 });
  }
}
