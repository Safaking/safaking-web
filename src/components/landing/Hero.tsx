'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  motion,
  MotionValue,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ArrowDown, ArrowUpRight, Crown, Sparkles, ShoppingBag } from 'lucide-react';
import { SafaRaja } from './SafaRaja';
import { VirtualSafaTryOn } from './VirtualSafaTryOn';

/**
 * The homepage opening: a saffron stage with a groom lifted out of his
 * photo, layers that lean toward the cursor, then the collection sliding
 * sideways as the page scrolls.
 *
 * Every image is one of SafaKing's own photos with its background removed
 * (public/hero). Motion is off for anyone who asks their device for less of
 * it, and phones get a swipeable row instead of a pinned one.
 */

interface CollectionItem {
  step: number;
  name: string;
  kind: string;
  badge: string;
  addedAccessory: string;
  icon: string;
  note: string;
  alt: string;
  src: string;
  href: string;
  cta: string;
  tint: string;
}

const COLLECTION: CollectionItem[] = [
  {
    step: 1,
    name: '1. Royal Sherwani',
    kind: 'Base Canvas',
    badge: 'STEP 1 · BASE LOOK',
    addedAccessory: 'Grand Zardozi Sherwani',
    icon: '👔',
    note: 'The foundation of royal attire — hand-embroidered Zardozi sherwani',
    alt: 'Groom in maroon sherwani base look without safa or accessories',
    src: '/hero/step1-sherwani.jpg',
    href: '/shop',
    cta: 'Explore Sherwanis',
    tint: '#3A0A13',
  },
  {
    step: 2,
    name: '2. Pearl Mala',
    kind: '+ Pearl Necklace',
    badge: 'STEP 2 · WEARING PEARLS',
    addedAccessory: 'Multi-strand Royal Pearl Mala',
    icon: '📿',
    note: 'Adorned with layered royal pearl necklace worn by Marwar royalty',
    alt: 'Groom wearing maroon sherwani and royal pearl necklace mala',
    src: '/hero/step2-pearls.jpg',
    href: '/shop',
    cta: 'View Pearl Malas',
    tint: '#5A0E18',
  },
  {
    step: 3,
    name: '3. Royal Sword',
    kind: '+ Wedding Talwar',
    badge: 'STEP 3 · HOLDING TALWAR',
    addedAccessory: 'Golden Wedding Sword (Talwar)',
    icon: '⚔️',
    note: 'Equipping the golden ceremonial sword representing valour & heritage',
    alt: 'Groom holding golden wedding sword talwar in hand',
    src: '/hero/step3-sword.jpg',
    href: '/shop',
    cta: 'Explore Swords',
    tint: '#6E1322',
  },
  {
    step: 4,
    name: '4. Forehead Bindi',
    kind: '+ Royal Tilak',
    badge: 'STEP 4 · APPLYING TILAK',
    addedAccessory: 'Sacred Red Bindi Tilak',
    icon: '🔴',
    note: 'Placing the auspicious red bindi tilak on forehead for wedding blessings',
    alt: 'Groom with sacred red bindi tilak on forehead',
    src: '/hero/step4-bindi.jpg',
    href: '/shop',
    cta: 'Bindi & Accessories',
    tint: '#8A1F30',
  },
  {
    step: 5,
    name: '5. Royal Safa',
    kind: '+ Safa Turban',
    badge: 'STEP 5 · TYING SAFA',
    addedAccessory: 'Crown Safa Turban',
    icon: '👑',
    note: 'Master artist ties the royal safa with precision pleats & structure',
    alt: 'Groom wearing majestic royal safa turban',
    src: '/hero/step5-safa.jpg',
    href: '/#artist-booking-form',
    cta: 'Book Tying Artist',
    tint: '#8A6614',
  },
  {
    step: 6,
    name: '6. Complete Maharaja',
    kind: 'Complete Royal Look',
    badge: 'STEP 6 · CROWN COMPLETE',
    addedAccessory: 'Peacock Feather & Kundan Kalgi',
    icon: '🦚',
    note: 'Safa + Kalgi Brooch + Pearl Mala + Sword + Bindi — The Ultimate Crown!',
    alt: 'Groom in complete royal ensemble with safa, bindi tilak and sword',
    src: '/hero/step6-complete.jpg',
    href: '/#artist-booking-form',
    cta: 'Book Complete Look',
    tint: '#1F3478',
  },
];

/** True only on a device with a real pointer that has not asked for less motion. */
function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(pointer: fine)');
    const update = () => setFine(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return fine;
}

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return desktop;
}

