/**
 * Why a booking was cancelled — fixed values, shared by the customer screen,
 * the admin desk and the server route. Free text here would give a
 * cancellation report where "postponed", "Postponed" and "date shifted" are
 * three different reasons.
 *
 * Deliberately not a 'use client' module, so the API route can import it.
 */

export type CancelReasonCode =
  | 'wedding_postponed'
  | 'wedding_cancelled'
  | 'booked_elsewhere'
  | 'price_too_high'
  | 'changed_plans'
  | 'artist_unavailable'
  | 'customer_request'
  | 'safaking_fault'
  | 'other';

export const CANCEL_REASON_LABEL: Record<CancelReasonCode, string> = {
  wedding_postponed: 'Wedding or event postponed',
  wedding_cancelled: 'Wedding or event called off',
  booked_elsewhere: 'Booked someone else',
  price_too_high: 'Price too high',
  changed_plans: 'Plans changed',
  artist_unavailable: 'I cannot reach this booking',
  customer_request: 'Customer asked us to cancel',
  safaking_fault: 'SafaKing could not serve this booking',
  other: 'Something else',
};

const BY_ROLE: Record<'customer' | 'artist' | 'staff', CancelReasonCode[]> = {
  customer: ['wedding_postponed', 'wedding_cancelled', 'booked_elsewhere', 'price_too_high', 'changed_plans', 'other'],
  artist: ['artist_unavailable', 'other'],
  staff: ['customer_request', 'safaking_fault', 'other'],
};

export const reasonsFor = (role: 'customer' | 'artist' | 'staff') => BY_ROLE[role];

export const isCancelReason = (value: string): value is CancelReasonCode =>
  Object.prototype.hasOwnProperty.call(CANCEL_REASON_LABEL, value);
