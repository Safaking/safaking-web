'use client';

import { Sparkles } from 'lucide-react';

export function TopBanner() {
  return (
    <div className="bg-maroon-800 text-royal-200 text-xs font-semibold tracking-widest text-center py-2.5 px-4 flex justify-center items-center gap-2 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-royal-500/10 to-transparent animate-shimmer bg-[length:200%_100%]" />
      <Sparkles size={14} className="animate-pulse text-royal-400 relative z-10" />
      <span className="relative z-10 uppercase">
        SafaKing · Luxury Royal Safas · Master Artists · Training Academy · Free All-India Shipping
      </span>
    </div>
  );
}
