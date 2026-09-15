'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, LogOut, Loader2, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, DBSupplierApplication } from '@/lib/supabase';

export default function SupplierStatusPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [application, setApplication] = useState<DBSupplierApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: supplier } = await supabase
      .from('supplier_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (supplier) {
      router.replace('/supplier-portal');
      return;
    }
    const { data } = await supabase
      .from('supplier_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setApplication((data as DBSupplierApplication) ?? null);
    setLoading(false);
  }, [user, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/supplier-portal/login');
      return;
    }
    load();
  }, [authLoading, user, router, load]);

  const checkAgain = async () => {
    setChecking(true);
    await load();
    setChecking(false);
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
      <div className="relative lg:w-[42%] shrink-0 overflow-hidden flex flex-col items-center justify-center py-12 lg:py-0 px-8 bg-white border-b lg:border-b-0 lg:border-r border-royal-200/60">
        <div className="absolute inset-0 pattern-diamond opacity-[0.04]" />
        <div className="relative z-10 text-center max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2 mb-10 text-maroon-700 hover:text-maroon-900">
            <div className="w-6 h-6 shrink-0">
              <Image src="/logo.png" alt="SafaKing" width={24} height={24} className="w-full h-full object-contain" />
            </div>
            <span className="font-display font-black tracking-widest uppercase text-sm">SafaKing</span>
          </Link>
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-maroon-950 text-royal-300 flex items-center justify-center shadow-lg">
            <Store size={38} />
          </div>
          <h1 className="font-display font-black text-3xl text-maroon-900 tracking-wider uppercase">Supplier Portal</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-10 bg-royal-50">
        <div className="max-w-md w-full text-center">
          {!application ? (
            <>
              <Clock size={48} className="mx-auto text-maroon-800/40 mb-4" />
              <h1 className="font-display font-black text-xl text-maroon-900 uppercase tracking-wide mb-2">
                No Application Yet
              </h1>
              <p className="text-xs text-maroon-800/60 leading-relaxed mb-6">
                You&apos;re signed in, but this account has not applied to sell on SafaKing.
              </p>
              <Link
                href="/supplier-portal/login?tab=join"
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
                Your Application Is With Us
              </h1>
              <p className="text-xs text-maroon-800/60 leading-relaxed mb-6">
                Thanks, {application.contact_name.split(' ')[0]}. Our team is reviewing{' '}
                <span className="font-bold">{application.business_name}</span> and will call you on{' '}
                {application.phone}. Once you are approved, sign in here to list your products.
              </p>
              <button
                onClick={checkAgain}
                disabled={checking}
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-royal-50 border border-royal-200 text-maroon-800 font-bold text-[11px] uppercase tracking-widest transition-colors shadow-sm inline-flex items-center gap-2"
              >
                {checking && <Loader2 size={12} className="animate-spin" />}
                Check Again
              </button>
            </>
          ) : application.status === 'rejected' ? (
            <>
              <XCircle size={48} className="mx-auto text-rose-500/70 mb-4" />
              <h1 className="font-display font-black text-xl text-maroon-900 uppercase tracking-wide mb-2">
                Application Not Approved
              </h1>
              <p className="text-xs text-maroon-800/60 leading-relaxed mb-3">
                Your application wasn&apos;t approved this time.
              </p>
              {application.review_note && (
                <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 mb-6">
                  <span className="font-bold">What to fix:</span> {application.review_note}
                </p>
              )}
              <Link
                href="/supplier-portal/login?tab=join"
                className="inline-block px-6 py-3 rounded-xl bg-royal-500 hover:bg-royal-400 text-maroon-950 font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Apply Again
              </Link>
            </>
          ) : (
            <>
              <CheckCircle2 size={48} className="mx-auto text-emerald-600 mb-4" />
              <h1 className="font-display font-black text-xl text-maroon-900 uppercase tracking-wide mb-2">
                Approved
              </h1>
              <p className="text-xs text-maroon-800/60 leading-relaxed mb-6">
                Your supplier account is being opened. This can take a moment.
              </p>
              <button
                onClick={checkAgain}
                disabled={checking}
                className="px-6 py-3 rounded-xl bg-royal-500 hover:bg-royal-400 text-maroon-950 font-bold text-xs uppercase tracking-widest transition-colors inline-flex items-center gap-2"
              >
                {checking && <Loader2 size={12} className="animate-spin" />}
                Enter Supplier Portal
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
