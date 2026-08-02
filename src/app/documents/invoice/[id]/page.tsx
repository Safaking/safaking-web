import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase-server';
import { DocumentShell } from '@/components/documents/DocumentShell';

export const dynamic = 'force-dynamic';

interface Business {
  legal_name: string;
  address: string;
  phone: string;
  email: string | null;
  gst_number: string | null;
  invoice_footer: string | null;
}

function money(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function NotAvailable({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#FDF6EC] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-amber-200/60 p-10 max-w-md text-center">
        <p className="text-sm font-bold text-gray-700">{message}</p>
        <Link
          href="/"
          className="inline-block mt-4 px-5 py-2.5 bg-maroon-950 text-royal-300 text-xs font-bold uppercase tracking-wider rounded-xl"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

/**
 * Invoice for a purchase order.
 *
 * Read with the visitor's own session, so RLS decides visibility: a customer
 * can only open their own invoice, an admin can open any. No id-guessing leak.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!order) {
    return <NotAvailable message="That invoice is not available, or you are not signed in as its owner." />;
  }

  const [{ data: items }, { data: business }, { data: invoiceNumber }] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', id),
    supabase.from('business_profile').select('*').maybeSingle(),
    supabase.rpc('ensure_invoice_number', { p_kind: 'order', p_id: id }),
  ]);

  const biz = (business as Business) ?? {
    legal_name: 'SafaKing Turban House',
    address: 'Jaipur, Rajasthan, India',
    phone: '',
    email: null,
    gst_number: null,
    invoice_footer: null,
  };

  const lines = items ?? [];
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  return (
    <DocumentShell title="Invoice" backHref="/my-bookings">
      <header className="flex flex-wrap justify-between gap-6 pb-6 border-b-2 border-maroon-950">
        <div>
          <h1 className="text-2xl font-display font-black text-maroon-950 uppercase tracking-widest">
            {biz.legal_name}
          </h1>
          <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">{biz.address}</p>
          <p className="text-xs text-gray-600">{biz.phone}</p>
          {biz.email && <p className="text-xs text-gray-600">{biz.email}</p>}
          {biz.gst_number && (
            <p className="text-xs text-gray-600 mt-1">GSTIN: {biz.gst_number}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-display font-black text-maroon-950 uppercase tracking-wider">
            Invoice
          </p>
          <p className="text-sm font-mono font-bold text-maroon-800 mt-1">
            {(invoiceNumber as string) ?? order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(order.created_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
          <span
            className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              order.payment_status === 'fully_paid'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {(order.payment_status ?? 'unpaid').replace('_', ' ')}
          </span>
        </div>
      </header>

      <section className="py-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
          Billed to
        </p>
        <p className="font-bold text-maroon-950">{order.customer_name}</p>
        <p className="text-xs text-gray-600">{order.customer_phone}</p>
        {order.customer_email && <p className="text-xs text-gray-600">{order.customer_email}</p>}
        <p className="text-xs text-gray-600 mt-1 max-w-sm">{order.shipping_address}</p>
      </section>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-y border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-500">
            <th className="py-2.5">Item</th>
            <th className="py-2.5 text-center w-16">Qty</th>
            <th className="py-2.5 text-right w-24">Rate</th>
            <th className="py-2.5 text-right w-28">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lines.map((line) => (
            <tr key={line.id}>
              <td className="py-3 text-maroon-950">{line.product_name}</td>
              <td className="py-3 text-center text-gray-600">{line.quantity}</td>
              <td className="py-3 text-right text-gray-600">{money(line.price)}</td>
              <td className="py-3 text-right font-bold text-maroon-950">
                {money(line.price * line.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex justify-end mt-6">
        <div className="w-full sm:w-72 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Delivery</span>
            <span className="text-emerald-700 font-bold">FREE</span>
          </div>
          <div className="flex justify-between text-lg font-display font-black text-maroon-950 pt-2 border-t-2 border-maroon-950">
            <span>Total</span>
            <span>{money(order.total_amount)}</span>
          </div>
          {order.advance_amount != null && (
            <>
              <div className="flex justify-between text-xs text-gray-600 pt-2">
                <span>Advance received</span>
                <span className="font-bold">{money(order.advance_amount)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Balance due on delivery</span>
                <span className="font-bold">{money(order.balance_amount ?? 0)}</span>
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="mt-10 pt-5 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-500">{biz.invoice_footer}</p>
        {!biz.gst_number && (
          // Being explicit avoids an unregistered invoice being mistaken for a
          // tax invoice by a customer's accountant.
          <p className="text-[10px] text-gray-400 mt-2">
            This is not a GST tax invoice.
          </p>
        )}
      </footer>
    </DocumentShell>
  );
}