/** Cursor position across the window, -1 to 1 on each axis, eased. */
function useCursor(enabled: boolean) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  useEffect(() => {
    if (!enabled) {
      x.set(0);
      y.set(0);
      return;
    }
    const onMove = (e: PointerEvent) => {
      x.set((e.clientX / window.innerWidth) * 2 - 1);
      y.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [enabled, x, y]);
  const spring = { stiffness: 70, damping: 20, mass: 0.6 };
  return { x: useSpring(x, spring), y: useSpring(y, spring) };
}

/** A layer that drifts with the cursor; nearer layers move further. */
function useDepth(value: MotionValue<number>, pixels: number) {
  return useTransform(value, [-1, 1], [-pixels, pixels]);
}

function Stage({ onOpenTryOn }: { onOpenTryOn?: () => void }) {
  const reduce = useReducedMotion();
  const fine = useFinePointer();
  const cursor = useCursor(fine && !reduce);

  const wordX = useDepth(cursor.x, -18);
  const wordY = useDepth(cursor.y, -10);
  const glowX = useDepth(cursor.x, 120);
  const glowY = useDepth(cursor.y, 80);
  const textX = useDepth(cursor.x, -8);

  return (
    <section
      id="home"
      // The butterfly is the pointer here; links keep their hand cursor.
      className="relative overflow-hidden text-maroon-950 [@media(pointer:fine)]:cursor-none [&_a]:cursor-pointer"
      style={{ background: 'radial-gradient(120% 90% at 50% 0%, #F7B42C 0%, #EE9A12 45%, #D9790B 100%)' }}
    >
      {/* Light that follows the cursor */}
      <motion.div
        aria-hidden
        style={{ x: glowX, y: glowY }}
        className="pointer-events-none absolute left-1/2 top-1/3 h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,240,190,0.55)_0%,rgba(255,240,190,0)_62%)]"
      />
      {/* Bandhani dots */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:radial-gradient(circle,#6B0F1A_1.3px,transparent_1.8px)] [background-size:24px_24px]"
      />
      {/* The word behind the groom */}
      <motion.p
        aria-hidden
        style={{ x: wordX, y: wordY }}
        className="pointer-events-none absolute inset-x-0 top-[6%] select-none text-center font-display font-black leading-none tracking-tighter text-maroon-900/[0.09] text-[34vw] lg:text-[26vw]"
      >
        SAFA
      </motion.p>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-end gap-8 px-4 pt-10 sm:px-6 lg:min-h-[calc(100svh-7.25rem)] lg:grid-cols-[1fr_minmax(0,500px)_1fr] lg:gap-6 lg:px-8 lg:pt-0">
        {/* Words */}
        <motion.div
          style={{ x: textX }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-20 text-center lg:self-center lg:pb-16 lg:text-left"
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-maroon-950/90 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-royal-200">
            <Crown size={12} className="text-royal-400" /> SafaKing · Royal Turban House
          </p>
          <h1 className="mt-5 font-display text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl xl:text-7xl">
            Every groom
            <br />
            deserves a <span className="italic text-maroon-800">royal crown.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-maroon-950/75 lg:mx-0">
            Order your safa online, tied by our masters and delivered anywhere in India — and a
            master artist to tie the baraat&apos;s on the day.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row lg:items-start flex-wrap">
            <Link
              href="/shop"
              className="group inline-flex items-center gap-2 rounded-full bg-royal-500 px-7 py-4 text-xs font-black uppercase tracking-widest text-maroon-950 shadow-xl shadow-royal-500/30 transition-all hover:bg-royal-400"
            >
              <ShoppingBag size={15} /> Shop safas online
              <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button
              onClick={() => onOpenTryOn?.()}
              className="group inline-flex items-center gap-2 rounded-full bg-maroon-950 px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-royal-200 shadow-xl shadow-maroon-950/25 transition-all hover:bg-maroon-900 border border-royal-400/30"
            >
              <Sparkles size={15} className="text-royal-400" /> Virtual AR Safa Camera Mirror
            </button>
            <Link
              href="#artist-booking-form"
              className="inline-flex items-center gap-2 rounded-full border-2 border-maroon-950/70 px-6 py-3 text-xs font-bold uppercase tracking-widest text-maroon-950 transition-colors hover:bg-maroon-950 hover:text-royal-100"
            >
              Book a safa artist <ArrowUpRight size={14} />
            </Link>
          </div>
        </motion.div>

        {/* Safa Raja, watching the butterfly */}
        <div className="relative z-10 mx-auto aspect-[252/714] h-[min(56svh,480px)] lg:h-[min(72svh,620px)] lg:self-end">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <SafaRaja className="h-full w-full" />
          </motion.div>
        </div>

        {/* What's below */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="relative z-20 hidden flex-col items-end gap-4 self-center pb-16 lg:flex"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-maroon-950/60">Step By Step Crown Wear</p>
          <ol className="space-y-1.5 text-right">
            {COLLECTION.map((item, i) => (
              <li key={item.name} className="font-display text-lg font-bold text-maroon-950/80">
                <span className="mr-2 font-sans text-[10px] font-bold text-maroon-950/40">{String(i + 1).padStart(2, '0')}</span>
                {item.name}
              </li>
            ))}
          </ol>
          <a href="#collection" className="mt-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-maroon-950">
            Scroll <ArrowDown size={12} className="animate-bounce" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function RailItem({ item, index, count, progress, animate }: {
  item: CollectionItem;
  index: number;
  count: number;
  progress: MotionValue<number>;
  animate: boolean;
}) {
  const at = count > 1 ? index / (count - 1) : 0;
  const lift = useTransform(progress, [at - 0.4, at, at + 0.4], [60, 0, -60]);
  const tilt = useTransform(progress, [at - 0.4, at + 0.4], [5, -5]);
  const numberX = useTransform(progress, [at - 0.4, at + 0.4], [80, -80]);

  return (
    <article className="group flex w-[82vw] shrink-0 snap-center flex-col sm:w-[56vw] md:w-[36vw] lg:w-[28vw]">
      <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-royal-400/20 shadow-2xl">
        <motion.span
          aria-hidden
          style={animate ? { x: numberX } : undefined}
          className="absolute -left-2 top-0 font-display text-8xl font-black leading-none text-white/[0.15] lg:text-9xl z-10 pointer-events-none select-none"
        >
          {String(index + 1).padStart(2, '0')}
        </motion.span>

        {/* Step Badge */}
        <div className="absolute top-4 left-4 z-20">
          <motion.span
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-royal-500 text-maroon-950 font-black text-[10px] uppercase tracking-wider shadow-lg"
          >
            <span>{item.icon}</span> {item.badge}
          </motion.span>
        </div>

        <motion.div
          style={animate ? { y: lift, rotate: tilt } : undefined}
          whileHover={{ scale: 1.04 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="absolute inset-0 rounded-3xl overflow-hidden bg-maroon-950"
        >
          <Image
            src={item.src}
            alt={item.alt}
            fill
            sizes="(max-width: 768px) 82vw, 30vw"
            className="object-cover rounded-3xl transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

          {/* Animated Wearing Accessory Floating Pill */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="absolute bottom-4 left-4 right-4 p-3 rounded-2xl bg-black/60 backdrop-blur-md border border-royal-400/30 text-white"
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-royal-300 flex items-center gap-1">
                <span>{item.icon}</span> + {item.addedAccessory}
              </span>
              <span className="text-[10px] text-royal-200/70 font-semibold">Step {item.step}/6</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.25em] text-royal-200/80">{item.kind}</p>
      <h3 className="mt-1 font-display text-2xl font-black text-royal-50 md:text-3xl">{item.name}</h3>
      <p className="mt-1 max-w-xs text-sm text-royal-100/70 leading-relaxed">{item.note}</p>
      <Link
        href={item.href}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-royal-300 transition-colors hover:text-royal-100"
      >
        {item.cta} <ArrowUpRight size={14} />
      </Link>
    </article>
  );
}

function CollectionRail() {
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  const pinned = desktop && !reduce;

  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    if (!pinned) return;
    const measure = () => {
      if (track.current) setDistance(Math.max(0, track.current.scrollWidth - window.innerWidth));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pinned]);

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const slide = useTransform(scrollYProgress, (p) => -p * distance);
  const tint = useTransform(
    scrollYProgress,
    COLLECTION.map((_, i) => i / (COLLECTION.length - 1)),
    COLLECTION.map((item) => item.tint)
  );

  return (
    <section
      ref={section}
      id="collection"
      aria-label="Step by step royal crown transformation"
      className={`relative ${pinned ? 'h-[420vh]' : ''}`}
    >
      <motion.div
        style={{ backgroundColor: pinned ? tint : COLLECTION[0].tint }}
        // Pinned just below the site header, which stays on screen.
        className={`flex flex-col justify-center overflow-hidden py-14 ${pinned ? 'sticky top-20 h-[calc(100vh-5rem)] py-0' : ''}`}
      >
        <div className="mx-auto mb-8 flex w-full max-w-7xl items-end justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-royal-300">Royal Groom Transformation</p>
            <h2 className="mt-2 font-display text-4xl font-black text-royal-50 md:text-5xl">Step-by-Step Crown Wear</h2>
            <p className="mt-1 text-xs font-bold text-royal-200/70">
              Sherwani → Pearl Mala → Wedding Sword → Forehead Bindi → Safa Turban → Complete Maharaja Crown
            </p>
          </div>
          {pinned ? (
            <div className="hidden h-1.5 w-48 overflow-hidden rounded-full bg-white/15 md:block">
              <motion.div style={{ scaleX: scrollYProgress }} className="h-full origin-left rounded-full bg-royal-400" />
            </div>
          ) : (
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-royal-200/70">Swipe Steps →</p>
          )}
        </div>

        <motion.div
          ref={track}
          style={pinned ? { x: slide } : undefined}
          className={`flex gap-8 px-4 sm:px-6 md:gap-10 md:px-[8vw] ${
            pinned ? '' : 'snap-x snap-mandatory overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          }`}
        >
          {COLLECTION.map((item, i) => (
            <RailItem
              key={item.name}
              item={item}
              index={i}
              count={COLLECTION.length}
              progress={scrollYProgress}
              animate={pinned}
            />
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}

export function Hero({ onSelectStyle }: { onSelectStyle?: (style: string) => void }) {
  const [tryOnOpen, setTryOnOpen] = useState(false);

  return (
    <>
      <Stage onOpenTryOn={() => setTryOnOpen(true)} />
      <CollectionRail />
      <VirtualSafaTryOn
        isOpen={tryOnOpen}
        onClose={() => setTryOnOpen(false)}
        onSelectStyle={onSelectStyle}
      />
    </>
  );
}
