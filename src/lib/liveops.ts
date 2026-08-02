'use client';

import { supabase } from '@/lib/supabase';

export type CheckinStage = 'en_route' | 'arrived' | 'started' | 'completed' | 'no_show';

export interface Checkin {
  id: string;
  rental_id: string | null;
  booking_id: string | null;
  artist_id: string;
  stage: CheckinStage;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  created_at: string;
}

export interface AtRiskBooking {
  rental_id: string | null;
  booking_id: string | null;
  customer_name: string;
  customer_phone: string;
  event_date: string;
  pincode: string | null;
  venue_address: string | null;
  safa_count: number | null;
  artist_id: string | null;
  artist_name: string | null;
  stage: string;
  last_seen_at: string | null;
}

export interface ReplacementCandidate {
  id: string;
  display_name: string;
  base_city: string | null;
  phone: string | null;
  safas_per_day: number;
  per_safa_rate: number;
  rating: number | null;
  total_events: number;
  verified: boolean;
  match_rank: number;
}

export const STAGE_FLOW: { stage: CheckinStage; label: string; hint: string }[] = [
  { stage: 'en_route', label: 'On my way', hint: 'Tell the customer you have set off' },
  { stage: 'arrived', label: 'I have arrived', hint: 'Marks you present at the venue' },
  { stage: 'started', label: 'Started tying', hint: 'Work is underway' },
  { stage: 'completed', label: 'Finished', hint: 'All safas tied' },
];

function describe(error: unknown): string {
  const err = error as { message?: string; code?: string } | null;
  if (err?.code === 'PGRST205' || err?.code === '42P01') {
    return 'Live ops is not set up yet — run supabase/010_live_ops.sql.';
  }
  return err?.message ?? 'Something went wrong.';
}

/**
 * Best-effort browser location.
 *
 * Never blocks the check-in: many artists decline the permission or are on a
 * poor signal, and a check-in without coordinates is far better than none.
 */
function currentPosition(timeoutMs = 6000): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}

export async function checkIn(params: {
  artistId: string;
  rentalId?: string | null;
  bookingId?: string | null;
  stage: CheckinStage;
  note?: string;
  withLocation?: boolean;
}): Promise<void> {
  const position = params.withLocation ? await currentPosition() : null;

  const { error } = await supabase.from('booking_checkins').insert({
    artist_id: params.artistId,
    rental_id: params.rentalId ?? null,
    booking_id: params.bookingId ?? null,
    stage: params.stage,
    latitude: position?.coords.latitude ?? null,
    longitude: position?.coords.longitude ?? null,
    note: params.note?.trim() || null,
  });

  if (error) throw new Error(describe(error));
}

export async function listCheckins(params: {
  rentalId?: string | null;
  bookingId?: string | null;
}): Promise<Checkin[]> {
  let query = supabase.from('booking_checkins').select('*').order('created_at', { ascending: true });

  query = params.rentalId
    ? query.eq('rental_id', params.rentalId)
    : query.eq('booking_id', params.bookingId!);

  const { data, error } = await query;
  if (error) throw new Error(describe(error));
  return (data as Checkin[]) ?? [];
}

export async function listAtRisk(): Promise<AtRiskBooking[]> {
  const { data, error } = await supabase.from('bookings_at_risk').select('*');
  if (error) throw new Error(describe(error));
  return (data as AtRiskBooking[]) ?? [];
}

export async function findReplacements(params: {
  rentalId?: string | null;
  bookingId?: string | null;
}): Promise<{ candidates: ReplacementCandidate[]; booking: Record<string, unknown> }> {
  const query = params.rentalId
    ? `rentalId=${params.rentalId}`
    : `bookingId=${params.bookingId}`;

  const response = await fetch(`/api/ops/replace?${query}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? 'Could not find replacements.');
  return body;
}

export async function assignReplacement(params: {
  rentalId?: string | null;
  bookingId?: string | null;
  replacementArtistId: string;
  reason: string;
}): Promise<{ replacementArtistName: string; warning?: string }> {
  const response = await fetch('/api/ops/replace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? 'Could not assign a replacement.');
  return body;
}
