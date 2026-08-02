'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp, Crown, Package, Loader2, AlertCircle, IndianRupee, ShieldCheck,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';

interface TopProduct {
  product_id: string | null;
  product_name: string;
  units_sold: number;
  units_rented: number;
  total_units: number;
  sale_revenue: number;
  rental_revenue: number;
  total_revenue: number;
  times_booked: number;
}

interface TopArtist {
  artist_id: string;
  display_name: string;
  base_city: string | null;
  verified: boolean;
  rating: number | null;
  tying_bookings: number;
  rental_bookings: number;
  artist_earnings: number;
  review_count: number;
}

interface MonthlyRevenue {
  month: string;
  sale_revenue: number;
  rental_revenue: number;
  artist_revenue: number;
  deposits_held: number;
  total_revenue: number;
  order_count: number;
  rental_count: number;
}

const money = (v: number) => `₹${(v ?? 0).toLocaleString('en-IN')}`;

/** Simple proportional bar — no chart dependency for three small tables. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full bg-amber-100 rounded-full overflow-hidden mt-1">
      <div className="h-full bg-maroon-800 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AnalyticsPanel() {
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [artists, setArtists] = useState<TopArtist[]>([]);
  const [months, setMonths] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [p, a, m] = await Promise.all([
      supabase.from('analytics_top_products').select('*').limit(10),
      supabase.from('analytics_top_artists').select('*').limit(10),
      supabase.from('analytics_revenue_monthly').select('*').limit(12),
    ]);

    const firstError = p.error ?? a.error ?? m.error;
    if (firstError) setError(friendlyError(firstError));

    setProducts((p.data as TopProduct[]) ?? []);
    setArtists((a.data as TopArtist[]) ?? []);
    setMonths((m.data as MonthlyRevenue[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200/60 p-12 text-center">
        <Loader2 size={26} className="animate-spin mx-auto mb-3 text-amber-500" />
        <p className="text-sm font-bold text-gray-600">Crunching numbers…</p>
      </div>
    );
  }

  const thisMonth = months[0];
  const maxUnits = Math.max(1, ...products.map((p) => p.total_units));
  const maxBookings = Math.max(
    1,
    ...artists.map((a) => a.tying_bookings + a.rental_bookings)
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {/* Headline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Revenue this month',
            value: money(thisMonth?.total_revenue ?? 0),
            icon: IndianRupee,
            tone: 'bg-emerald-100 text-emerald-800',
          },
          {
            label: 'Orders this month',
            value: String(thisMonth?.order_count ?? 0),
            icon: Package,
            tone: 'bg-amber-100 text-amber-800',
          },
          {
            label: 'Rentals this month',
            value: String(thisMonth?.rental_count ?? 0),
            icon: TrendingUp,
            tone: 'bg-royal-100 text-royal-800',
          },
          {
            label: 'Deposits held',
            value: money(thisMonth?.deposits_held ?? 0),
            icon: ShieldCheck,
            tone: 'bg-indigo-100 text-indigo-800',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-5 rounded-3xl bg-white border border-amber-200/60 shadow-sm flex items-center gap-4"
          >
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${stat.tone}`}>
              <stat.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {stat.label}
              </p>
              <p className="text-xl font-display font-black text-maroon-950 mt-0.5 truncate">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-500 -mt-2">
        Refundable deposits are shown separately and are excluded from revenue — money held on the
        customer&apos;s behalf is a liability, not income.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top designs */}
        <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-amber-100">
            <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
              <Crown size={18} className="text-amber-600" /> Most Booked Designs
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Sales and rentals combined</p>
          </div>
          {products.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-500">No bookings yet.</p>
          ) : (
            <div className="divide-y divide-amber-100">
              {products.map((product, index) => (
                <div key={product.product_id ?? product.product_name} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-maroon-950 truncate">
                        <span className="text-gray-400 mr-1.5">#{index + 1}</span>
                        {product.product_name}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {product.units_sold} sold · {product.units_rented} rented ·{' '}
                        {product.times_booked} booking{product.times_booked === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm text-gradient-gold">
                        {money(product.total_revenue)}
                      </p>
                      <p className="text-[10px] text-gray-400">{product.total_units} units</p>
                    </div>
                  </div>
                  <Bar value={product.total_units} max={maxUnits} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top artists */}
        <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-amber-100">
            <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
              <TrendingUp size={18} className="text-amber-600" /> Most Booked Artists
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Tying jobs and rentals combined</p>
          </div>
          {artists.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-500">No artists booked yet.</p>
          ) : (
            <div className="divide-y divide-amber-100">
              {artists.map((artist, index) => {
                const total = artist.tying_bookings + artist.rental_bookings;
                return (
                  <div key={artist.artist_id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-maroon-950 truncate flex items-center gap-1.5">
                          <span className="text-gray-400 mr-0.5">#{index + 1}</span>
                          {artist.display_name}
                          {artist.verified && (
                            <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                          )}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {artist.base_city ?? 'Nationwide'} ·{' '}
                          {artist.review_count > 0
                            ? `${artist.rating} ★ (${artist.review_count})`
                            : 'not rated yet'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-sm text-maroon-950">{total}</p>
                        <p className="text-[10px] text-gray-400">
                          {money(artist.artist_earnings)} earned
                        </p>
                      </div>
                    </div>
                    <Bar value={total} max={maxBookings} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Revenue by month */}
      <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-amber-100">
          <h3 className="font-display font-bold text-lg text-maroon-950">Revenue by Month</h3>
        </div>
        {months.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">No revenue recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-amber-100">
                <tr>
                  <th className="p-4">Month</th>
                  <th className="p-4 text-right">Sales</th>
                  <th className="p-4 text-right">Rental</th>
                  <th className="p-4 text-right">Artist</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-right">Deposits held</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 text-xs">
                {months.map((row) => (
                  <tr key={row.month} className="hover:bg-amber-50/30">
                    <td className="p-4 font-bold text-maroon-950">
                      {new Date(row.month).toLocaleDateString('en-IN', {
                        month: 'long', year: 'numeric',
                      })}
                    </td>
                    <td className="p-4 text-right text-gray-700">{money(row.sale_revenue)}</td>
                    <td className="p-4 text-right text-gray-700">{money(row.rental_revenue)}</td>
                    <td className="p-4 text-right text-gray-700">{money(row.artist_revenue)}</td>
                    <td className="p-4 text-right font-black text-gradient-gold">
                      {money(row.total_revenue)}
                    </td>
                    <td className="p-4 text-right text-gray-500">{money(row.deposits_held)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
