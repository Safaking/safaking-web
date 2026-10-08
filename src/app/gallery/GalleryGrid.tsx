'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { GALLERY, GALLERY_CATEGORIES, GalleryCategory } from '@/lib/gallery';
import { useTermsLanguage } from '@/lib/terms-language';

/**
 * The photographs, filtered by what the visitor came to look at, with a
 * full-screen viewer.
 *
 * Every photograph is in the page from the start — the filter hides rather
 * than fetches — so image search sees all of them, and the grid never jumps
 * while loading because each file's real size is known in advance.
 */
export function GalleryGrid() {
  const [category, setCategory] = useState<GalleryCategory | 'all'>('all');
  const [open, setOpen] = useState<number | null>(null);
  const [language] = useTermsLanguage();
  const hi = language === 'hi';

  const photos = GALLERY.filter((photo) => category === 'all' || photo.category === category);
  const viewing = open === null ? null : photos[open] ?? null;

  // Arrow keys and Escape, the way any photo viewer behaves.
  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
      if (event.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % photos.length));
      if (event.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, photos.length]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Chip active={category === 'all'} onClick={() => { setCategory('all'); setOpen(null); }}>
          {hi ? 'सब' : 'Everything'}
        </Chip>
        {GALLERY_CATEGORIES.map((item) => (
          <Chip
            key={item.id}
            active={category === item.id}
            onClick={() => { setCategory(item.id); setOpen(null); }}
          >
            {hi ? item.label.hi : item.label.en}
          </Chip>
        ))}
      </div>

      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
        {photos.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => setOpen(index)}
            className="group relative block w-full overflow-hidden rounded-2xl border border-amber-200/70 bg-white"
          >
            <Image
              src={photo.src}
              alt={hi ? photo.alt.hi : photo.alt.en}
              width={photo.width}
              height={photo.height}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="w-full transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-maroon-950/80 to-transparent p-3 pt-10 text-left text-[11px] font-medium leading-snug text-royal-100 opacity-0 transition-opacity group-hover:opacity-100">
              {hi ? photo.alt.hi : photo.alt.en}
            </span>
          </button>
        ))}
      </div>

      {viewing && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-maroon-950/95 backdrop-blur-sm"
          onClick={() => setOpen(null)}
        >
          <div className="flex justify-end p-4">
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label={hi ? 'बंद करें' : 'Close'}
              className="rounded-full border border-royal-400/30 p-2 text-royal-100"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center gap-2 px-2 pb-2" onClick={(e) => e.stopPropagation()}>
            <Arrow onClick={() => setOpen((i) => (i === null ? i : (i - 1 + photos.length) % photos.length))} side="left" />
            <Image
              src={viewing.src}
              alt={hi ? viewing.alt.hi : viewing.alt.en}
              width={viewing.width}
              height={viewing.height}
              sizes="100vw"
              priority
              className="max-h-[75vh] w-auto rounded-2xl object-contain"
            />
            <Arrow onClick={() => setOpen((i) => (i === null ? i : (i + 1) % photos.length))} side="right" />
          </div>
          <p className="px-6 pb-8 text-center text-xs leading-relaxed text-royal-200/80">
            {hi ? viewing.alt.hi : viewing.alt.en}
          </p>
        </div>
      )}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
        active
          ? 'bg-maroon-950 text-royal-100'
          : 'border border-amber-200/70 bg-white text-maroon-900 hover:border-royal-300'
      }`}
    >
      {children}
    </button>
  );
}

function Arrow({ onClick, side }: { onClick: () => void; side: 'left' | 'right' }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className="shrink-0 rounded-full border border-royal-400/30 p-2 text-royal-100 hover:bg-white/10"
    >
      <Icon size={20} />
    </button>
  );
}
