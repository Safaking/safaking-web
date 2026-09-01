'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Crown, ArrowLeft, ScrollText, Palette, Scissors, Landmark, Video, Play,
} from 'lucide-react';

const COLOR_MEANINGS = [
  { name: 'Maroon & Red', swatch: '#8B1E2F', meaning: 'The classic wedding colour — auspicious, bold, and tied to marital union across most of North India.' },
  { name: 'Saffron', swatch: '#E08D3C', meaning: "A colour of valour and sacrifice, historically worn by Rajput warriors before battle — carried into weddings as a mark of courage." },
  { name: 'Royal Blue', swatch: '#1E3A8A', meaning: 'Associated with depth and nobility — a favourite of Marwar (Jodhpur) royalty, still common in that region\'s safas today.' },
  { name: 'Pink & Chanderi Pastels', swatch: '#D9738C', meaning: 'Festive and celebratory — popular for sangeet, haldi and daytime functions rather than the main wedding ceremony.' },
  { name: 'Gold & Zari', swatch: '#C9A227', meaning: 'Prosperity and status — the metallic thread work itself, more than the base colour, signals a formal, high-occasion safa.' },
  { name: 'White & Cream', swatch: '#F0E6D2', meaning: 'Peace and simplicity — worn more in Gujarat and by elders, or for daytime and non-wedding functions.' },
];

const TYING_STEPS = [
  { step: '1. Sizing', desc: 'The cloth length and head measurement decide the fold width — a poor fit is the most common cause of a safa loosening during the event.' },
  { step: '2. Pleating', desc: 'The fabric is folded into even, narrow pleats by hand — the pleat count and tightness is what gives each regional style (Jodhpuri, rounded, Pacharangi) its distinct shape.' },
  { step: '3. Wrapping', desc: 'The pleated cloth is wound around the head in overlapping turns, building height and structure from the base upward.' },
  { step: '4. Securing', desc: 'Pins anchor the layers from the inside, invisible once finished — this is what lets a safa survive a full day of dancing and movement.' },
  { step: '5. Finishing', desc: 'The tail (pagri palla) is draped and set, then the kalgi and any brooch are placed last, once the base shape is fully locked in.' },
];

const VIDEOS = [
  { title: 'Meet SafaKing', src: '/videos/intro.mp4', desc: 'An introduction to our royal turban house.' },
];

