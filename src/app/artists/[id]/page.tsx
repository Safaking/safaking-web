'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Crown, ShieldCheck, MapPin, Loader2, AlertCircle, Video, Calendar, Users, ArrowLeft,
} from 'lucide-react';
import {
  getArtist, listPortfolio, listReviews, portfolioUrl,
  ArtistPublicProfile, PortfolioItem, Review,
} from '@/lib/reviews';
import { Stars, RatingSummary } from '@/components/reviews/Stars';

export default function ArtistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [artist, setArtist] = useState<ArtistPublicProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getArtist(id), listPortfolio(id), listReviews('artist', id)])
      .then(([a, p, r]) => {
        if (!active) return;
        setArtist(a);
        setPortfolio(p.filter((item) => item.visible));
        setReviews(r);
      })
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF6EC] flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Loader2 size={28} className="animate-spin mx-auto mb-3 text-amber-500" />
          <p className="text-sm font-bold">Loading artist…</p>
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen bg-[#FDF6EC] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-amber-200/60 p-10 max-w-md text-center">
          <AlertCircle size={34} className="text-rose-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-700">{error ?? 'Artist not found.'}</p>
          <Link
            href="/artists"
            className="inline-block mt-4 px-5 py-2.5 bg-maroon-950 text-royal-300 text-xs font-bold uppercase tracking-wider rounded-xl"
          >
            All artists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/artists" className="flex items-center gap-2 text-royal-200/70 hover:text-royal-300">
            <ArrowLeft size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">All artists</span>
          </Link>
          <Link href="/" className="w-10 h-10 rounded-full bg-royal-gradient flex items-center justify-center">
            <Crown size={20} className="text-maroon-950" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Identity */}
        <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="w-20 h-20 rounded-2xl bg-maroon-950 text-royal-300 flex items-center justify-center font-black text-3xl shrink-0">
              {artist.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-black text-2xl text-maroon-950 flex items-center gap-2">
                {artist.display_name}
                {artist.verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                    <ShieldCheck size={12} /> Verified
                  </span>
                )}
              </h1>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                <MapPin size={11} /> {artist.base_city ?? 'Travels nationwide'}
              </p>
              <div className="mt-2">
                <RatingSummary rating={artist.rating} count={artist.review_count} size={15} />
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {(artist.specialties ?? []).map((s) => (
                  <span key={s} className="px-2.5 py-1 rounded-full bg-royal-100 text-royal-800 text-[10px] font-bold">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-amber-100">
            {[
              { label: 'Events done', value: String(artist.total_events), icon: Calendar },
              { label: 'Safas per day', value: String(artist.safas_per_day), icon: Crown },
              { label: 'Team size', value: String(artist.team_size), icon: Users },
              { label: 'Rate', value: `₹${artist.per_safa_rate}/safa`, icon: Crown },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60">
                <stat.icon size={16} className="mx-auto text-amber-600 mb-1" />
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">{stat.label}</p>
                <p className="text-sm font-display font-black text-maroon-950 mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>

          <Link
            href="/plan"
            className="block w-full text-center mt-5 py-3.5 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest transition-colors"
          >
            Plan an event with our artists
          </Link>
        </section>

        {/* Portfolio */}
        <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
          <h2 className="font-display font-bold text-lg text-maroon-950 mb-4">Previous Work</h2>
          {portfolio.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              This artist has not added photos yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {portfolio.map((item) => {
                const url = portfolioUrl(item);
                return (
                  <figure key={item.id} className="rounded-2xl overflow-hidden border border-amber-200/70 bg-gray-50">
                    {item.media_kind === 'photo' && url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={item.caption ?? item.event_name ?? 'Safa tied by this artist'}
                        className="w-full h-40 object-cover"
                      />
                    ) : (
                      <a
                        href={url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center h-40 text-maroon-900 hover:bg-amber-50"
                      >
                        <Video size={26} />
                        <span className="text-[11px] font-bold mt-1">Watch video</span>
                      </a>
                    )}
                    {(item.event_name || item.caption) && (
                      <figcaption className="p-2.5">
                        <p className="text-[11px] font-bold text-maroon-950 truncate">
                          {item.event_name || item.caption}
                        </p>
                        {item.event_date && <p className="text-[10px] text-gray-400">{item.event_date}</p>}
                      </figcaption>
                    )}
                  </figure>
                );
              })}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
          <h2 className="font-display font-bold text-lg text-maroon-950 mb-1">
            Customer Reviews
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Only customers who completed a booking with this artist can leave one.
          </p>

          {reviews.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/70">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-sm text-maroon-950">
                      {review.reviewer_name || 'Verified customer'}
                    </p>
                    <Stars value={review.rating} size={13} />
                  </div>
                  {review.comment && (
                    <p className="text-xs text-gray-600 leading-relaxed mt-2">{review.comment}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-2">
                    {new Date(review.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
