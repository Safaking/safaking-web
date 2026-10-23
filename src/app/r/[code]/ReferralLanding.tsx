'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Gift, Smartphone, Globe } from 'lucide-react';

const PENDING_CODE = 'sk-referral-code';
const PLAY_ID = 'in.safaking.app';

/**
 * A scanned code, before there is any account to put it on.
 *
 * The code is written down here and claimed later, by the refer board, as
 * soon as somebody signs in. That gap is the normal case, not the edge one:
 * a person scans this at a wedding, installs the app on the way home and
 * signs up the next morning.
 */
export function ReferralLanding({ code }: { code: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PENDING_CODE, code);
      setSaved(true);
    } catch {
      // Private browsing. The code is on screen and can be typed in by hand,
      // which is why it is printed large below rather than hidden in a link.
    }
  }, [code]);

  // The Play listing carries the code too. Android hands `referrer` to the
  // app after it installs, which is the only path that survives the jump from
  // this browser into the app's own storage.
  const playUrl =
    `https://play.google.com/store/apps/details?id=${PLAY_ID}` +
    `&referrer=${encodeURIComponent(`utm_source=refer&utm_content=${code}`)}`;

  return (
    <div className="min-h-screen bg-maroon-950 px-5 py-10 text-royal-100">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <Image src="/logo.png" alt="" width={72} height={72} className="h-16 w-auto" priority />
          <h1 className="mt-4 text-2xl font-black tracking-tight text-royal-200">
            You have been invited
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-royal-100/75">
            This code gives you credit off your first order — and the person who sent it gets
            some too.
          </p>
        </div>

        <div className="rounded-2xl border border-royal-400/25 bg-white/5 p-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-royal-200/60">
            The code
          </p>
          <p className="mt-2 font-mono text-4xl font-black tracking-[0.2em] text-royal-300">{code}</p>
          {saved && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-royal-200/60">
              <Gift size={12} />
              Saved — it applies as soon as you sign in
            </p>
          )}
        </div>

        <a
          href={playUrl}
          className="flex items-center justify-center gap-2 rounded-full bg-royal-400 px-6 py-4 text-xs font-bold uppercase tracking-widest text-maroon-950"
        >
          <Smartphone size={15} /> Install the app
        </a>

        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-full border border-royal-400/40 px-6 py-4 text-xs font-bold uppercase tracking-widest text-royal-200"
        >
          <Globe size={15} /> Carry on to the website
        </Link>

        <p className="text-center text-[11px] leading-relaxed text-royal-200/50">
          After installing, type this code at sign-up if it has not applied itself.
        </p>
      </div>
    </div>
  );
}
