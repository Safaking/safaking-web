'use client';

import { supabase } from '@/lib/supabase';

/**
 * Support code for the November 2026 client requirements update
 * (वेब अपडेट web update.docx): OTP/Happy-Code service verification,
 * contracts, and artist live-location pings.
 */

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------
export interface Contract {
  id: string;
  audience: 'artist' | 'customer';
  title: string;
  body: string;
}

export async function getActiveContract(audience: 'artist' | 'customer'): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, audience, title, body')
    .eq('audience', audience)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.warn('Could not load contract:', error.message);
    return null;
  }
  return data as Contract | null;
}

export async function recordContractAcceptance(params: {
  contractId: string;
  userId?: string | null;
  rentalId?: string | null;
  bookingId?: string | null;
  orderId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('contract_acceptances').insert({
    contract_id: params.contractId,
    user_id: params.userId ?? null,
    rental_id: params.rentalId ?? null,
    booking_id: params.bookingId ?? null,
    order_id: params.orderId ?? null,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// OTP + Happy Code
//
// The codes themselves are never fetched by artist-facing screens — only by
// the customer (who must relay them out loud) and admin. Verification always
// goes through the RPCs below, which run server-side and never return the
// stored value, only whether the attempt matched.
// ---------------------------------------------------------------------------
export type ServiceKind = 'rental' | 'booking';

export async function verifyArrivalCode(
  kind: ServiceKind,
  id: string,
  code: string,
  coords?: { lat: number; lng: number } | null
): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_arrival_code', {
    p_kind: kind,
    p_id: id,
    p_code: code.trim(),
    p_lat: coords?.lat ?? null,
    p_lng: coords?.lng ?? null,
  });
  if (error) throw new Error(error.message);
  return !!data;
}

export async function verifyCompletionCode(
  kind: ServiceKind,
  id: string,
  code: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_completion_code', {
    p_kind: kind,
    p_id: id,
    p_code: code.trim(),
  });
  if (error) throw new Error(error.message);
  return !!data;
}

export async function releaseBookingPayment(kind: ServiceKind, id: string): Promise<void> {
  const { error } = await supabase.rpc('release_booking_payment', { p_kind: kind, p_id: id });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Live location
// ---------------------------------------------------------------------------
export async function pingArtistLocation(params: {
  artistId: string;
  rentalId?: string | null;
  bookingId?: string | null;
  lat: number;
  lng: number;
  etaMinutes?: number | null;
}): Promise<void> {
  const { error } = await supabase.from('artist_locations').insert({
    artist_id: params.artistId,
    rental_id: params.rentalId ?? null,
    booking_id: params.bookingId ?? null,
    latitude: params.lat,
    longitude: params.lng,
    eta_minutes: params.etaMinutes ?? null,
  });
  if (error) throw new Error(error.message);
}

export interface LatestLocation {
  subject_id: string;
  latitude: number;
  longitude: number;
  eta_minutes: number | null;
  recorded_at: string;
}

export async function getLatestArtistLocation(
  kind: ServiceKind,
  id: string
): Promise<LatestLocation | null> {
  const column = kind === 'rental' ? 'rental_id' : 'booking_id';
  const { data, error } = await supabase
    .from('artist_location_latest')
    .select('*')
    .eq(column, id)
    .maybeSingle();

  if (error) {
    console.warn('Could not load artist location:', error.message);
    return null;
  }
  return data as LatestLocation | null;
}

/** One-shot browser geolocation read. Resolves null rather than throwing. */
export function getBrowserCoords(timeoutMs = 8000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
    );
  });
}
