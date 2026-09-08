'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MapPoint } from '@/components/liveops/LiveMap';

const LiveMap = dynamic(
  () => import('@/components/liveops/LiveMap').then((m) => m.LiveMap),
  { ssr: false, loading: () => <div className="h-[420px] rounded-2xl bg-royal-50 animate-pulse" /> }
);

interface Row {
  artistName: string;
  customerName: string;
  lat: number;
  lng: number;
  at: string;
  eta: number | null;
  venueLat: number | null;
  venueLng: number | null;
}

/**
 * Everyone who is moving today, on one map.
 *
 * The board next to this answers "is anything at risk"; this answers the
 * question that follows it — where actually is he, and how far from the
 * venue. Positions come from the artists' own pings, so an artist who has
 * closed the portal simply stops updating rather than vanishing.
 */
export function LiveOpsMap() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = new Date().toLocaleDateString('en-CA');

    const [bookings, rentals] = await Promise.all([
      supabase
        .from('artist_bookings')
        .select('id, artist_name, customer_name, customer_lat, customer_lng')
        .eq('event_date', today)
        .not('artist_id', 'is', null),
      supabase
        .from('rental_bookings')
        .select('id, artist_name, customer_name, customer_lat, customer_lng')
        .eq('start_date', today)
        .not('artist_id', 'is', null),
    ]);

    const jobs = [...(bookings.data ?? []), ...(rentals.data ?? [])];
    if (jobs.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const ids = jobs.map((j) => j.id);
    const { data: locs } = await supabase
      .from('artist_locations')
      .select('rental_id, booking_id, latitude, longitude, eta_minutes, recorded_at')
      .or(`rental_id.in.(${ids.join(',')}),booking_id.in.(${ids.join(',')})`)
      .order('recorded_at', { ascending: false });

    const latest = new Map<string, { lat: number; lng: number; at: string; eta: number | null }>();
    for (const l of locs ?? []) {
      const key = (l.rental_id ?? l.booking_id) as string;
      if (key && !latest.has(key) && l.latitude != null) {
        latest.set(key, { lat: l.latitude, lng: l.longitude, at: l.recorded_at, eta: l.eta_minutes });
      }
    }

    setRows(
      jobs
        .map((j) => {
          const pos = latest.get(j.id);
          if (!pos) return null;
          return {
            artistName: j.artist_name ?? 'Artist',
            customerName: j.customer_name,
            lat: pos.lat, lng: pos.lng, at: pos.at, eta: pos.eta,
            venueLat: j.customer_lat, venueLng: j.customer_lng,
          } as Row;
        })
        .filter(Boolean) as Row[]
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const points: MapPoint[] = rows.flatMap((r) => [
    {
      lat: r.lat, lng: r.lng, kind: 'artist' as const, label: r.artistName,
      sub: `For ${r.customerName}${r.eta != null ? ` · about ${r.eta} min away` : ''}`,
    },
    ...(r.venueLat != null && r.venueLng != null
      ? [{ lat: r.venueLat, lng: r.venueLng, kind: 'venue' as const, label: `${r.customerName}'s venue` }]
      : []),
  ]);

  return (
    <div className="bg-white rounded-3xl border border-amber-200/70 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
            <MapPin size={18} className="text-emerald-600" /> Where everyone is right now
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Today&apos;s jobs · refreshes every minute · positions come from the artists&apos; own
            check-in screens
          </p>
        </div>
        <button onClick={load}
          className="px-3 py-2 rounded-xl bg-white border border-amber-200/70 hover:bg-amber-50 text-[11px] font-bold text-maroon-900 flex items-center gap-1.5">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={22} className="animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs font-bold text-gray-600">Finding your artists…</p>
          </div>
        ) : points.length === 0 ? (
          <p className="py-14 text-center text-sm text-gray-500">
            Nobody is sharing a position right now. An artist appears here once they tap
            &ldquo;On my way&rdquo; in their portal and keep the page open.
          </p>
        ) : (
          <div className="space-y-4">
            <LiveMap points={points} height={420} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {rows.map((r, i) => (
                <div key={i} className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/70">
                  <p className="font-bold text-[13px] text-maroon-950">{r.artistName}</p>
                  <p className="text-[11px] text-gray-600">for {r.customerName}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {r.eta != null ? <b className="text-emerald-800">about {r.eta} min away</b> : 'ETA unknown'}
                    {' · '}
                    seen {new Date(r.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
