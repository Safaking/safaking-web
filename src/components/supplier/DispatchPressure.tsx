'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PackageCheck, Truck, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * What this supplier has waiting, and how late the worst of it is.
 *
 * The standing rule above this is always on screen, which is exactly why it
 * stops being read. A number that changes does not: "2 orders waiting, one 3
 * days late" is about today, and about them.
 *
 * Nothing waiting renders nothing. A banner that is always there is wallpaper.
 */

type Pressure = {
  waiting: number;
  to_pack: number;
  to_send: number;
  overdue: number;
  worst: number;
};

export function DispatchPressure() {
  const [p, setP] = useState<Pressure | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.rpc('my_dispatch_pressure');
      if (!cancelled && data) setP(data as Pressure);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!p || p.waiting === 0) return null;

  const late = p.overdue > 0;

  return (
    <div
      className={`mb-6 rounded-2xl border-2 p-4 ${
        late ? 'border-rose-400 bg-rose-50' : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          {late ? (
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-600" />
          ) : (
            <PackageCheck size={20} className="mt-0.5 shrink-0 text-amber-600" />
          )}
          <div>
            <p className={`text-sm font-black ${late ? 'text-rose-900' : 'text-amber-900'}`}>
              {p.waiting} order{p.waiting === 1 ? '' : 's'} waiting to go out
              {late && ` — ${p.overdue} already late`}
            </p>
            <p className={`mt-0.5 text-xs font-semibold ${late ? 'text-rose-800/80' : 'text-amber-800/80'}`}>
              {p.to_pack > 0 && `${p.to_pack} still to pack`}
              {p.to_pack > 0 && p.to_send > 0 && ' · '}
              {p.to_send > 0 && `${p.to_send} packed, not sent`}
            </p>
            {late && (
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-rose-800/80">
                The oldest is <b>{p.worst} day{p.worst === 1 ? '' : 's'}</b> past what you promised. A
                wedding has a date — an order that arrives after it can be refused outright, and the
                loss is yours. Repeated late dispatch can end your account on the portal.
                <span className="mt-1 block text-rose-800/70">
                  सबसे पुराना ऑर्डर आपके वादे से {p.worst} दिन आगे निकल चुका है। शादी की तारीख़ होती है —
                  देर से पहुँचा सामान पार्टी मना कर सकती है, और नुक़सान आपका होगा।
                </span>
              </p>
            )}
          </div>
        </div>

        <Link
          href="/supplier-portal?tab=orders"
          className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-xs font-bold uppercase tracking-widest ${
            late ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-amber-500 text-maroon-950 hover:bg-amber-600'
          }`}
        >
          <Truck size={14} /> Open orders
        </Link>
      </div>
    </div>
  );
}
