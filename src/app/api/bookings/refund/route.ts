import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { refundPayment, toPaise } from '@/lib/razorpay';

export const runtime = 'nodejs';

type Action =
  | 'verify'
  | 'approve'
  | 'reject'
  | 'process'
  | 'reconcile'
  | 'propose_exception'
  | 'approve_exception'
  | 'reject_exception';

const ACTIONS: Action[] = [
  'verify', 'approve', 'reject', 'process', 'reconcile',
  'propose_exception', 'approve_exception', 'reject_exception',
];

type Method = 'gateway' | 'upi' | 'bank' | 'cash';

interface Body {
  cancellationId?: string;
  action?: Action;
  note?: string;
  refundMethod?: Method;
  refundReference?: string;
  exceptionPercent?: number;
}

type Admin = ReturnType<typeof createAdminClient>;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function findPayment(admin: Admin, c: { rental_id: string | null; booking_id: string | null; order_id: string | null }) {
  const base = () => admin.from('payments').select('razorpay_payment_id, amount, status').eq('status', 'paid');
  if (c.rental_id) return (await base().eq('rental_id', c.rental_id).maybeSingle()).data;
  // Artist-booking payments are keyed by booking_id; the old lookup never
  // checked it, so an artist booking's refund could never be found.
  if (c.booking_id) return (await base().eq('booking_id', c.booking_id).maybeSingle()).data;
  if (c.order_id) return (await base().eq('order_id', c.order_id).maybeSingle()).data;
  return null;
}

