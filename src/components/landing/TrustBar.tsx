'use client';

import { motion } from 'framer-motion';
import { Truck, Shield, RotateCcw, Award, Sparkles } from 'lucide-react';

const TRUST_ITEMS = [
  {
    icon: Truck,
    title: 'Free Pan-India Shipping',
    sub: 'On orders above ₹1,999',
    color: 'text-royal-600',
    bg: 'bg-royal-100',
  },
  {
    icon: Shield,
    title: '100% Authentic Fabric',
    sub: 'Certified silk & brocades',
    color: 'text-maroon-600',
    bg: 'bg-maroon-100',
  },
  {
    icon: RotateCcw,
    title: 'Easy 7-Day Returns',
    sub: 'Hassle-free exchange',
    color: 'text-amber-600',
    bg: 'bg-amber-100',
  },
  {
    icon: Award,
    title: 'Master Craftsmen',
    sub: 'Heritage-trained artists',
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
  },
  {
    icon: Sparkles,
    title: 'Customisation Available',
    sub: 'Your color, your style',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
  },
];

export function TrustBar() {
  return (
    <section className="py-12 px-4 bg-white border-y border-royal-200/40 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
          {TRUST_ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, scale: 1.03 }}
              className="flex flex-col items-center text-center gap-3 p-4 rounded-2xl hover:bg-royal-50/50 transition-colors cursor-default"
            >
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.4 }}
                className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center shadow-sm`}
              >
                <item.icon size={22} className={item.color} />
              </motion.div>
              <div>
                <p className="text-xs font-bold text-maroon-900 leading-snug">{item.title}</p>
                <p className="text-[10px] text-maroon-800/50 mt-0.5">{item.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
