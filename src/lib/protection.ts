'use client';

import { supabase } from '@/lib/supabase';
import type { CancelReasonCode } from '@/lib/cancellation-reasons';

export interface RefundRule {
  id: string;
  min_days_before: number | null;
  /** The real boundary — the policy has a 48-hour step that days cannot express. */
  min_hours_before: number | null;
  refund_percent: number;
  label: string;
  active: boolean;
}

export interface Cancellation {
  id: string;
  rental_id: string | null;
  booking_id: string | null;
  order_id: string | null;
  requested_by: string | null;
  requested_role: 'customer' | 'artist' | 'admin' | 'manager';
  reason: string;
  reason_code: CancelReasonCode | null;
  event_date: string | null;
  days_before: number | null;
  hours_before: number | null;
  rule_label: string | null;
  refund_percent: number;
  advance_amount: number;
  paid_amount: number;
  tax_amount: number;
  non_refundable_fee: number;
  eligible_amount: number;
  refund_amount: number;
  status: 'requested' | 'approved' | 'rejected' | 'refunded' | 'no_refund';
  admin_note: string | null;
  razorpay_refund_id: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  processed_by: string | null;
  processed_at: string | null;
  refund_method: 'gateway' | 'upi' | 'bank' | 'cash' | null;
  refund_reference: string | null;
  reconciled_by: string | null;
  reconciled_at: string | null;
  reconciliation_note: string | null;
  exception_percent: number | null;
  exception_reason: string | null;
  exception_requested_by: string | null;
  exception_requested_at: string | null;
  exception_approved_by: string | null;
  exception_approved_at: string | null;
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
  if (err?.code === 'PGRST202') {
    return 'Cancellation pricing is not set up yet — run supabase/035_refund_tiers_and_maker_checker.sql.';
  }
  return err?.message ?? 'Something went wrong.';
}

/** The published cancellation policy. Shown before booking and before cancelling. */
export async function listRefundRules(): Promise<RefundRule[]> {
  const { data, error } = await supabase
    .from('refund_rules')
    .select('*')
    .eq('active', true)
    .order('min_hours_before', { ascending: false });

  if (error) throw new Error(describe(error));
  return (data as RefundRule[]) ?? [];
}

/** What cancelling right now would give back — the same figure the server records. */
export interface CancellationQuote {
  kind: 'rental' | 'booking';
  id: string;
  status: string;
  payment_status: string | null;
  event_at: string | null;
  hours_before: number;
  days_before: number;
  refund_percent: number;
  rule_label: string;
  paid_amount: number;
  tax_amount: number;
  non_refundable_fee: number;
  eligible_amount: number;
  refund_amount: number;
  paid: boolean;
}

export async function quoteCancellation(kind: 'rental' | 'booking', id: string): Promise<CancellationQuote> {
  const { data, error } = await supabase.rpc('quote_cancellation', { p_kind: kind, p_id: id });
  if (error) throw new Error(describe(error));
  return data as CancellationQuote;
}

export interface CancelOutcome {
  cancellationId: string;
  hoursBefore: number;
  daysBefore: number;
  ruleLabel: string;
  refundPercent: number;
  paidAmount: number;
  taxAmount: number;
  nonRefundableFee: number;
  eligibleAmount: number;
  refundAmount: number;
  needsRefund: boolean;
  exceptionPending: boolean;
  message: string;
}

export async function cancelBooking(params: {
  rentalId?: string;
  bookingId?: string;
  reasonCode: CancelReasonCode;
  reason?: string;
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

/** Where a refund has got to. Derived, so it can never disagree with the columns. */
export type CancellationStage =
  | 'requested' | 'verified' | 'approved' | 'refunded' | 'closed' | 'rejected' | 'no_refund';

export function cancellationStage(c: Cancellation): CancellationStage {
  if (c.status === 'rejected') return 'rejected';
  if (c.status === 'no_refund') return 'no_refund';
  if (c.status === 'refunded') return c.reconciled_at ? 'closed' : 'refunded';
  if (c.status === 'approved') return 'approved';
  return c.verified_by ? 'verified' : 'requested';
}

export const STAGE_LABEL: Record<CancellationStage, string> = {
  requested: 'Awaiting verification',
  verified: 'Awaiting approval',
  approved: 'Approved — to be sent',
  refunded: 'Sent — to reconcile',
  closed: 'Closed',
  rejected: 'Refused',
  no_refund: 'No refund due',
};

export type RefundAction =
  | 'verify' | 'approve' | 'reject' | 'process' | 'reconcile'
  | 'propose_exception' | 'approve_exception' | 'reject_exception';

export async function refundAction(params: {
  cancellationId: string;
  action: RefundAction;
  note?: string;
  refundMethod?: 'gateway' | 'upi' | 'bank' | 'cash';
  refundReference?: string;
  exceptionPercent?: number;
}): Promise<Cancellation> {
  const response = await fetch('/api/bookings/refund', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? 'That step could not be recorded.');
  return body.cancellation as Cancellation;
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
