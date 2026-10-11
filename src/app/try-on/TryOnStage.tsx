'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SafaFittingStage } from '@/components/landing/SafaFittingStage';

/**
 * The mirror on a page of its own, so it can be linked to, shared and put on
 * a poster — safaking.in/try-on — rather than only existing behind a button
 * on the home page.
 */
export function TryOnStage() {
  const [style, setStyle] = useState<string | null>(null);

  return (
    <>
      <SafaFittingStage
        active
        onBookStyle={setStyle}
        stageClassName="w-full aspect-[3/4] sm:aspect-[4/5] rounded-3xl border border-royal-400/20"
        bookingNote="Artists are sent out for baraat safas; a groom's own safa is bought online."
      />
      {style && (
        <p className="mt-4 text-center text-xs text-royal-200/70">
          {style} chosen —{' '}
          <Link href="/#artist-booking-form" className="font-bold text-royal-300 underline">
            carry it into the booking form
          </Link>
        </p>
      )}
    </>
  );
}
