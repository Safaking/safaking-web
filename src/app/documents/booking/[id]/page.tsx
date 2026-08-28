import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase-server';
import { DocumentShell } from '@/components/documents/DocumentShell';
import { BUSINESS } from '@/lib/business';

export const dynamic = 'force-dynamic';

function money(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function longDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Booking Confirmation PDF — the sheet a customer shows at the venue. */
export default async function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: rental } = await supabase
    .from('rental_bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!rental) {
    return (
      <div className="min-h-screen bg-[#FDF6EC] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-amber-200/60 p-10 max-w-md text-center">
          <p className="text-sm font-bold text-gray-700">
            That booking is not available, or you are not signed in as its owner.
          </p>
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

  const [{ data: items }, { data: business }] = await Promise.all([
    supabase.from('rental_items').select('*').eq('rental_id', id),
    supabase.from('business_profile').select('*').maybeSingle(),
  ]);

  const biz = business ?? { legal_name: 'SafaKing Turban House', phone: BUSINESS.phone, address: BUSINESS.address };
  const lines = items ?? [];

  return (
    <DocumentShell title="Booking Confirmation" backHref="/my-bookings">
      <header className="text-center pb-6 border-b-2 border-maroon-950">
        <h1 className="text-2xl font-display font-black text-maroon-950 uppercase tracking-widest">
          {biz.legal_name}
        </h1>
        <p className="text-sm font-bold text-maroon-800 uppercase tracking-[0.3em] mt-2">
          Booking Confirmation
        </p>
        <p className="text-xs font-mono font-bold text-gray-600 mt-2">
          Ref {rental.id.slice(0, 8).toUpperCase()}
        </p>
      </header>

      <section className="grid sm:grid-cols-2 gap-6 py-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
            Event
          </p>
          <p className="font-bold text-maroon-950">{longDate(rental.start_date)}</p>
          {rental.end_date !== rental.start_date && (
            <p className="text-xs text-gray-600">until {longDate(rental.end_date)}</p>
          )}
          <p className="text-xs text-gray-600 mt-2 max-w-xs">{rental.venue_address}</p>
          <p className="text-xs text-gray-600">Pincode {rental.pincode}</p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
            Booked by
          </p>
          <p className="font-bold text-maroon-950">{rental.customer_name}</p>
          <p className="text-xs text-gray-600">{rental.customer_phone}</p>

          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-4 mb-1">
            Safa Artist
          </p>
          <p className="text-sm text-maroon-950">
            {rental.needs_artist
              ? rental.artist_name ?? 'To be assigned — we will confirm before the event'
              : 'Not requested'}
          </p>
        </div>
      </section>

      <section className="py-4 border-y border-gray-200">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
          {rental.safa_count} safa{rental.safa_count === 1 ? '' : 's'} reserved
        </p>
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-gray-100">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2.5 text-maroon-950">{line.product_name}</td>
                <td className="py-2.5 text-center w-20 text-gray-600">× {line.quantity}</td>
                <td className="py-2.5 text-right w-28 font-bold text-maroon-950">
                  {money(line.line_rent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex justify-end py-6">
        <div className="w-full sm:w-72 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Rental ({rental.rental_days} day{rental.rental_days === 1 ? '' : 's'})</span>
            <span>{money(rental.rent_amount)}</span>
          </div>
          {rental.artist_amount > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Artist tying</span>
              <span>{money(rental.artist_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Refundable deposit</span>
            <span>{money(rental.deposit_amount)}</span>
          </div>
          <div className="flex justify-between text-lg font-display font-black text-maroon-950 pt-2 border-t-2 border-maroon-950">
            <span>Total</span>
            <span>{money(rental.total_amount)}</span>
          </div>
          <div className="flex justify-between text-xs text-emerald-800 font-bold pt-2">
            <span>Advance received</span>
            <span>{money(rental.advance_amount)}</span>
          </div>
          <div className="flex justify-between text-xs text-amber-900 font-bold">
            <span>Balance at event</span>
            <span>{money(rental.balance_amount)}</span>
          </div>
        </div>
      </section>

      <footer className="pt-5 border-t border-gray-200 text-center space-y-1">
        <p className="text-xs font-bold text-maroon-900">
          Please keep this confirmation with you on the event day.
        </p>
        <p className="text-xs text-gray-500">
          Questions? Call {biz.phone}. The refundable deposit is returned after the safas come back.
        </p>
      </footer>
    </DocumentShell>
  );
}
