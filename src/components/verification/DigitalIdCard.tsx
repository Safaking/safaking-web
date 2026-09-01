'use client';

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, Loader2, AlertCircle, Crown } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';

interface DigitalIdCardProps {
  artistId: string;
}

interface ArtistIdData {
  display_name: string;
  base_city: string | null;
  verified: boolean;
  digital_id_code: string | null;
}

/**
 * A verified artist's shareable ID card — unique code + a QR linking to their
 * public /artists/[id] profile (App module.docx items 21 "Digital ID Card"
 * and 24 "QR Profile System"). Nothing here is editable by the artist; the
 * code itself is assigned server-side the moment an admin verifies them
 * (see supabase/023_digital_id_card.sql).
 */
export function DigitalIdCard({ artistId }: DigitalIdCardProps) {
  const [data, setData] = useState<ArtistIdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: row, error: fetchErr } = await supabase
      .from('artist_profiles')
      .select('display_name, base_city, verified, digital_id_code')
      .eq('id', artistId)
      .maybeSingle();

    if (fetchErr) {
      setError(friendlyError(fetchErr));
    } else {
      setError(null);
      setData(row as ArtistIdData | null);
    }
    setLoading(false);
  }, [artistId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex justify-center">
        <Loader2 size={20} className="animate-spin text-maroon-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed">{error}</p>
      </div>
    );
  }

  if (!data?.verified || !data.digital_id_code) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center space-y-2">
        <ShieldCheck size={28} className="text-gray-300 mx-auto" />
        <p className="text-sm font-bold text-gray-700">Digital ID Card</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Get verified above to unlock your Digital ID Card and QR profile — shown to customers
          at every booking.
        </p>
      </div>
    );
  }

  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/artists/${artistId}`
    : `/artists/${artistId}`;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-maroon-950 text-white shadow-xl border border-royal-400/20">
      <div className="absolute inset-0 pattern-diamond opacity-10" />
      <div className="relative p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-royal-400" />
            <span className="text-xs font-black uppercase tracking-widest text-royal-200/80">
              SafaKing Digital ID
            </span>
          </div>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
            <ShieldCheck size={11} /> Verified
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white p-2.5 rounded-xl shrink-0">
            <QRCodeSVG value={profileUrl} size={96} level="M" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-black text-xl text-royal-100 leading-tight truncate">
              {data.display_name}
            </p>
            {data.base_city && (
              <p className="text-xs text-royal-200/60 mt-0.5">{data.base_city}</p>
            )}
            <p className="text-sm font-bold text-royal-300 tracking-wider mt-2">
              {data.digital_id_code}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-royal-200/50 leading-relaxed border-t border-royal-400/20 pt-3">
          Scan the QR to view this artist&apos;s profile, rating, photos and videos — and to leave
          a rating after a booking.
        </p>
      </div>
    </div>
  );
}
