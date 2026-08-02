'use client';

import { supabase } from '@/lib/supabase';

export interface RefundRule {
  id: string;
  min_days_before: number;
  refund_percent: number;
  label: string;
  active: boolean;
}

export interface Cancellation {
  id: string;
  rental_id: string | null;
  booking_id: string | null;
  requested_by: string | null;
  requested_role: 'customer' | 'artist' | 'admin';
  reason: string;
  event_date: string | null;
  days_before: number | null;
  refund_percent: number;
  advance_amount: number;
  refund_amount: number;
  status: 'requested' | 'approved' | 'rejected' | 'refunded' | 'no_refund';
  admin_note: string | null;
  razorpay_refund_id: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  rental_id: string | null;
  booking_id: string | null;
  raised_by: string | null;
  raised_role: 'customer' | 'artist';
  against_id: string | null;
  category: DisputeCategory;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  resolution: string | null;
  created_at: string;
}

export type DisputeCategory =
  | 'artist_no_show' | 'late_arrival' | 'quality' | 'damage' | 'payment' | 'behaviour' | 'other';

export const DISPUTE_CATEGORIES: { value: DisputeCategory; label: string }[] = [
  { value: 'artist_no_show', label: 'Artist did not arrive' },
  { value: 'late_arrival', label: 'Artist arrived late' },
  { value: 'quality', label: 'Quality of work' },
  { value: 'damage', label: 'Damaged safa or item' },
  { value: 'payment', label: 'Payment problem' },
  { value: 'behaviour', label: 'Behaviour' },
  { value: 'other', label: 'Something else' },
];

function describe(error: unknown): string {
  const err = error as { message?: string; code?: string } | null;
  if (err?.code === 'PGRST205' || err?.code === '42P01') {
    return 'Booking protection is not set up yet — run supabase/008_booking_protection.sql.';
  }
  return err?.message ?? 'Something went wrong.';
}

/** The published cancellation policy. Shown before booking and before cancelling. */
export async function listRefundRules(): Promise<RefundRule[]> {
  const { data, error } = await supabase
    .from('refund_rules')
    .select('*')
    .eq('active', true)
    .order('min_days_before', { ascending: false });

  if (error) throw new Error(describe(error));
  return (data as RefundRule[]) ?? [];
}

export interface CancelOutcome {
  cancellationId: string;
  daysBefore: number;
  refundPercent: number;
  refundAmount: number;
  advanceAmount: number;
  needsRefund: boolean;
  message: string;
}

export async function cancelBooking(params: {
  rentalId?: string;
  bookingId?: string;
  reason: string;
}): Promise<CancelOutcome> {
  const response = await fetch('/api/bookings/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? 'Could not cancel that booking.');
  return body as CancelOutcome;
}

export async function raiseDispute(params: {
  raisedBy: string;
  raisedRole: 'customer' | 'artist';
  againstId?: string | null;
  rentalId?: string | null;
  bookingId?: string | null;
  category: DisputeCategory;
  description: string;
}): Promise<void> {
  if (!params.description?.trim() || params.description.trim().length < 10) {
    throw new Error('Please describe what happened in a little more detail.');
  }

  const { error } = await supabase.from('disputes').insert({
    raised_by: params.raisedBy,
    raised_role: params.raisedRole,
    against_id: params.againstId ?? null,
    rental_id: params.rentalId ?? null,
    booking_id: params.bookingId ?? null,
    category: params.category,
    description: params.description.trim(),
  });

  if (error) throw new Error(describe(error));
}

/** Preview of what a customer would get back, before they commit. */
export function previewRefund(
  rules: RefundRule[],
  daysBefore: number,
  advanceAmount: number
): { percent: number; amount: number; label: string } {
  const rule = rules
    .filter((r) => r.min_days_before <= Math.max(daysBefore, 0))
    .sort((a, b) => b.min_days_before - a.min_days_before)[0];

  const percent = rule?.refund_percent ?? 0;
  return {
    percent,
    amount: Math.round((advanceAmount * percent) / 100),
    label: rule?.label ?? 'No refund applies to this date.',
  };
}