/**
 * Every step of a refund, each by a named member of staff.
 *
 *   verify -> approve -> process (money sent) -> reconcile (closed)
 *
 * Nobody does two of the gates that matter on one refund: whoever raised it
 * cannot verify it, whoever verified cannot approve, whoever approved cannot
 * send the money, whoever sent it cannot reconcile it. A different percentage
 * than the policy gives exists only as an exception that a second manager or
 * the owner approves.
 *
 * The checks here exist to give a clear message. The database trigger
 * (supabase/035) enforces every one of them again, so a mistake in this file
 * cannot quietly let a single person move money.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  const action = body.action;
  if (!body.cancellationId) return bad('Which cancellation?');
  if (!action || !ACTIONS.includes(action)) return bad('Unknown action.');

  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[refund]', error);
    return bad('Refunds are not configured yet.', 503);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad('Sign in.', 401);

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = profile?.role as string | undefined;
  if (role !== 'admin' && role !== 'manager') return bad('Only SafaKing staff can work refunds.', 403);

  const { data: c, error: loadErr } = await admin
    .from('cancellations')
    .select('*')
    .eq('id', body.cancellationId)
    .maybeSingle();
  if (loadErr || !c) return bad('Cancellation not found.', 404);

  const me = user.id;
  const now = new Date().toISOString();
  const note = body.note?.trim() || null;

  const commit = async (patch: Record<string, unknown>) => {
    const { data, error } = await admin
      .from('cancellations')
      .update(patch)
      .eq('id', c.id)
      .select('*')
      .single();
    if (error) return bad(error.message, 409);
    return NextResponse.json({ success: true, cancellation: data });
  };

  switch (action) {
    case 'verify': {
      if (c.status !== 'requested') return bad('Only a refund still awaiting review can be verified.');
      if (c.verified_by) return bad('This refund is already verified.');
      if (c.requested_by === me) return bad('You raised this cancellation, so someone else must verify it.');
      return commit({ verified_by: me, verified_at: now, verification_note: note });
    }

    case 'approve': {
      if (c.status !== 'requested') return bad('Only a refund awaiting review can be approved.');
      if (!c.verified_by) return bad('Verify it first — every refund is signed off by two different people.');
      if (c.verified_by === me) {
        return bad('You verified this refund, so a different manager or the owner must approve it.');
      }
      if (c.requested_by === me) return bad('You raised this cancellation, so someone else must approve it.');
      if (c.exception_requested_by && !c.exception_approved_by) {
        return bad('An exception is waiting on this refund — decide that first.');
      }
      return commit({ status: 'approved', reviewed_by: me, reviewed_at: now, admin_note: note ?? c.admin_note });
    }

    case 'reject': {
      if (c.status !== 'requested') return bad('Only a refund awaiting review can be refused.');
      if (!note) return bad('Write why this refund is being refused — the customer is told.');
      if (c.requested_by === me) return bad('You raised this cancellation, so someone else must decide it.');
      return commit({ status: 'rejected', reviewed_by: me, reviewed_at: now, admin_note: note });
    }

    case 'process': {
      if (c.status !== 'approved') return bad('Only an approved refund can be sent.');
      if (c.reviewed_by === me) return bad('You approved this refund, so someone else must send it.');

      const method: Method = body.refundMethod ?? 'gateway';
      let patch: Record<string, unknown>;

      if (method === 'gateway') {
        const payment = await findPayment(admin, c);
        if (!payment?.razorpay_payment_id) {
          return bad(
            'No online payment is on file for this booking. Send it by UPI, bank or cash and record the reference.',
            409
          );
        }
        const paise = toPaise(c.refund_amount);
        if (paise > payment.amount) {
          return bad(`Refund (₹${c.refund_amount}) is more than the ₹${payment.amount / 100} captured.`, 409);
        }
        try {
          const refund = await refundPayment(payment.razorpay_payment_id, paise, {
            cancellation_id: c.id,
            reason: String(c.reason).slice(0, 100),
          });
          patch = {
            status: 'refunded', refund_method: 'gateway', razorpay_refund_id: refund.id,
            processed_by: me, processed_at: now,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Refund failed.';
          await admin.from('cancellations').update({ admin_note: `Gateway refund failed: ${message}` }).eq('id', c.id);
          return bad(message, 502);
        }
      } else {
        if (!['upi', 'bank', 'cash'].includes(method)) return bad('Unknown refund method.');
        const reference = body.refundReference?.trim();
        if (!reference) return bad('Record the UPI / bank transaction id, or who handed the cash over and to whom.');
        patch = {
          status: 'refunded', refund_method: method, refund_reference: reference,
          processed_by: me, processed_at: now,
        };
      }

      const response = await commit(patch);
      if (response.status === 200) {
        const table = c.rental_id ? 'rental_bookings' : c.booking_id ? 'artist_bookings' : c.order_id ? 'orders' : null;
        const target = c.rental_id ?? c.booking_id ?? c.order_id;
        if (table && target) {
          // Best effort — the refund itself is already recorded.
          await admin.from(table).update({ payment_status: 'refunded' }).eq('id', target);
        }
      }
      return response;
    }

    case 'reconcile': {
      if (c.status !== 'refunded') return bad('Only a refund that has been sent can be reconciled.');
      if (c.reconciled_at) return bad('This refund is already reconciled.');
      if (c.processed_by === me) return bad('You sent this refund, so someone else must reconcile it against the bank.');
      return commit({ reconciled_by: me, reconciled_at: now, reconciliation_note: note });
    }

    case 'propose_exception': {
      if (!['requested', 'no_refund'].includes(c.status)) {
        return bad('An exception can only be proposed before the refund is approved.');
      }
      if (c.exception_requested_by) return bad('An exception has already been proposed for this refund.');
      if (c.eligible_amount <= 0) return bad('Nothing refundable was paid on this booking.');
      const pct = Number(body.exceptionPercent);
      if (!Number.isInteger(pct) || pct < 0 || pct > 100) return bad('Enter a whole percentage between 0 and 100.');
      if (pct === c.refund_percent) return bad('That is already the policy percentage.');
      if (!note) return bad('An exception needs a written reason.');
      return commit({
        exception_percent: pct, exception_reason: note,
        exception_requested_by: me, exception_requested_at: now,
      });
    }

    case 'approve_exception': {
      if (!c.exception_requested_by || c.exception_approved_by) return bad('There is no exception waiting.');
      if (c.exception_requested_by === me) {
        return bad('You proposed this exception, so a different manager or the owner must approve it.');
      }
      if (c.requested_by === me) return bad('You raised this cancellation, so someone else must decide the exception.');
      const pct = Number(c.exception_percent);
      const amount = Math.round((c.eligible_amount * pct) / 100);
      return commit({
        exception_approved_by: me,
        exception_approved_at: now,
        refund_percent: pct,
        refund_amount: amount,
        // The amount changed, so the earlier verification no longer covers it.
        verified_by: null,
        verified_at: null,
        verification_note: null,
        status: c.status === 'no_refund' && amount > 0 ? 'requested' : c.status,
      });
    }

    case 'reject_exception': {
      if (!c.exception_requested_by || c.exception_approved_by) return bad('There is no exception waiting.');
      if (c.exception_requested_by === me) return bad('You proposed this exception, so someone else must decide it.');
      if (!note) return bad('Write why the exception is refused.');
      return commit({
        exception_percent: null, exception_reason: null,
        exception_requested_by: null, exception_requested_at: null,
        admin_note: `Exception refused: ${note}`,
      });
    }
  }
}
