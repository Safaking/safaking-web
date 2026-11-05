'use client';

import { Printer } from 'lucide-react';
import type { DBOrder } from '@/lib/supabase';
import { rupees } from '@/lib/supplier';

/**
 * Everything an order actually holds, in one place.
 *
 * The orders table shows six columns because six is what fits across a row.
 * An order carries about twenty-five fields, and the missing nineteen were
 * not unimportant — the email to write to, the pincode delivery is costed on,
 * the wedding the safa has to arrive before, the payment id to quote when a
 * customer says they paid, the reason it was cancelled. None of it was on
 * screen anywhere, so answering an ordinary question about an order meant
 * opening the database.
 *
 * Shown as a row that expands under its order rather than a separate page, so
 * the list keeps its place while somebody checks one.
 */

export type OrderLine = {
  order_id: string;
  product_name: string;
  quantity: number;
  price: number;
};

const day = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const moment = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
      });
};

/** One labelled fact. A dash rather than a blank: an empty field is an answer. */
function Fact({ label, value, strong }: { label: string; value?: string | number | null; strong?: boolean }) {
  const shown = value === null || value === undefined || value === '' ? '—' : String(value);
  const missing = shown === '—';
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-black uppercase tracking-wider text-maroon-800/50">{label}</dt>
      <dd
        className={`mt-0.5 break-words text-[11px] ${
          missing ? 'text-gray-300' : strong ? 'font-bold text-maroon-950' : 'text-gray-700'
        }`}
      >
        {shown}
      </dd>
    </div>
  );
}

/** One line of the money ladder. */
function Row({
  label, value, note, rule, strong, indent,
}: {
  label: string; value: string; note?: string; rule?: boolean; strong?: boolean; indent?: boolean;
}) {
  return (
    <tr className={rule ? 'border-t border-amber-100' : ''}>
      <td className={`py-1 ${indent ? 'pl-3' : ''} ${strong ? 'font-black text-maroon-950' : 'text-gray-600'}`}>
        {label}
        {note && <span className="ml-1.5 font-semibold text-gray-400">({note})</span>}
      </td>
      <td className={`py-1 text-right ${strong ? 'font-black text-maroon-950' : 'text-gray-700'}`}>
        {value}
      </td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-amber-100 bg-white p-3.5">
      <h4 className="mb-2.5 text-[10px] font-black uppercase tracking-widest text-maroon-800">{title}</h4>
      {children}
    </section>
  );
}

