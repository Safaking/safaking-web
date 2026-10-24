'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gift, QrCode, IndianRupee, ArrowRight, Users, Briefcase } from 'lucide-react';
import { AnimatedSection, StaggerContainer, staggerItem } from './AnimatedSection';

/**
 * Referrals, on the home page.
 *
 * The refer page existed but nothing on the way in pointed at it, so only
 * somebody who already knew it was there ever found it. A wedding is bought
 * for once and talked about for months, which makes the people already
 * buying the best place to ask.
 */

const STEPS = [
  {
    icon: QrCode,
    title: 'Share your code',
    desc: 'Send it on WhatsApp, or hand over your QR — print it, or hold up your phone.',
  },
  {
    icon: Gift,
    title: 'They get credit',
    desc: 'Whoever uses your code gets credit off their first order straight away.',
  },
  {
    icon: IndianRupee,
    title: 'You get credit',
    desc: 'You earn 10% of every order they place afterwards — not only the first.',
  },
];

export function ReferSection() {
  return (
    <section id="refer" className="relative overflow-hidden bg-maroon-950 px-4 py-24 sm:px-6 lg:px-8">
      <div className="pattern-ornate absolute inset-0 opacity-20" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <AnimatedSection className="text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-royal-400/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-royal-300">
            <Users size={14} /> Refer a friend
          </span>
          <h2 className="mb-5 font-display text-4xl font-black leading-tight text-royal-100 sm:text-5xl">
            Tell a friend, <span className="italic text-royal-300">both of you gain</span>
          </h2>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-royal-100/60">
            A wedding is bought for once and talked about for months. Pass your code to the next
            family planning one — they save on their first order, and so do you.
          </p>
        </AnimatedSection>

        <StaggerContainer className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <motion.div
              key={step.title}
              variants={staggerItem}
              className="rounded-2xl border border-royal-400/20 bg-white/5 p-6 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-royal-400 text-maroon-950">
                <step.icon size={22} />
              </div>
              <h3 className="font-display text-base font-bold text-royal-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-royal-100/55">{step.desc}</p>
            </motion.div>
          ))}
        </StaggerContainer>

        <AnimatedSection className="mt-12 text-center">
          {/* Two ways in, side by side. A shop or a planner is not going to
              find "business partner" buried at the bottom of another page. */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/refer"
              className="inline-flex items-center gap-2 rounded-full bg-royal-400 px-8 py-4 text-xs font-bold uppercase tracking-widest text-maroon-950 transition-colors hover:bg-royal-300"
            >
              Get your code and QR <ArrowRight size={15} />
            </Link>
            <Link
              href="/refer#partner"
              className="inline-flex items-center gap-2 rounded-full border border-royal-400/40 px-8 py-4 text-xs font-bold uppercase tracking-widest text-royal-200 transition-colors hover:border-royal-400/70"
            >
              <Briefcase size={15} /> Sign up as a business partner
            </Link>
          </div>
          <p className="mt-4 text-xs text-royal-200/45">
            Credit comes off your next order on its own — nothing to remember at checkout.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
