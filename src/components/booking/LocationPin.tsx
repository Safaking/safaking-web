'use client';

import { useState } from 'react';
import { MapPin, Loader2, CheckCircle2 } from 'lucide-react';

export interface PinnedLocation {
  lat: number | null;
  lng: number | null;
  note: string;
}

/**
 * Lets the customer drop an exact pin on their venue.
 *
 * A pincode gets an artist to the right town; a wedding is at a specific
 * farmhouse down an unmarked lane. One tap here is the difference between
 * arriving on time and phoning for directions.
 */
export function LocationPin({
  value, onChange, theme = 'light',
}: {
  value: PinnedLocation;
  onChange: (next: PinnedLocation) => void;
  theme?: 'light' | 'dark';
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dark = theme === 'dark';
  const shell = dark
    ? 'bg-white/5 border-royal-400/25 text-royal-100'
    : 'bg-white border-gray-200 text-maroon-950';

  const capture = () => {
    if (!navigator.geolocation) {
      setError('Your browser cannot share location. Type the landmark instead.');
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          ...value,
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setBusy(false);
      },
      () => {
        setBusy(false);
        setError('Could not read your location. Allow location access, or type a landmark below.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pinned = value.lat != null && value.lng != null;

  return (
    <div className={`rounded-xl border p-3.5 space-y-2.5 ${shell}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[11px] font-black uppercase tracking-wider ${dark ? 'text-royal-300' : 'text-maroon-900'}`}>
            Exact location (optional)
          </p>
          <p className={`text-[10px] leading-relaxed mt-0.5 ${dark ? 'text-royal-200/60' : 'text-gray-500'}`}>
            Helps your artist reach the right gate, on time.
          </p>
        </div>
        <button
          type="button"
          onClick={capture}
          disabled={busy}
          className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
            pinned
              ? 'bg-emerald-100 text-emerald-800'
              : dark ? 'bg-royal-500 text-maroon-950' : 'bg-maroon-950 text-royal-300'
          }`}
        >
          {busy ? <Loader2 size={12} className="animate-spin" />
            : pinned ? <CheckCircle2 size={12} />
            : <MapPin size={12} />}
          {pinned ? 'Location pinned' : 'Share my location'}
        </button>
      </div>

      {pinned && (
        <a
          href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`block text-[10px] font-bold underline ${dark ? 'text-royal-300' : 'text-royal-700'}`}
        >
          {value.lat}, {value.lng} — check on the map ↗
        </a>
      )}

      <input
        value={value.note}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
        placeholder="Landmark / gate no. (e.g. behind Ganesh temple, gate 2)"
        className={`w-full px-3 py-2 rounded-lg text-xs outline-none ${
          dark
            ? 'bg-white/5 border border-royal-400/25 text-royal-100 placeholder:text-royal-200/40'
            : 'bg-white border border-gray-200 text-maroon-950'
        }`}
      />

      {error && <p className="text-[10px] text-rose-500 leading-relaxed">{error}</p>}
    </div>
  );
}
