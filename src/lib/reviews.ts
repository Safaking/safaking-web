'use client';

import { supabase } from '@/lib/supabase';

export const PORTFOLIO_BUCKET = 'portfolio';

export type ReviewSubject = 'artist' | 'customer' | 'supplier';
export type MediaKind = 'photo' | 'video';

export interface Review {
  id: string;
  reviewer_id: string;
  subject_type: ReviewSubject;
  subject_id: string;
  rental_id: string | null;
  booking_id: string | null;
  rating: number;
  comment: string | null;
  visible: boolean;
  created_at: string;
  reviewer_name?: string | null;
}

export interface PortfolioItem {
  id: string;
  artist_id: string;
  media_kind: MediaKind;
  storage_path: string | null;
  external_url: string | null;
  caption: string | null;
  event_name: string | null;
  event_date: string | null;
  sort_order: number;
  visible: boolean;
  created_at: string;
}

export interface ArtistPublicProfile {
  id: string;
  display_name: string;
  base_city: string | null;
  specialties: string[];
  experience_years: number | null;
  safas_per_day: number;
  per_safa_rate: number;
  team_size: number;
  rating: number | null;
  total_events: number;
  verified: boolean;
  review_count: number;
  portfolio_count: number;
}

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];

export function describeError(error: unknown): string {
  const err = error as { message?: string; code?: string } | null;
  if (!err) return 'Something went wrong.';
  if (err.message?.includes('Bucket not found')) {
    return 'Portfolio storage is not set up yet — run supabase/007_reviews_portfolio.sql.';
  }
  if (err.code === 'PGRST205' || err.code === '42P01') {
    return 'Reviews are not set up yet — run supabase/007_reviews_portfolio.sql.';
  }
  if (err.message?.includes('row-level security')) {
    // The insert policy calls can_review(), so this is the usual failure.
    return 'You can only review someone after a booking with them is completed.';
  }
  return err.message ?? 'Something went wrong.';
}

/** Public URL for a portfolio photo. The bucket is public by design. */
export function portfolioUrl(item: PortfolioItem): string | null {
  if (item.external_url) return item.external_url;
  if (!item.storage_path) return null;
  return supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(item.storage_path).data.publicUrl;
}

export async function listArtists(): Promise<ArtistPublicProfile[]> {
  const { data, error } = await supabase
    .from('artist_public_profiles')
    .select('*')
    .order('verified', { ascending: false })
    .order('rating', { ascending: false })
    .order('total_events', { ascending: false });

  if (error) throw new Error(describeError(error));
  return (data as ArtistPublicProfile[]) ?? [];
}