export default function KnowledgeCenterPage() {
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-2 text-royal-200/70 hover:text-royal-300">
            <ArrowLeft size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Back to Site</span>
          </Link>
          <Link href="/" className="w-10 h-10 rounded-full bg-royal-gradient flex items-center justify-center">
            <Crown size={20} className="text-maroon-950" />
          </Link>
        </div>
      </header>

      <section className="relative bg-maroon-950 text-white py-16 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="absolute inset-0 pattern-diamond opacity-15" />
        <div className="relative max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-royal-500/15 border border-royal-400/30 text-royal-300 text-[11px] font-bold uppercase tracking-widest">
            <ScrollText size={13} /> Knowledge Center
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-royal-100">
            The Story Behind the Safa
          </h1>
          <p className="text-royal-200/70 text-sm max-w-lg mx-auto leading-relaxed">
            History, colour, craft and ceremony — everything that goes into every safa we tie.
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-14">
        {/* History */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
        >
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-amber-200/60 shadow-sm order-2 lg:order-1">
            <Image src="/hero-groom-maroon.jpg" alt="Royal safa" fill className="object-cover" />
          </div>
          <div className="order-1 lg:order-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-2">
              <ScrollText size={13} /> Safa History
            </span>
            <h2 className="font-display font-black text-2xl text-maroon-950 mb-3">
              A Turban Older Than the Kingdoms That Wore It
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              The safa (or pagdi) has been tied across the Indian subcontinent for centuries, long
              before it became a wedding staple. In Rajasthan especially, it carried real social
              weight — the way a turban was tied, its height, colour and shape could once signal a
              person&apos;s caste, region, occasion and even their state of mourning or celebration.
              Royal courts developed distinct regional styles — Jodhpuri, Jaipuri, Udaipuri, Mewari —
              each recognisable at a glance to anyone from that region. Over time the safa moved from
              everyday dress to a ceremonial one, and today it survives almost entirely in that
              ceremonial role: weddings, festivals and formal occasions, tied fresh by hand for every
              event rather than worn day to day.
            </p>
          </div>
        </motion.section>

        {/* Colors */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-2">
            <Palette size={13} /> Importance of Colours
          </span>
          <h2 className="font-display font-black text-2xl text-maroon-950 mb-2">
            Every Colour Says Something
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-6 max-w-2xl">
            Colour choice in a safa is rarely just aesthetic — it's tied to the occasion, the region,
            and sometimes the wearer&apos;s role in the ceremony. A quick guide:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COLOR_MEANINGS.map((c) => (
              <div key={c.name} className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-amber-200/60 shadow-sm">
                <span
                  className="w-10 h-10 rounded-xl shrink-0 border border-black/10 shadow-inner"
                  style={{ backgroundColor: c.swatch }}
                />
                <div>
                  <p className="font-bold text-sm text-maroon-950">{c.name}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{c.meaning}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Tying technique */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-2">
              <Scissors size={13} /> Tying Technique
            </span>
            <h2 className="font-display font-black text-2xl text-maroon-950 mb-3">
              Five Steps, One Continuous Fold
            </h2>
            <div className="space-y-3">
              {TYING_STEPS.map((s) => (
                <div key={s.step} className="flex gap-3">
                  <span className="font-display font-black text-amber-600 text-sm shrink-0 w-6">
                    {s.step.split('.')[0]}
                  </span>
                  <div>
                    <p className="font-bold text-sm text-maroon-950">{s.step.split('. ')[1]}</p>
                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-amber-200/60 shadow-sm">
            <Image src="/training-closeup-hands.jpg" alt="Tying a safa" fill className="object-cover" />
          </div>
        </motion.section>

        {/* Royal heritage */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
        >
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-amber-200/60 shadow-sm order-2 lg:order-1">
            <Image src="/artist-jodhpuri-blue.jpg" alt="Royal turban heritage" fill className="object-cover object-top" />
          </div>
          <div className="order-1 lg:order-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-2">
              <Landmark size={13} /> Royal Identity
            </span>
            <h2 className="font-display font-black text-2xl text-maroon-950 mb-3">
              More Than a Headpiece
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              In Rajputana tradition, offering or accepting a turban was a gesture of deep respect —
              removing another&apos;s turban was among the gravest insults, and gifting one's own was
              a mark of honour or alliance. Kalgi ornaments, once reserved for nobility, marked rank
              and occasion. That symbolism is why the groom's safa still holds centre stage at an
              Indian wedding today — it isn't just an outfit accessory, it's a small, wearable piece
              of that same tradition of honour, carried into a new generation's most important day.
            </p>
          </div>
        </motion.section>

        {/* Video library */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-2">
            <Video size={13} /> Video Library
          </span>
          <h2 className="font-display font-black text-2xl text-maroon-950 mb-6">
            Watch &amp; Learn
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VIDEOS.map((v) => (
              <div key={v.src} className="rounded-2xl overflow-hidden border border-amber-200/60 shadow-sm bg-white">
                <div className="relative aspect-video bg-maroon-950">
                  {playing === v.src ? (
                    <video src={v.src} controls autoPlay className="w-full h-full object-contain" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPlaying(v.src)}
                      className="w-full h-full flex items-center justify-center group"
                    >
                      <span className="w-14 h-14 rounded-full bg-royal-500 group-hover:bg-royal-400 flex items-center justify-center shadow-lg transition-colors">
                        <Play size={22} className="text-maroon-950 ml-0.5" fill="currentColor" />
                      </span>
                    </button>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-bold text-sm text-maroon-950">{v.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{v.desc}</p>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-dashed border-amber-300 flex items-center justify-center p-6 text-center">
              <p className="text-xs text-gray-400 leading-relaxed">
                More tying &amp; styling videos coming soon.
              </p>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
