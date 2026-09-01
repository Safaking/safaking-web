'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, DBArtistApplication } from '@/lib/supabase';

export default function ArtistStatusPage() {
  const { user, role, loading: authLoading, logout, refreshProfile } = useAuth();
  const router = useRouter();
  const [application, setApplication] = useState<DBArtistApplication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/artist-portal/login');
      return;
    }
    if (role === 'artist' || role === 'admin') {
      router.replace('/artist-portal');
      return;
    }

    supabase
      .from('artist_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setApplication((data as DBArtistApplication) ?? null);
        setLoading(false);
      });
  }, [user, role, authLoading, router]);

  // If the admin approved us while this tab was open, role updates on the
  // next auth refresh — recheck once so we don't strand an approved artist here.
  const recheckApproval = async () => {
    await refreshProfile();
    router.refresh();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-royal-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-maroon-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-royal-50 text-maroon-950 flex flex-col lg:flex-row">
      {/* Left — branding panel, full height on desktop */}
      <div className="relative lg:w-[42%] shrink-0 overflow-hidden flex flex-col items-center justify-center py-12 lg:py-0 px-8 bg-white border-b lg:border-b-0 lg:border-r border-royal-200/60">
        <div className="absolute inset-0 pattern-diamond opacity-[0.04]" />
        <div className="relative z-10 text-center max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2 mb-10 text-maroon-700 hover:text-maroon-900">
            <div className="w-6 h-6 shrink-0">
              <Image src="/logo.png" alt="SafaKing" width={24} height={24} className="w-full h-full object-contain" />
            </div>
            <span className="font-display font-black tracking-widest uppercase text-sm">SafaKing</span>
          </Link>
          <div className="w-20 h-20 mx-auto mb-5">
            <Image src="/logo.png" alt="SafaKing" width={80} height={80} className="w-full h-full object-contain drop-shadow-lg" priority />
          </div>
          <h1 className="font-display font-black text-3xl text-maroon-900 tracking-wider uppercase">
            Artist Portal
          </h1>
          <p className="text-sm text-maroon-800/60 mt-3 leading-relaxed">
            Separate from your customer account — bookings, earnings &amp; check-ins live here.
          </p>
        </div>
      </div>

      {/* Right — status panel, fills the rest of the screen */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-10 bg-royal-50">
        <div className="max-w-md w-full text-center">
          {!application ? (
            <>
              <Clock size={48} className="mx-auto text-maroon-800/40 mb-4" />
              <h1 className="font-display font-black text-xl text-maroon-900 uppercase tracking-wide mb-2">
                No Application Yet
              </h1>
              <p className="text-xs text-maroon-800/60 leading-relaxed mb-6">
                You&apos;re signed in, but haven&apos;t submitted a Safa Artist application.
              </p>
              <Link
                href="/artist-portal/login?tab=join"
                className="inline-block px-6 py-3 rounded-xl bg-royal-500 hover:bg-royal-400 text-maroon-950 font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Apply Now
              </Link>
            </>
          ) : application.status === 'pending' ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="w-14 h-14 rounded-full border-2 border-dashed border-royal-400 mx-auto mb-4 flex items-center justify-center"
              >
                <Clock size={22} className="text-maroon-700" />
              </motion.div>
              <h1 className="font-display font-black text-xl text-maroon-900 uppercase tracking-wide mb-2">
                Your Profile Is Pending
              </h1>
              <p className="text-xs text-maroon-800/60 leading-relaxed mb-6">
                Thanks, {application.full_name.split(' ')[0]} — our team is reviewing your application.
                You&apos;ll get an email the moment you&apos;re approved, and can then sign back in here
                to access the Artist Portal.
              </p>
              <button
                onClick={recheckApproval}
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-royal-50 border border-royal-200 text-maroon-800 font-bold text-[11px] uppercase tracking-widest transition-colors shadow-sm"
              >
                Check Again
              </button>
            </>
          ) : application.status === 'rejected' ? (
            <>
              <XCircle size={48} className="mx-auto text-rose-500/70 mb-4" />
              <h1 className="font-display font-black text-xl text-maroon-900 uppercase tracking-wide mb-2">
                Application Not Approved
              </h1>
              <p className="text-xs text-maroon-800/60 leading-relaxed mb-6">
                Your application wasn&apos;t approved this time. You&apos;re welcome to update your
                details and re-apply.
              </p>
              <Link
                href="/artist-portal/login?tab=join"
                className="inline-block px-6 py-3 rounded-xl bg-royal-500 hover:bg-royal-400 text-maroon-950 font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Re-Apply
              </Link>
            </>
          ) : (
            <>
              <CheckCircle2 size={48} className="mx-auto text-emerald-600 mb-4" />
              <h1 className="font-display font-black text-xl text-maroon-900 uppercase tracking-wide mb-2">
                Approved!
              </h1>
              <p className="text-xs text-maroon-800/60 leading-relaxed mb-6">
                Your account is being upgraded to artist access — this can take a moment to sync.
              </p>
              <button
                onClick={recheckApproval}
                className="px-6 py-3 rounded-xl bg-royal-500 hover:bg-royal-400 text-maroon-950 font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Enter Artist Portal
              </button>
            </>
          )}

          <button
            onClick={() => logout().then(() => router.replace('/'))}
            className="flex items-center gap-1.5 mx-auto mt-8 text-[11px] text-maroon-800/40 hover:text-maroon-800 transition-colors"
          >
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

