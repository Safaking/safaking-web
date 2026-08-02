import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Smart Matching Engine (spec STEP 6). SERVER ONLY.
 *
 *   city -> guests -> safas needed -> artists needed -> combined quotation
 *
 * Every rate is read from app_settings, so the business can retune the funnel
 * without a deploy. Nothing here trusts a number from the browser except the
 * guest count, the date and the pincode.
 */

export class MatchingError extends Error {}

export interface MatchedArtist {
  id: string;
  displayName: string;
  baseCity: string | null;
  safasPerDay: number;
  perSafaRate: number;
  teamSize: number;
  rating: number | null;
  totalEvents: number;
  verified: boolean;
  matchRank: number;
}

export interface MatchedSafa {
  productId: string;
  name: string;
  image: string | null;
  quantity: number;
  rentPerDay: number;
  deposit: number;
  lineRent: number;
  lineDeposit: number;
  available: number;
}

export interface MatchQuote {
  city: string;
  pincode: string;
  eventDate: string;
  guestCount: number;
  safaCount: number;
  artistsNeeded: number;
  artistsAvailable: number;
  /** True when we could not find enough free artists for the date. */
  artistShortfall: boolean;
  safaShortfall: number;
  artists: MatchedArtist[];
  safas: MatchedSafa[];
  rentAmount: number;
  depositAmount: number;
  artistAmount: number;
  totalAmount: number;
  advanceAmount: number;
  balanceAmount: number;
  advanceRate: number;
  guestToSafaRatio: number;
  safasPerArtist: number;
  artistPerSafaRate: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

async function loadSettings(admin: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await admin.from('app_settings').select('key, value');
  if (error) throw new Error(`Could not read matching settings: ${error.message}`);

  const settings: Record<string, number> = {};
  for (const row of data ?? []) settings[row.key] = Number(row.value);
  return settings;
}

export async function buildMatchQuote(
  admin: SupabaseClient,
  input: { pincode: string; eventDate: string; guestCount: number }
): Promise<MatchQuote> {
  const pincode = String(input.pincode ?? '').replace(/\D/g, '');
  if (pincode.length !== 6) throw new MatchingError('Enter a valid 6-digit pincode.');

  if (!DATE_ONLY.test(input.eventDate ?? '')) {
    throw new MatchingError('Choose an event date.');
  }

  const today = new Date();
  const todayIso = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
  if (input.eventDate < todayIso) throw new MatchingError('The event date is in the past.');

  const guestCount = Number(input.guestCount);
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 5000) {
    throw new MatchingError('Guest count must be a whole number between 1 and 5000.');
  }

  // ---- STEP 1: identify the city ------------------------------------------
  const { data: pin } = await admin
    .from('artist_pincodes')
    .select('city_state')
    .eq('pincode', pincode)
    .eq('active', true)
    .maybeSingle();

  const { data: deliveryPin } = await admin
    .from('deliverable_pincodes')
    .select('city_state')
    .eq('pincode', pincode)
    .eq('active', true)
    .maybeSingle();

  const city = pin?.city_state ?? deliveryPin?.city_state ?? null;
  if (!city) {
    throw new MatchingError(
      `We do not serve pincode ${pincode} yet. Contact us and we will arrange travel.`
    );
  }

  const settings = await loadSettings(admin);
  const guestToSafaRatio = settings.guest_to_safa_ratio ?? 1;
  const safasPerArtist = Math.max(1, settings.safas_per_artist ?? 50);
  const artistPerSafaRate = settings.artist_per_safa_rate ?? 50;
  const advanceRate = settings.advance_rate ?? 0.2;

  // ---- STEP 2: guests -> safas -> artists ---------------------------------
  const safaCount = Math.max(1, Math.ceil(guestCount * guestToSafaRatio));
  const artistsNeeded = Math.ceil(safaCount / safasPerArtist);

  // ---- STEP 3: find free artists ------------------------------------------
  const { data: artistRows, error: artistErr } = await admin.rpc('match_artists', {
    p_pincode: pincode,
    p_date: input.eventDate,
  });
  if (artistErr) throw new Error(`Could not match artists: ${artistErr.message}`);

  const allArtists: MatchedArtist[] = (artistRows ?? []).map(
    (row: {
      id: string; display_name: string; base_city: string | null;
      safas_per_day: number; per_safa_rate: number; team_size: number;
      rating: number | null; total_events: number; verified: boolean; match_rank: number;
    }) => ({
      id: row.id,
      displayName: row.display_name,
      baseCity: row.base_city,
      safasPerDay: row.safas_per_day,
      perSafaRate: row.per_safa_rate,
      teamSize: row.team_size,
      rating: row.rating,
      totalEvents: row.total_events,
      verified: row.verified,
      matchRank: row.match_rank,
    })
  );

  // Take the best-ranked artists until their combined capacity covers the job.
  const chosen: MatchedArtist[] = [];
  let capacity = 0;
  for (const artist of allArtists) {
    if (capacity >= safaCount) break;
    chosen.push(artist);
    capacity += artist.safasPerDay;
  }

  // ---- STEP 4: find the safas ---------------------------------------------
  const { data: stock, error: stockErr } = await admin.rpc('available_rentals', {
    p_start: input.eventDate,
    p_end: input.eventDate,
  });
  if (stockErr) throw new Error(`Could not check safa availability: ${stockErr.message}`);

  // Allocate greedily from the cheapest rentable safa upward, so the quotation
  // is the best price we can actually fulfil rather than an arbitrary pick.
  const pool = ((stock ?? []) as {
    id: string; name: string; image: string | null;
    rent_price_per_day: number; rent_deposit: number | null; available: number;
  }[])
    .filter((s) => s.available > 0)
    .sort((a, b) => a.rent_price_per_day - b.rent_price_per_day);

  const safas: MatchedSafa[] = [];
  let remaining = safaCount;

  for (const item of pool) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, item.available);
    const deposit = item.rent_deposit ?? 0;

    safas.push({
      productId: item.id,
      name: item.name,
      image: item.image,
      quantity: take,
      rentPerDay: item.rent_price_per_day,
      deposit,
      lineRent: item.rent_price_per_day * take,
      lineDeposit: deposit * take,
      available: item.available,
    });
    remaining -= take;
  }

  // ---- STEP 5: combined quotation -----------------------------------------
  const allocated = safaCount - remaining;
  const rentAmount = safas.reduce((sum, s) => sum + s.lineRent, 0);
  const depositAmount = safas.reduce((sum, s) => sum + s.lineDeposit, 0);
  // Artists are paid per safa actually supplied, not per safa requested.
  const artistAmount = artistPerSafaRate * allocated;

  const totalAmount = rentAmount + depositAmount + artistAmount;
  const advanceAmount = Math.round(totalAmount * advanceRate);

  return {
    city,
    pincode,
    eventDate: input.eventDate,
    guestCount,
    safaCount,
    artistsNeeded,
    artistsAvailable: chosen.length,
    artistShortfall: capacity < safaCount,
    safaShortfall: remaining,
    artists: chosen,
    safas,
    rentAmount,
    depositAmount,
    artistAmount,
    totalAmount,
    advanceAmount,
    balanceAmount: totalAmount - advanceAmount,
    advanceRate,
    guestToSafaRatio,
    safasPerArtist,
    artistPerSafaRate,
  };
}
