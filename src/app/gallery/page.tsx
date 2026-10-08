import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { GalleryGrid } from './GalleryGrid';
import { GALLERY } from '@/lib/gallery';
import { JsonLd, imageGalleryJsonLd, breadcrumbJsonLd } from '@/lib/seo';

/**
 * SafaKing's own photographs — grooms, safas, artists at work and the
 * academy. The one page a wedding family looks at before anything else.
 */
export const metadata: Metadata = {
  title: 'Photo gallery',
  description:
    'Photographs of SafaKing grooms, wedding safas, our artists tying at events and the training academy — Jodhpuri, rounded and barati styles.',
  alternates: { canonical: '/gallery' },
  openGraph: {
    title: 'SafaKing photo gallery',
    description: 'Grooms, safas, artists at work and the academy — in our own photographs.',
    url: '/gallery',
    images: [{ url: GALLERY[0].src, alt: GALLERY[0].alt.en }],
  },
};

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <JsonLd
        data={[
          imageGalleryJsonLd(GALLERY.map((photo) => ({ src: photo.src, alt: photo.alt.en }))),
          breadcrumbJsonLd([{ name: 'Gallery', path: '/gallery' }]),
        ]}
      />

      <header className="sk-web-header sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0">
              <Image src="/logo.png" alt="SafaKing" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
                Gallery
              </h1>
              <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                फोटो गैलरी · Our own photographs
              </p>
            </div>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs font-bold text-royal-200/70 hover:text-royal-300 uppercase tracking-wider">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 sm:pb-16 space-y-6">
        <p className="max-w-2xl text-sm leading-relaxed text-gray-700">
          Grooms we have crowned, safas from the collection, our artists at work, and a batch
          learning to tie. Tap any photograph to see it full size.
        </p>
        <GalleryGrid />

        <div className="rounded-2xl border border-amber-200/70 bg-white p-6">
          <h2 className="font-display font-black text-lg text-maroon-950">Want this look?</h2>
          <p className="mt-1 text-sm text-gray-600">
            Buy the groom&apos;s safa online, or book artists to tie safas for the baraat.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/shop" className="rounded-full bg-maroon-950 px-5 py-3 text-xs font-bold uppercase tracking-widest text-royal-100">
              Shop safas
            </Link>
            <Link href="/#artist-booking-form" className="rounded-full border-2 border-maroon-950/70 px-5 py-3 text-xs font-bold uppercase tracking-widest text-maroon-950">
              Book an artist
            </Link>
            <Link href="/faq" className="rounded-full border border-amber-200 px-5 py-3 text-xs font-bold uppercase tracking-widest text-maroon-900">
              Questions
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
