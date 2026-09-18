'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { SafaFittingStage } from './SafaFittingStage';

interface IntroVideoProps {
  /** Carries the chosen safa's style across to the booking form. */
  onSelectStyle?: (styleName: string) => void;
}

/**
 * The home page's safa mirror. The fitting itself lives in SafaFittingStage,
 * shared with the full-screen version opened from the hero.
 *
 * The camera is never asked for on page load — a permission prompt nobody
 * requested is not a welcome — so the stage waits for a tap, and it lets go of
 * the camera again once the section scrolls out of view.
 */
export function IntroVideo({ onSelectStyle }: IntroVideoProps = {}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '200px' },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="virtual-tryon"
      className="py-20 px-4 sm:px-6 lg:px-8 bg-maroon-950 text-white relative overflow-hidden"
    >
      <div className="absolute inset-0 pattern-diamond opacity-15 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-royal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 space-y-3"
        >
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-royal-500/20 border border-royal-400/30 text-royal-300 text-xs font-bold uppercase tracking-widest">
            <Sparkles size={15} /> Virtual Safa Mirror
          </span>
          <h2 className="text-3xl sm:text-5xl font-display font-black text-royal-100 uppercase tracking-wider">
            Meet SafaKing — <span className="text-gradient-gold italic">Try On Your Crown</span>
          </h2>
          <p className="text-royal-200/70 text-sm max-w-xl mx-auto leading-relaxed">
            Turn on your camera, drag a royal safa onto your head, and snap the look. Or upload a photo
            instead — either way the picture is made on your own device and stays there.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/60 border border-royal-400/30 bg-maroon-900 flex flex-col"
        >
          <SafaFittingStage
            active={inView}
            onBookStyle={onSelectStyle}
            stageClassName="aspect-[3/4] w-full max-h-[70vh]"
            bookingNote="Found your look? Book our master artist to tie it on your wedding day."
          />
        </motion.div>
      </div>
    </section>
  );
}
