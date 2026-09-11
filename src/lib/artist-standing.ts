/**
 * Artist incidents and the standing ladder.
 *
 * The database is the source of truth (score_artist_incident() and
 * artist_standing_recommendation() in supabase/036); these values label and
 * preview it and must match. Not a 'use client' module — the incident route
 * imports it.
 */

export type ArtistStanding = 'good' | 'warning' | 'restricted' | 'under_review' | 'suspended';

export const STANDING_ORDER: ArtistStanding[] = ['good', 'warning', 'restricted', 'under_review', 'suspended'];

export const STANDING_LABEL: Record<ArtistStanding, string> = {
  good: 'Good standing',
  warning: 'Warning',
  restricted: 'Temporarily restricted',
  under_review: 'Performance review',
  suspended: 'Suspended',
};

export const STANDING_TONE: Record<ArtistStanding, string> = {
  good: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  restricted: 'bg-orange-100 text-orange-800',
  under_review: 'bg-rose-100 text-rose-800',
  suspended: 'bg-rose-700 text-white',
};

export type IncidentKind = 'withdrew_after_accept' | 'no_show' | 'late_arrival' | 'complaint_upheld';

export const INCIDENT_LABEL: Record<IncidentKind, string> = {
  withdrew_after_accept: 'Pulled out after accepting',
  no_show: 'Did not turn up',
  late_arrival: 'Arrived late',
  complaint_upheld: 'Complaint upheld',
};

/** Mirrors score_artist_incident() in supabase/036. */
export const INCIDENT_POINTS: Record<IncidentKind, number> = {
  no_show: 3,
  withdrew_after_accept: 2,
  complaint_upheld: 2,
  late_arrival: 1,
};

export const STANDING_WINDOW_DAYS = 90;

/** Mirrors the thresholds in artist_standing_recommendation(). */
export function recommendStanding(points: number): ArtistStanding {
  if (points >= 7) return 'suspended';
  if (points >= 5) return 'under_review';
  if (points >= 3) return 'restricted';
  if (points >= 1) return 'warning';
  return 'good';
}

export const blocksWork = (standing: ArtistStanding | null | undefined, restrictedUntil?: string | null) =>
  standing === 'suspended' || standing === 'under_review' ||
  (standing === 'restricted' && (!restrictedUntil || new Date(restrictedUntil) > new Date()));
