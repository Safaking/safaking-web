import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Gift } from 'lucide-react';
import { ReferBoard } from './ReferBoard';
import { JsonLd, breadcrumbJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Refer a friend',
  description:
    'Share your SafaKing code. Whoever joins with it gets credit off their first order, and you earn a share of everything they buy after that.',
  alternates: { canonical: '/refer' },
  openGraph: {
    title: 'Refer a friend · SafaKing',
    description: 'Share your code — they get credit, and so do you.',
    url: '/refer',
  },
};

export default function ReferPage() {
  return (
    <div className="min-h-screen bg-maroon-950 text-royal-100">
      <JsonLd data={breadcrumbJsonLd([{ name: 'Refer a friend', path: '/refer' }])} />

      <header className="sk-web-header sticky top-0 z-40 border-b border-royal-400/15 bg-maroon-950/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-2xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0">
              <Image src="/logo.png" alt="SafaKing" width={40} height={40} className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="font-display text-lg font-black uppercase tracking-widest leading-none text-royal-100">
                Refer
              </h1>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-royal-200/60">
                दोस्त को बताइए · both get credit
              </p>
            </div>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-royal-200/70 hover:text-royal-300">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 pb-32 sm:px-6 sm:pb-16">
        <div className="flex items-start gap-3 rounded-2xl border border-royal-400/20 bg-white/5 p-5">
          <Gift size={20} className="mt-0.5 shrink-0 text-royal-300" />
          <div className="text-sm leading-relaxed text-royal-100/80">
            <p className="font-bold text-royal-100">How it works</p>
            <p className="mt-1">
              Share your code. Whoever uses it gets credit off their first order straight away — and
              you earn 10% of every order they place, not just the first one.
            </p>
            <p className="mt-1 text-royal-200/60">
              कोड शेयर कीजिए। जो इस्तेमाल करेगा उसे पहले ऑर्डर पर छूट मिलेगी, और उसके हर ऑर्डर पर आपको 10% क्रेडिट।
            </p>
          </div>
        </div>

        <ReferBoard />
      </main>
    </div>
  );
}
