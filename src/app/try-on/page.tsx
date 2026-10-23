import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Camera, ShieldCheck } from 'lucide-react';
import { TryOnStage } from './TryOnStage';
import { notFound } from 'next/navigation';
import { JsonLd, breadcrumbJsonLd } from '@/lib/seo';
import { VIRTUAL_TRYON_ENABLED } from '@/lib/features';

const TRY_ON_METADATA: Metadata = {
  title: 'Try a safa on',
  description:
    'See a royal safa on your own head before you buy it. Open the camera, and the safa follows you — Jodhpuri, rounded and barati styles. Nothing leaves your phone.',
  alternates: { canonical: '/try-on' },
  openGraph: {
    title: 'Try a safa on · SafaKing',
    description: 'See a safa on your own head before you buy it. Nothing leaves your phone.',
    url: '/try-on',
  },
};

// A page that answers 404 should not still be describing itself to crawlers:
// a canonical address and an inviting title are how a dead URL stays in
// search results long after it stopped working.
export const metadata: Metadata = VIRTUAL_TRYON_ENABLED
  ? TRY_ON_METADATA
  : { title: 'Not found', robots: { index: false, follow: false } };

export default function TryOnPage() {
  // The flag hid everything that linked here, but the address still answered
  // — and a page nobody links to is exactly the one a crawler keeps.
  if (!VIRTUAL_TRYON_ENABLED) notFound();

  return (
    <div className="min-h-screen bg-maroon-950 text-royal-100">
      <JsonLd data={breadcrumbJsonLd([{ name: 'Try a safa on', path: '/try-on' }])} />

      <header className="sk-web-header sticky top-0 z-40 bg-maroon-950/95 backdrop-blur border-b border-royal-400/15">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0">
              <Image src="/logo.png" alt="SafaKing" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
                Try it on
              </h1>
              <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                साफा पहन कर देखिए
              </p>
            </div>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs font-bold text-royal-200/70 hover:text-royal-300 uppercase tracking-wider">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-32 sm:pb-16">
        <p className="mb-5 text-sm leading-relaxed text-royal-200/75">
          Open the camera and a safa sits on your head, turning as you turn. Or upload a photograph
          if you would rather not be filmed.
        </p>

        <TryOnStage />

        {/* The one question everybody asks before pressing the camera button. */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-royal-400/20 bg-white/5 p-4">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-royal-300" />
          <p className="text-xs leading-relaxed text-royal-200/75">
            <span className="font-bold text-royal-100">Nothing leaves your phone.</span> The camera
            picture is read on the device itself and never uploaded — there is no server involved in
            the try-on at all. Close the page and the camera stops.
          </p>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-royal-400/20 bg-white/5 p-4">
          <Camera size={18} className="mt-0.5 shrink-0 text-royal-300" />
          <p className="text-xs leading-relaxed text-royal-200/75">
            If the camera does not open, your browser is probably blocking it. On a phone, open this
            page in Chrome or Safari rather than inside another app&apos;s browser.
          </p>
        </div>
      </main>
    </div>
  );
}
