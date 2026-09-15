'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Package, IndianRupee, Truck, ShieldCheck, ArrowRight, Store, Crown } from 'lucide-react';
import { AnimatedSection, StaggerContainer, staggerItem } from './AnimatedSection';
import { SUPPLIER_CATEGORIES } from '@/lib/supplier';

const BENEFITS = [
  {
    icon: IndianRupee,
    title: 'Your Price, Your Stock',
    desc: 'You decide what each safa costs and how many you have. See what you receive before you list.',
  },
  {
    icon: Truck,
    title: 'Your Delivery Charges',
    desc: 'Set one charge for your city, your state and the rest of India. The customer pays it.',
  },
  {
    icon: ShieldCheck,
    title: 'Payment Collected for You',
    desc: 'Customers pay SafaKing online. You are paid a week after delivery, straight to your account.',
  },
  {
    icon: Package,
    title: 'Checked Listings',
    desc: 'Every product is checked before it goes live, so buyers can trust what they see.',
  },
];

const STEPS = [
  'Apply with your own supplier account',
  'Upload a photo of your shop and a bank proof',
  'List your products. We check each one',
  'Pack and send paid orders. Get paid a week after delivery',
];

export function SupplierSection() {
  return (
    <section id="suppliers" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
      <div className="absolute inset-0 pattern-ornate opacity-50" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <AnimatedSection>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-royal-100 text-royal-700 text-xs font-bold uppercase tracking-widest mb-4">
              <Package size={14} /> Supplier Network
            </span>
            <h2 className="text-4xl sm:text-5xl font-display font-black text-maroon-900 mb-6 leading-tight">
              Sell Your Safas on <span className="text-gradient-maroon italic">SafaKing</span>
            </h2>
            <p className="text-maroon-800/60 text-base leading-relaxed mb-8">
              Are you a safa maker, silk weaver or accessory artisan? List your products on SafaKing and reach
              grooms and wedding families who are already shopping for safas.
            </p>

            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {BENEFITS.map((benefit) => (
                <motion.div
                  key={benefit.title}
                  variants={staggerItem}
                  className="flex gap-3 p-4 rounded-xl bg-royal-50/80 border border-royal-200/50 hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-lg bg-maroon-700 text-royal-200 flex items-center justify-center shrink-0">
                    <benefit.icon size={20} />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-maroon-900">{benefit.title}</h4>
                    <p className="text-xs text-maroon-800/50 mt-0.5 leading-relaxed">{benefit.desc}</p>
                  </div>
                </motion.div>
              ))}
            </StaggerContainer>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-maroon-700">We Welcome</p>
              <div className="flex flex-wrap gap-2">
                {SUPPLIER_CATEGORIES.map((type) => (
                  <span
                    key={type}
                    className="px-3 py-1.5 rounded-full bg-maroon-50 border border-maroon-200/60 text-[11px] font-semibold text-maroon-800"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-royal-200/40 to-maroon-200/30 rounded-3xl blur-2xl" />
              <div className="relative bg-white rounded-3xl border border-royal-200/60 shadow-2xl shadow-maroon-900/10 p-8 sm:p-10">
                <div className="w-14 h-14 rounded-2xl bg-maroon-950 text-royal-300 flex items-center justify-center mb-5">
                  <Store size={28} />
                </div>
                <h3 className="font-display font-bold text-2xl text-maroon-900 mb-2">Become a SafaKing Supplier</h3>
                <p className="text-sm text-maroon-800/50 mb-6">
                  Applying takes about five minutes. Our team calls you before you are approved.
                </p>

                <ol className="space-y-3 mb-8">
                  {STEPS.map((step, index) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-royal-100 text-maroon-900 text-xs font-black flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-sm text-maroon-900 pt-1">{step}</span>
                    </li>
                  ))}
                </ol>

                <Link
                  href="/supplier-portal/login?tab=join"
                  className="w-full bg-royal-500 hover:bg-royal-400 text-maroon-950 font-bold py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-colors"
                >
                  Join as a Supplier <ArrowRight size={16} />
                </Link>
                <Link
                  href="/supplier-portal/login"
                  className="mt-3 w-full border border-royal-300 hover:bg-royal-50 text-maroon-900 font-bold py-3 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center transition-colors"
                >
                  Supplier Login
                </Link>
                <p className="mt-5 flex items-start gap-2 text-[11px] text-maroon-800/60 leading-relaxed">
                  <Crown size={13} className="shrink-0 mt-0.5 text-royal-600" />
                  Already a SafaKing safa artist? Use a separate account, with a different email, to sell products.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
