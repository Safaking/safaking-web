'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Crown, Clock, CheckCircle2, XCircle, LogOut, Loader2 } from 'lucide-react';
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
      <div className="min-h-screen bg-maroon-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-royal-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-maroon-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 pattern-diamond opacity-10" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-14">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 text-royal-300 hover:text-royal-200">
          <Crown size={20} />
          <span className="font-display font-black tracking-widest uppercase text-sm">SafaKing</span>
        </Link>

        <div className="bg-maroon-900/60 border border-royal-400/20 rounded-3xl overflow-hidden shadow-2xl p-8 text-center">
          {!application ? (
            <>
              <Clock size={48} className="mx-auto text-royal-300/60 mb-4" />
              <h1 className="font-display font-black text-xl text-royal-100 uppercase tracking-wide mb-2">
                No Application Yet
              </h1>
              <p className="text-xs text-royal-200/60 leading-relaxed mb-6">
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
                className="w-14 h-14 rounded-full border-2 border-dashed border-royal-400/40 mx-auto mb-4 flex items-center justify-center"
              >
                <Clock size={22} className="text-royal-300" />
              </motion.div>
              <h1 className="font-display font-black text-xl text-royal-100 uppercase tracking-wide mb-2">
                Your Profile Is Pending
              </h1>
              <p className="text-xs text-royal-200/60 leading-relaxed mb-6">
                Thanks, {application.full_name.split(' ')[0]} — our team is reviewing your application.
                You&apos;ll get an email the moment you&apos;re approved, and can then sign back in here
                to access the Artist Portal.
              </p>
              <button
                onClick={recheckApproval}
                className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-royal-400/20 text-royal-200 font-bold text-[11px] uppercase tracking-widest transition-colors"
              >
                Check Again
              </button>
            </>
          ) : application.status === 'rejected' ? (
            <>
              <XCircle size={48} className="mx-auto text-rose-400/70 mb-4" />
              <h1 className="font-display font-black text-xl text-royal-100 uppercase tracking-wide mb-2">
                Application Not Approved
              </h1>
              <p className="text-xs text-royal-200/60 leading-relaxed mb-6">
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
              <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
              <h1 className="font-display font-black text-xl text-royal-100 uppercase tracking-wide mb-2">
                Approved!
              </h1>
              <p className="text-xs text-royal-200/60 leading-relaxed mb-6">
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
            className="flex items-center gap-1.5 mx-auto mt-8 text-[11px] text-royal-200/40 hover:text-royal-200 transition-colors"
          >
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