export async function getArtist(id: string): Promise<ArtistPublicProfile | null> {
  const { data, error } = await supabase
    .from('artist_public_profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(describeError(error));
  return (data as ArtistPublicProfile) ?? null;
}

export async function listReviews(
  subjectType: ReviewSubject,
  subjectId: string
): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, profiles!reviews_reviewer_id_fkey(full_name)')
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
    .eq('visible', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(describeError(error));

  return ((data ?? []) as (Review & { profiles?: { full_name?: string } | null })[]).map((row) => ({
    ...row,
    reviewer_name: row.profiles?.full_name ?? null,
  }));
}

export async function listPortfolio(artistId: string): Promise<PortfolioItem[]> {
  const { data, error } = await supabase
    .from('portfolio_items')
    .select('*')
    .eq('artist_id', artistId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw new Error(describeError(error));
  return (data as PortfolioItem[]) ?? [];
}

/**
 * Bookings this user has finished and not yet reviewed.
 * Drives the "leave a review" prompt — we never ask for a review that the
 * database would reject.
 */
export interface ReviewableBooking {
  rentalId: string | null;
  bookingId: string | null;
  artistId: string;
  artistName: string | null;
  when: string;
  label: string;
}

export async function listReviewableBookings(userId: string): Promise<ReviewableBooking[]> {
  const [rentals, bookings, existing] = await Promise.all([
    supabase
      .from('rental_bookings')
      .select('id, artist_id, artist_name, start_date, safa_count')
      .eq('customer_id', userId)
      .in('status', ['returned', 'completed'])
      .not('artist_id', 'is', null),
    supabase
      .from('artist_bookings')
      .select('id, artist_id, artist_name, event_date, safa_style')
      .eq('customer_id', userId)
      .eq('status', 'completed')
      .not('artist_id', 'is', null),
    supabase.from('reviews').select('rental_id, booking_id').eq('reviewer_id', userId),
  ]);

  const reviewedRentals = new Set(
    (existing.data ?? []).map((r) => r.rental_id).filter(Boolean) as string[]
  );
  const reviewedBookings = new Set(
    (existing.data ?? []).map((r) => r.booking_id).filter(Boolean) as string[]
  );

  const out: ReviewableBooking[] = [];

  for (const r of rentals.data ?? []) {
    if (reviewedRentals.has(r.id)) continue;
    out.push({
      rentalId: r.id,
      bookingId: null,
      artistId: r.artist_id!,
      artistName: r.artist_name,
      when: r.start_date,
      label: `${r.safa_count} safa rental`,
    });
  }

  for (const b of bookings.data ?? []) {
    if (reviewedBookings.has(b.id)) continue;
    out.push({
      rentalId: null,
      bookingId: b.id,
      artistId: b.artist_id!,
      artistName: b.artist_name,
      when: b.event_date,
      label: b.safa_style,
    });
  }

  return out.sort((a, b) => b.when.localeCompare(a.when));
}

export async function submitReview(params: {
  reviewerId: string;
  subjectType: ReviewSubject;
  subjectId: string;
  rentalId?: string | null;
  bookingId?: string | null;
  rating: number;
  comment?: string;
}): Promise<void> {
  if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
    throw new Error('Choose a rating between 1 and 5 stars.');
  }

  const { error } = await supabase.from('reviews').insert({
    reviewer_id: params.reviewerId,
    subject_type: params.subjectType,
    subject_id: params.subjectId,
    rental_id: params.rentalId ?? null,
    booking_id: params.bookingId ?? null,
    rating: params.rating,
    comment: params.comment?.trim() || null,
  });

  if (error) throw new Error(describeError(error));
}

export async function addPortfolioPhoto(params: {
  artistId: string;
  file: File;
  caption?: string;
  eventName?: string;
  eventDate?: string;
}): Promise<void> {
  const { artistId, file } = params;

  if (file.size > MAX_BYTES) throw new Error('That photo is larger than 8 MB.');
  if (!ALLOWED_IMAGE.includes(file.type)) throw new Error('Upload a JPG, PNG or WEBP.');

  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  // First segment must be the artist id — the storage policy checks it.
  const path = `${artistId}/${Date.now()}.${extension}`;

  const { error: uploadErr } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(path, file, { contentType: file.type });

  if (uploadErr) throw new Error(describeError(uploadErr));

  const { error } = await supabase.from('portfolio_items').insert({
    artist_id: artistId,
    media_kind: 'photo',
    storage_path: path,
    caption: params.caption?.trim() || null,
    event_name: params.eventName?.trim() || null,
    event_date: params.eventDate || null,
  });

  if (error) {
    await supabase.storage.from(PORTFOLIO_BUCKET).remove([path]);
    throw new Error(describeError(error));
  }
}

export async function addPortfolioVideo(params: {
  artistId: string;
  url: string;
  caption?: string;
  eventName?: string;
}): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(params.url);
  } catch {
    throw new Error('Enter a full video link, starting with https://');
  }
  if (parsed.protocol !== 'https:') throw new Error('Video links must start with https://');

  const { error } = await supabase.from('portfolio_items').insert({
    artist_id: params.artistId,
    media_kind: 'video',
    external_url: parsed.toString(),
    caption: params.caption?.trim() || null,
    event_name: params.eventName?.trim() || null,
  });

  if (error) throw new Error(describeError(error));
}

export async function removePortfolioItem(item: PortfolioItem): Promise<void> {
  const { error } = await supabase.from('portfolio_items').delete().eq('id', item.id);
  if (error) throw new Error(describeError(error));

  if (item.storage_path) {
    await supabase.storage.from(PORTFOLIO_BUCKET).remove([item.storage_path]);
  }
}
