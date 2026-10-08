import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { FaqBoard } from './FaqBoard';
import { JsonLd, faqJsonLd, breadcrumbJsonLd } from '@/lib/seo';

/**
 * The questions people ring up to ask, answered in Hindi and English.
 *
 * A server page on purpose: the answers are in the HTML before any
 * JavaScript runs, and the FAQ structured data below is what lets Google
 * show one of these answers directly under a search result.
 */
export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'Booking a safa artist, buying a groom safa, rentals, advance and refunds, delivery, and training — answered in Hindi and English.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'SafaKing — frequently asked questions',
    description: 'Bookings, groom safas, rentals, refunds and training, answered in Hindi and English.',
    url: '/faq',
  },
};

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <JsonLd data={[faqJsonLd(), breadcrumbJsonLd([{ name: 'FAQ', path: '/faq' }])]} />

      <header className="sk-web-header sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0">
              <Image src="/logo.png" alt="SafaKing" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
                Questions
              </h1>
              <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                सवाल और जवाब · Asked and answered
              </p>
            </div>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs font-bold text-royal-200/70 hover:text-royal-300 uppercase tracking-wider">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 sm:pb-16 space-y-8">
        <p className="max-w-2xl text-sm leading-relaxed text-gray-700">
          Everything customers ring up to ask — bookings, the groom&apos;s safa, rentals, money and
          training. Read it in English or हिंदी; the switch changes every answer on the page.
        </p>
        <FaqBoard />
      </main>
    </div>
  );
}
