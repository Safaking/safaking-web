'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, ShieldCheck, MapPin, Loader2, AlertCircle, Images } from 'lucide-react';
import { listArtists, ArtistPublicProfile } from '@/lib/reviews';
import { RatingSummary } from '@/components/reviews/Stars';

export default function ArtistDirectoryPage() {
  const [artists, setArtists] = useState<ArtistPublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listArtists()
      .then((rows) => active && setArtists(rows))
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-royal-gradient flex items-center justify-center">
              <Crown size={20} className="text-maroon-950" />
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
                Master Safa Artists
              </h1>
              <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                See their work before you book
              </p>
            </div>
          </Link>
          <Link
            href="/plan"
            className="text-xs font-bold text-royal-200/70 hover:text-royal-300 uppercase tracking-wider"
          >
            Plan my event →
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {error && (
          <div className="flex items-start gap-2 p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-gray-500">
            <Loader2 size={28} className="animate-spin mx-auto mb-3 text-amber-500" />
            <p className="text-sm font-bold">Loading artists…</p>
          </div>
        ) : artists.length === 0 ? (
          <div className="py-20 text-center">
            <Crown size={34} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-600">No artists listed yet.</p>
            <p className="text-xs text-gray-500 mt-1">
              Artists appear here once they register and an admin approves them.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {artists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artists/${artist.id}`}
                className="bg-white rounded-3xl border border-amber-200/60 shadow-sm hover:shadow-lg transition-shadow p-6 block"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-maroon-950 text-royal-300 flex items-center justify-center font-black text-lg shrink-0">
                    {artist.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display font-bold text-base text-maroon-950 flex items-center gap-1.5">
                      <span className="truncate">{artist.display_name}</span>
                      {artist.verified && (
                        <ShieldCheck size={14} className="text-emerald-600 shrink-0" aria-label="Verified" />
                      )}
                    </h2>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {artist.base_city ?? 'Travels nationwide'}
                    </p>
                  </div>
                </div>

                <RatingSummary rating={artist.rating} count={artist.review_count} />

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(artist.specialties ?? []).slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-full bg-royal-100 text-royal-800 text-[10px] font-bold"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-amber-100 text-[11px]">
                  <span className="text-gray-500">
                    {artist.total_events} event{artist.total_events === 1 ? '' : 's'}
                  </span>
                  <span className="text-gray-500 flex items-center gap-1">
                    <Images size={11} /> {artist.portfolio_count}
                  </span>
                  <span className="font-black text-gradient-gold">₹{artist.per_safa_rate}/safa</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