export default function OrderDetails({ order, lines }: { order: DBOrder; lines: OrderLine[] }) {
  const itemsTotal = lines.reduce((sum, l) => sum + Number(l.price) * Number(l.quantity), 0);
  const advance = order.advance_amount ?? Math.round(order.total_amount * 0.5);
  const balance = order.balance_amount ?? order.total_amount - advance;
  const credit = Number(order.credit_applied ?? 0);
  // What they actually owe: checkout takes credit off the total and splits
  // the remainder into the advance and the balance.
  const payable = order.total_amount - credit;
  const isFullyPaid = order.payment_status === 'fully_paid';

  return (
    <div className="grid gap-3 bg-amber-50/40 p-4 md:grid-cols-2 xl:grid-cols-3">
      {/* What goes in the parcel. First, because it is the question the panel
          could never answer. */}
      <Section title="Items">
        {lines.length === 0 ? (
          <p className="text-[11px] font-semibold text-gray-400">
            No items recorded against this order.
          </p>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[9px] font-black uppercase tracking-wider text-maroon-800/50">
                <th className="pb-1 text-left font-black">Qty</th>
                <th className="pb-1 text-left font-black">Item</th>
                <th className="pb-1 text-right font-black">Rate</th>
                <th className="pb-1 text-right font-black">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {lines.map((l, i) => (
                <tr key={`${l.product_name}-${i}`}>
                  <td className="py-1 font-bold text-maroon-950">{l.quantity}</td>
                  <td className="py-1 pr-2 text-gray-700">{l.product_name}</td>
                  <td className="py-1 text-right text-gray-500">{rupees(Number(l.price))}</td>
                  <td className="py-1 text-right font-bold text-maroon-950">
                    {rupees(Number(l.price) * Number(l.quantity))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-amber-100">
                <td colSpan={3} className="pt-1.5 text-right text-[9px] font-black uppercase tracking-wider text-maroon-800/50">
                  Items subtotal
                </td>
                <td className="pt-1.5 text-right font-black text-maroon-950">{rupees(itemsTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <a
          href={`/api/label/${order.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-maroon-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-maroon-800 hover:border-maroon-400"
        >
          <Printer size={11} /> Print address label
        </a>
      </Section>

      <Section title="Customer">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <Fact label="Name" value={order.customer_name} strong />
          <Fact label="Phone" value={order.customer_phone} strong />
          <Fact label="Email" value={order.customer_email} />
          <Fact label="Came from" value={order.lead_source} />
          <Fact label="Account" value={order.customer_id ? 'Registered' : 'Guest order'} />
        </dl>
      </Section>

      <Section title="Delivery">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <div className="col-span-2">
            <Fact label="Shipping address" value={order.shipping_address} strong />
          </div>
          <Fact label="Pincode" value={order.pincode} strong />
          <Fact label="Needed by (wedding)" value={day(order.wedding_date)} strong />
          <Fact
            label="Delivery charge"
            value={order.shipping_amount ? rupees(order.shipping_amount) : 'Free (own stock)'}
          />
          <Fact label="Taken off stock" value={order.stock_applied ? 'Yes' : 'Not yet'} />
        </dl>
      </Section>

      {/* A ladder rather than six loose figures, because the question an
          admin actually has is "why is the total not what the items add up
          to" — and the answer is delivery on top and credit off the payable.
          Credit is NOT deducted from total_amount: checkout computes
          payable = total - credit, and it is the advance and balance that
          carry it. Showing it any other way sends somebody chasing a
          shortfall that was a referral reward being spent. */}
      <Section title="Money">
        <table className="w-full text-[11px]">
          <tbody>
            <Row label="Items" value={rupees(itemsTotal)} />
            <Row label="Delivery" value={order.shipping_amount ? rupees(order.shipping_amount) : '—'} />
            <Row label="Order total" value={rupees(order.total_amount)} rule strong />
            {credit > 0 && <Row label="Referral credit" value={`− ${rupees(credit)}`} />}
            <Row label="Payable" value={rupees(payable)} rule strong />
            <Row
              label="Advance"
              value={rupees(advance)}
              note={order.payment_status === 'advance_pending' ? 'not received' : 'paid'}
              indent
            />
            <Row
              label="Balance"
              value={rupees(balance)}
              note={isFullyPaid ? 'collected' : 'due'}
              indent
            />
          </tbody>
        </table>

        {/* The lines and the total disagreeing is worth saying out loud: it
            means the order was edited after it was placed, and whichever
            figure somebody trusts, one of them is wrong. */}
        {lines.length > 0 && itemsTotal + Number(order.shipping_amount ?? 0) !== order.total_amount && (
          <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-[10px] font-bold text-rose-700">
            Items and delivery come to{' '}
            {rupees(itemsTotal + Number(order.shipping_amount ?? 0))}, not the{' '}
            {rupees(order.total_amount)} on the order.
          </p>
        )}
        {advance + balance !== payable && (
          <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-[10px] font-bold text-rose-700">
            Advance and balance come to {rupees(advance + balance)}, not the{' '}
            {rupees(payable)} payable. Someone asked for the wrong amount.
          </p>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-amber-100 pt-2.5">
          <Fact label="Payment status" value={order.payment_status?.replace(/_/g, ' ')} strong />
          <Fact label="Paid by" value={order.payment_mode} />
        </dl>
      </Section>

      <Section title="Paperwork">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <Fact label="Order id" value={order.id.slice(0, 8).toUpperCase()} strong />
          <Fact label="Invoice number" value={order.invoice_number} />
          <Fact label="Ordered on" value={moment(order.created_at)} />
          <Fact label="Status" value={order.status} strong />
          <div className="col-span-2">
            {/* Quoted back when a customer says the money left their account. */}
            <Fact label="Razorpay payment id" value={order.razorpay_payment_id} />
          </div>
          <div className="col-span-2">
            <Fact label="Full order id" value={order.id} />
          </div>
        </dl>
      </Section>

      {(order.notes || order.cancellation_reason || order.return_reason) && (
        <Section title="Notes & history">
          <dl className="grid gap-2.5">
            {order.notes && <Fact label="Notes" value={order.notes} />}
            {order.cancellation_reason && (
              <Fact
                label={`Cancelled${moment(order.cancelled_at) ? ` — ${moment(order.cancelled_at)}` : ''}`}
                value={order.cancellation_reason}
              />
            )}
            {order.return_reason && (
              <Fact
                label={`Return asked for${
                  moment(order.return_requested_at) ? ` — ${moment(order.return_requested_at)}` : ''
                }`}
                value={order.return_reason}
              />
            )}
            {!!order.postal_charge_deducted && (
              <Fact label="Postage withheld" value={rupees(order.postal_charge_deducted)} />
            )}
          </dl>
        </Section>
      )}
    </div>
  );
}
