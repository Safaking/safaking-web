import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { priceRental, RentalPricingError } from '@/lib/rental-pricing';
import { createRazorpayOrder, publicKeyId, toPaise } from '@/lib/razorpay';

export const runtime = 'nodejs';

interface CreateRentalBody {
  startDate: string;
  endDate: string;
  items: { productId: string; quantity: number }[];
  needsArtist?: boolean;
  customerName: string;
  customerPhone: string;
  venueAddress: string;
  city?: string;
  pincode: string;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Creates a rental booking and the Razorpay order for its advance.
 *
 * Prices are recomputed here from the products table and app_settings —
 * the request carries dates, product ids, quantities and contact details only.
 * Availability is re-checked at this moment, so a safa that got booked while
 * the customer was filling the form is caught before any money moves.
 */
export async function POST(request: Request) {
  let body: CreateRentalBody;
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  if (!body.customerName?.trim()) return bad('Full name is required.');
  if (!body.customerPhone?.trim()) return bad('Phone number is required.');
  if (!body.venueAddress?.trim()) return bad('Venue address is required.');

  const cleanPincode = String(body.pincode ?? '').replace(/\D/g, '');
  if (cleanPincode.length !== 6) return bad('Enter a valid 6-digit pincode for the venue.');

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[rental-create]', error);
    return bad('Rentals are not configured yet. Please contact us.', 503);
  }

  // Artists have to be able to reach the venue.
  const { data: servicePin } = await admin
    .from('artist_pincodes')
    .select('pincode, city_state')
    .eq('pincode', cleanPincode)
    .eq('active', true)
    .maybeSingle();

  if (!servicePin) {
    return bad(
      `We do not currently serve pincode ${cleanPincode}. Contact us to arrange travel.`
    );
  }

  // ---- Who is booking (guest rentals allowed) -----------------------------
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* read-only in a route handler */
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ---- Authoritative pricing + availability -------------------------------
  let quote;
  try {
    quote = await priceRental(admin, {
      startDate: body.startDate,
      endDate: body.endDate,
      lines: body.items ?? [],
      needsArtist: !!body.needsArtist,
    });
  } catch (error) {
    if (error instanceof RentalPricingError) return bad(error.message);
    console.error('[rental-create]', error);
    return bad('Could not price this rental.', 500);
  }

  // ---- Create the booking -------------------------------------------------
  const { data: rental, error: rentalErr } = await admin
    .from('rental_bookings')
    .insert({
      customer_id: user?.id ?? null,
      customer_name: body.customerName.trim(),
      customer_phone: body.customerPhone.trim(),
      customer_email: user?.email ?? null,
      start_date: quote.startDate,
      end_date: quote.endDate,
      rental_days: quote.days,
      venue_address: body.venueAddress.trim(),
      city: body.city?.trim() || servicePin.city_state,
      pincode: cleanPincode,
      safa_count: quote.safaCount,
      needs_artist: quote.needsArtist,
      artist_amount: quote.artistAmount,
      rent_amount: quote.rentAmount,
      deposit_amount: quote.depositAmount,
      total_amount: quote.totalAmount,
      advance_amount: quote.advanceAmount,
      balance_amount: quote.balanceAmount,
      payment_status: 'advance_pending',
      status: 'pending',
    })
    .select('id')
    .single();

  if (rentalErr || !rental) {
    return bad(`Could not create the rental: ${rentalErr?.message ?? 'unknown error'}`, 500);
  }

  const { error: itemsErr } = await admin.from('rental_items').insert(
    quote.lines.map((line) => ({
      rental_id: rental.id,
      product_id: line.productId,
      product_name: line.name,
      quantity: line.quantity,
      unit_rent_per_day: line.unitRentPerDay,
      unit_deposit: line.unitDeposit,
      line_rent: line.lineRent,
      line_deposit: line.lineDeposit,
    }))
  );

  if (itemsErr) {
    await admin.from('rental_bookings').delete().eq('id', rental.id);
    return bad(`Could not save the rental items: ${itemsErr.message}`, 500);
  }

  // ---- Razorpay -----------------------------------------------------------
  try {
    const rzpOrder = await createRazorpayOrder(
      toPaise(quote.advanceAmount),
      `safarent_${rental.id.slice(0, 8)}`,
      { safaking_rental_id: rental.id, customer_phone: body.customerPhone.trim() }
    );

    await admin
      .from('rental_bookings')
      .update({ razorpay_order_id: rzpOrder.id })
      .eq('id', rental.id);

    await admin.from('payments').insert({
      rental_id: rental.id,
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      status: 'created',
      notes: {
        total_amount: quote.totalAmount,
        advance_amount: quote.advanceAmount,
        deposit_amount: quote.depositAmount,
        rental_days: quote.days,
      },
    });

    return NextResponse.json({
      rentalId: rental.id,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: publicKeyId(),
      quote,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment setup failed.';
    await admin
      .from('rental_bookings')
      .update({ status: 'cancelled', payment_status: 'failed' })
      .eq('id', rental.id);
    return bad(message, 502);
  }
}
