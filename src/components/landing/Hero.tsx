'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Crown, ArrowUpRight, Sparkles, Star } from 'lucide-react';
import { useRef } from 'react';

const floatAnimation = {
  y: [0, -18, 0],
  transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const },
};

const floatAnimationDelayed = {
  y: [0, 16, 0],
  transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' as const, delay: 1.5 },
};

export function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={ref}
      id="home"
      className="relative overflow-hidden bg-royal-gradient text-white min-h-screen flex items-center"
    >
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.45, 0.2] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 -left-48 w-[500px] h-[500px] bg-royal-500/25 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-0 -right-48 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] border border-royal-400/5 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] border border-royal-400/8 rounded-full"
        />
        <div className="absolute inset-0 pattern-diamond opacity-30" />
      </div>

      <motion.div
        style={{ y, opacity }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 relative z-10 w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-16">
          {/* Left content */}
          <div className="space-y-8 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-royal-500/15 border border-royal-400/30 text-royal-200 text-xs font-bold uppercase tracking-[0.2em]"
            >
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Sparkles size={14} className="text-royal-400" />
              </motion.span>
              Premium Royal Heritage Since 1998
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-display font-black leading-[1.02] tracking-tight"
            >
              <span className="text-royal-50">Crown Your</span>
              <br />
              <span className="text-gradient-gold italic">Special Day</span>
              <br />
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.7 }}
                className="text-royal-100/80 text-4xl sm:text-5xl lg:text-6xl"
              >
                With SafaKing
              </motion.span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-royal-100/70 text-base sm:text-lg font-light leading-relaxed max-w-lg mx-auto lg:mx-0"
            >
              Opulent Chanderi silk safas, master safa artists for every style, and India&apos;s finest
              turban training academy — all under one royal roof.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/shop"
                  className="group w-full sm:w-auto bg-royal-500 hover:bg-royal-400 text-maroon-950 font-bold px-8 py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-royal-900/40 flex items-center justify-center gap-2 transition-colors"
                >
                  Browse Collection
                  <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="#artists"
                  className="w-full sm:w-auto border-2 border-royal-400/50 hover:border-royal-300 text-royal-100 font-bold px-8 py-4 rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-royal-500/10"
                >
                  <Crown size={16} />
                  Book Safa Artist
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center lg:justify-start gap-10 pt-2"
            >
              {[
                { value: '500+', label: 'Royal Safas' },
                { value: '50+', label: 'Master Artists' },
                { value: '10K+', label: 'Happy Grooms' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="text-center lg:text-left"
                >
                  <p className="text-2xl font-display font-bold text-royal-300">{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-widest text-royal-200/50 font-bold mt-0.5">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right — hero image stack */}
          <div className="relative flex items-center justify-center h-[480px] sm:h-[580px]">
            {/* Main hero image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.82, rotate: -3 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10"
            >
              <motion.div
                animate={{ boxShadow: ['0 0 40px rgba(212,175,55,0.15)', '0 0 80px rgba(212,175,55,0.35)', '0 0 40px rgba(212,175,55,0.15)'] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -inset-3 rounded-[2.5rem] blur-xl"
              />
              <div className="relative w-64 sm:w-72 h-80 sm:h-96 rounded-[2.5rem] overflow-hidden border-2 border-royal-400/50 shadow-2xl shadow-black/50">
                <Image
                  src="/hero-groom-maroon.jpg"
                  alt="Royal Indian Groom in Maroon Safa"
                  fill
                  className="object-cover object-top"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-maroon-950/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={10} className="fill-royal-400 text-royal-400" />
                    ))}
                  </div>
                  <p className="text-white text-[10px] font-bold uppercase tracking-widest">Maroon Royal Safa</p>
                </div>
              </div>
            </motion.div>

            {/* Floating card — Pink Safa */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0, ...floatAnimation }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="absolute top-6 -left-4 sm:left-0 z-20 w-40 sm:w-48 glass-card p-2 rounded-2xl border border-royal-200/50 shadow-2xl overflow-hidden"
            >
              <div className="relative w-full h-28 rounded-xl overflow-hidden">
                <Image
                  src="/product-pink-chanderi.jpg"
                  alt="Imperial Pink Silk Safa"
                  fill
                  className="object-cover"
                />
              </div>
              <p className="text-[10px] font-bold text-maroon-700 uppercase text-center mt-2 tracking-wider">
                Imperial Pink Silk
              </p>
              <p className="text-[9px] text-maroon-500/60 text-center">Chanderi · ₹3,499</p>
            </motion.div>

            {/* Floating card — Blue Safa */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0, ...floatAnimationDelayed }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="absolute bottom-10 -right-4 sm:right-0 z-20 w-40 sm:w-48 glass-card p-2 rounded-2xl border border-royal-200/50 shadow-2xl overflow-hidden"
            >
              <div className="relative w-full h-28 rounded-xl overflow-hidden">
                <Image
                  src="/artist-jodhpuri-blue.jpg"
                  alt="Royal Blue Jodhpuri Safa"
                  fill
                  className="object-cover object-top"
                />
              </div>
              <p className="text-[10px] font-bold text-maroon-700 uppercase text-center mt-2 tracking-wider">
                Jodhpuri Royal Blue
              </p>
              <p className="text-[9px] text-maroon-500/60 text-center">Brocade · ₹4,199</p>
            </motion.div>

            {/* Rotating decorative rings */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-[380px] h-[380px] sm:w-[450px] sm:h-[450px] rounded-full border border-dashed border-royal-400/20" />
            </motion.div>
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] rounded-full border border-dotted border-royal-300/10" />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-royal-400/50"
      >
        <span className="text-[10px] uppercase tracking-widest font-bold">Scroll</span>
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-0.5 h-8 bg-gradient-to-b from-royal-400/50 to-transparent rounded-full"
        />
      </motion.div>
    </section>
  );
}
