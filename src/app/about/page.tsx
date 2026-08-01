'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Crown, Award, ShieldCheck, MapPin, CheckCircle2
} from 'lucide-react';
import { TopBanner } from '@/components/landing/TopBanner';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { AuthModal } from '@/components/auth/AuthModal';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { useState } from 'react';

export default function AboutPage() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-royal-50 text-maroon-950">
      <TopBanner />
      <Header onOpenAuth={() => setAuthOpen(true)} wishlistCount={0} />

      {/* Hero Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-maroon-950 text-white overflow-hidden">
        <div className="absolute inset-0 pattern-diamond opacity-20" />
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-royal-500/20 border border-royal-400/30 text-royal-300 text-xs font-bold uppercase tracking-widest mb-6"
          >
            <Crown size={15} /> Royal Heritage & Craftsmanship
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-display font-black text-royal-100 tracking-wider uppercase mb-6 leading-tight"
          >
            Preserving the Legacy of <br />
            <span className="text-gradient-gold italic">Indian Royal Safas</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-royal-200/70 max-w-3xl mx-auto text-base sm:text-lg leading-relaxed"
          >
            SafaKing is India’s premier house of royal turbans, wedding safa tying masters, and handcrafted Marwari & Rajwadi heritage accessories. For over three generations, we have dressed grooms, royal families, and grand wedding baraats across the globe.
          </motion.p>
        </div>
      </section>

      {/* Stats Counter Bar */}
      <section className="bg-maroon-900 text-white py-12 border-y border-royal-400/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '2,400+', label: 'Wedding Baraats Dressed' },
              { value: '50+', label: 'Master Safa Artists' },
              { value: '40+', label: 'Cities Across India' },
              { value: '100%', label: 'Handcrafted Heritage Fabrics' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="space-y-1"
              >
                <p className="text-3xl sm:text-4xl font-display font-black text-gradient-gold">{stat.value}</p>
                <p className="text-xs uppercase tracking-widest text-royal-200/60 font-bold">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Story & Philosophy */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-xs font-bold uppercase tracking-widest text-royal-600">Our Heritage Story</span>
            <h2 className="text-3xl sm:text-5xl font-display font-black text-maroon-950 leading-tight">
              Crafted for Royalty, <br />
              <span className="text-gradient-gold italic">Tailored for Your Special Day</span>
            </h2>
            <p className="text-sm leading-relaxed text-gray-700">
              A Safa is not just a piece of fabric — it is a symbol of honor, royal pride, and celebration in Indian tradition. From the intricate folds of Jodhpuri Silk to the grand flare of Marwari Baraat Turbans, every Safa tied by SafaKing embodies centuries of cultural majesty.
            </p>
            <p className="text-sm leading-relaxed text-gray-700">
              Our network of certified Master Safa Artists travel directly to your wedding venue or residence, ensuring flawless pleats, pearl brooch positioning, and kalgi adjustment for the groom and wedding guests alike.
            </p>

            <ul className="space-y-3 pt-2 text-xs font-bold text-maroon-900">
              {[
                'Handcrafted Chanderi, Zari Brocade & Pure Mulberry Silk',
                'Certified Master Tying Artists with 10+ years experience',
                'Transparent Advance / Post-Delivery Split Pricing',
                'Pincode delivery verification across 500+ hubs in India',
              ].map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-amber-600 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-royal-300/40">
            <Image
              src="/hero-groom-maroon.jpg"
              alt="Royal SafaKing Groom Turban"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-maroon-950/80 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white">
              <p className="font-display font-bold text-lg text-royal-100">SafaKing Flagship Studio</p>
              <p className="text-xs text-royal-200/80 mt-1">M.I. Road, Opposite Raj Mandir Cinema, Jaipur, Rajasthan</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values Grid */}
      <section className="py-20 bg-cream-gradient border-t border-royal-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-royal-600">Why Choose SafaKing</span>
            <h2 className="text-3xl sm:text-5xl font-display font-black text-maroon-950 mt-2">
              Our Core Pillars of Excellence
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                icon: Award,
                title: 'Master Artisans',
                desc: 'Our artists undergo rigorous training at the SafaKing Academy to master over 12 traditional royal tying styles.',
              },
              {
                icon: ShieldCheck,
                title: 'Fair Split Payment',
                desc: 'Pay a small advance to confirm your order or date, and settle the balance only after delivery or event completion.',
              },
              {
                icon: MapPin,
                title: 'Pan-India Reach',
                desc: 'Delivering physical safa products to 500+ Indian pincodes and dispatching on-site artists to 40+ major wedding cities.',
              },
            ].map((value, idx) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-3xl bg-white border border-royal-200/80 shadow-lg space-y-4 text-center hover:shadow-xl transition-shadow"
              >
                <div className="w-14 h-14 rounded-2xl bg-royal-gradient mx-auto flex items-center justify-center text-maroon-950 shadow-md">
                  <value.icon size={26} />
                </div>
                <h3 className="font-display font-bold text-xl text-maroon-950">{value.title}</h3>
                <p className="text-xs leading-relaxed text-gray-600">{value.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-20 bg-maroon-950 text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 relative z-10 space-y-6">
          <Crown size={40} className="text-royal-300 mx-auto animate-pulse" />
          <h2 className="text-3xl sm:text-5xl font-display font-black text-royal-100 uppercase tracking-wider">
            Ready to Dress Your Royal Baraat?
          </h2>
          <p className="text-xs sm:text-sm text-royal-200/70 max-w-xl mx-auto leading-relaxed">
            Explore our curated safa catalogue or reserve a certified Master Safa Artist for your wedding date.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link
              href="/shop"
              className="px-8 py-4 bg-royal-gradient text-maroon-950 font-bold rounded-2xl text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-transform"
            >
              Shop Safa Collection
            </Link>
            <Link
              href="/#artists"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs uppercase tracking-widest border border-white/20 transition-colors"
            >
              Book Safa Artist
            </Link>
          </div>
        </div>
      </section>

      <Footer />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <CartDrawer />
    </div>
  );
}
