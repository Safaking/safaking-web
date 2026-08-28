import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side rental pricing. SERVER ONLY.
 *
 * Every figure here comes from the database — per-safa rent and deposit from
 * `products`, the artist rate and advance percentage from `app_settings`. The
 * browser supplies dates, product ids and quantities and nothing else.
 */

export interface RentalLine {
  productId: string;
  quantity: number;
}

export interface PricedLine {
  productId: string;
  name: string;
  quantity: number;
  unitRentPerDay: number;
  unitDeposit: number;
  lineRent: number;
  lineDeposit: number;
  available: number;
}

export interface PricedRental {
  startDate: string;
  endDate: string;
  days: number;
  safaCount: number;
  lines: PricedLine[];
  rentAmount: number;
  depositAmount: number;
  artistAmount: number;
  totalAmount: number;
  advanceAmount: number;
  balanceAmount: number;
  needsArtist: boolean;
  artistPerSafaRate: number;
}

/** Thrown for anything the customer can fix by changing their selection. */
export class RentalPricingError extends Error {}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string, label: string): Date {
  if (!DATE_ONLY.test(value ?? '')) {
    throw new RentalPricingError(`${label} must be a date in YYYY-MM-DD form.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new RentalPricingError(`${label} is not a real date.`);
  }
  return date;
}

/** Inclusive day count: renting for one calendar day is 1 day, not 0. */
export function rentalDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

async function loadSettings(admin: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await admin.from('app_settings').select('key, value');
  if (error) throw new Error(`Could not read pricing settings: ${error.message}`);

  const settings: Record<string, number> = {};
  for (const row of data ?? []) settings[row.key] = Number(row.value);
  return settings;
}

export async function priceRental(
  admin: SupabaseClient,
  input: {
    startDate: string;
    endDate: string;
    lines: RentalLine[];
    needsArtist: boolean;
    /** Set when re-pricing an existing booking, so it doesn't block itself. */
    excludeRentalId?: string | null;
  }
): Promise<PricedRental> {
  const start = parseDate(input.startDate, 'Rental start date');
  const end = parseDate(input.endDate, 'Rental end date');

  if (end < start) {
    throw new RentalPricingError('The return date cannot be before the start date.');
  }

  // Compare against UTC midnight today so a booking made late in the evening
  // for tomorrow isn't rejected.
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  if (start < todayUtc) {
    throw new RentalPricingError('The rental start date is in the past.');
  }

  const settings = await loadSettings(admin);
  const minDays = settings.min_rent_days ?? 1;
  const maxDays = settings.max_rent_days ?? 30;
  const artistRate = settings.artist_per_safa_rate ?? 50;
  const advanceRate = settings.advance_rate ?? 0.5;

  const days = rentalDays(start, end);
  if (days < minDays) {
    throw new RentalPricingError(`The minimum rental period is ${minDays} day(s).`);
  }
  if (days > maxDays) {
    throw new RentalPricingError(`The maximum rental period is ${maxDays} days.`);
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new RentalPricingError('Choose at least one safa to rent.');
  }

  // Collapse duplicate lines so quantities can't be split to dodge availability.
  const merged = new Map<string, number>();
  for (const line of input.lines) {
    const quantity = Number(line?.quantity);
    if (!line?.productId || typeof line.productId !== 'string') {
      throw new RentalPricingError('One of the selected safas is not valid.');
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      throw new RentalPricingError('Safa quantity must be a whole number between 1 and 500.');
    }
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + quantity);
  }

  const productIds = [...merged.keys()];
  const { data: products, error: productErr } = await admin
    .from('products')
    .select('id, name, active, is_rentable, rent_price_per_day, rent_deposit')
    .in('id', productIds);

  if (productErr) throw new Error(`Could not price the rental: ${productErr.message}`);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  // Physical stock check for this exact window, per product. Each check is
  // independent of the others, so run them concurrently — this used to be a
  // sequential `await` inside the loop below, turning every extra safa style
  // in the cart into one more full network round trip to Postgres.
  const availabilityEntries = await Promise.all(
    [...merged.keys()].map(async (productId) => {
      const { data, error } = await admin.rpc('rental_availability', {
        p_product_id: productId,
        p_start: input.startDate,
        p_end: input.endDate,
        p_exclude: input.excludeRentalId ?? null,
      });
      return [productId, { data, error }] as const;
    })
  );
  const availabilityById = new Map(availabilityEntries);

  const lines: PricedLine[] = [];

  for (const [productId, quantity] of merged) {
    const product = byId.get(productId);

    if (!product || !product.active || !product.is_rentable) {
      throw new RentalPricingError('One of the selected safas is not available to rent.');
    }
    if (product.rent_price_per_day == null) {
      throw new RentalPricingError(
        `"${product.name}" has no rental price set yet. Please choose another safa.`
      );
    }

    const availResult = availabilityById.get(productId);
    if (availResult?.error) throw new Error(`Could not check availability: ${availResult.error.message}`);

    const free = Number(availResult?.data ?? 0);
    if (free < quantity) {
      throw new RentalPricingError(
        free === 0
          ? `"${product.name}" is fully booked for those dates.`
          : `Only ${free} of "${product.name}" are free for those dates.`
      );
    }

    const unitRentPerDay = product.rent_price_per_day;
    const unitDeposit = product.rent_deposit ?? 0;

    lines.push({
      productId,
      name: product.name,
      quantity,
      unitRentPerDay,
      unitDeposit,
      lineRent: unitRentPerDay * quantity * days,
      lineDeposit: unitDeposit * quantity,
      available: free,
    });
  }

  const safaCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const rentAmount = lines.reduce((sum, l) => sum + l.lineRent, 0);
  const depositAmount = lines.reduce((sum, l) => sum + l.lineDeposit, 0);
  const artistAmount = input.needsArtist ? artistRate * safaCount : 0;

  const totalAmount = rentAmount + depositAmount + artistAmount;
  const advanceAmount = Math.round(totalAmount * advanceRate);

  return {
    startDate: input.startDate,
    endDate: input.endDate,
    days,
    safaCount,
    lines,
    rentAmount,
    depositAmount,
    artistAmount,
    totalAmount,
    advanceAmount,
    balanceAmount: totalAmount - advanceAmount,
    needsArtist: input.needsArtist,
    artistPerSafaRate: artistRate,
  };
}
