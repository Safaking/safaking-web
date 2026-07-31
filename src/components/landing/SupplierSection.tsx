'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, TrendingUp, Globe, Handshake, CheckCircle2, ArrowRight } from 'lucide-react';
import { AnimatedSection, StaggerContainer, staggerItem } from './AnimatedSection';

const BENEFITS = [
  {
    icon: Globe,
    title: 'Pan-India Reach',
    desc: 'Sell to 10,000+ groom customers across 40 cities through our platform.',
  },
  {
    icon: TrendingUp,
    title: 'Premium Margins',
    desc: 'Competitive wholesale rates with transparent pricing and fast settlements.',
  },
  {
    icon: Package,
    title: 'Quality Assurance',
    desc: 'Every listing reviewed by our heritage textile experts before going live.',
  },
  {
    icon: Handshake,
    title: 'Long-Term Partnership',
    desc: 'Dedicated account manager, marketing support, and seasonal collection launches.',
  },
];

const SUPPLIER_TYPES = [
  'Silk & Brocade Weavers',
  'Bandhani & Leheriya Artisans',
  'Zari & Embroidery Houses',
  'Ready-Made Safa Manufacturers',
  'Brooch & Kalgi Accessory Makers',
];

import { supabase } from '@/lib/supabase';

export function SupplierSection() {
  const [submitted, setSubmitted] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    try {
      await supabase.from('supplier_applications').insert([
        {
          business_name: businessName,
          contact_name: contactName,
          email,
          phone,
          city,
          status: 'pending',
        },
      ]);
    } catch (err) {
      console.warn('Supplier insertion warning:', err);
    }

    setTimeout(() => setSubmitted(false), 4000);
  };

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
              Join Our Royal <span className="text-gradient-maroon italic">Supplier</span> Network
            </h2>
            <p className="text-maroon-800/60 text-base leading-relaxed mb-8">
              Are you a safa manufacturer, silk weaver, or accessory artisan? Partner with SafaKing and reach India&apos;s largest groom safa marketplace.
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
                {SUPPLIER_TYPES.map((type) => (
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
                {submitted ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center justify-center py-16 text-center"
                  >
                    <CheckCircle2 size={64} className="text-green-500 mb-4" />
                    <h4 className="text-2xl font-display font-bold text-maroon-900">Application Received!</h4>
                    <p className="text-sm text-maroon-800/60 mt-2 max-w-xs">
                      Our partnerships team will review and respond within 3 business days.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    <h3 className="font-display font-bold text-2xl text-maroon-900 mb-2">Supplier Registration</h3>
                    <p className="text-sm text-maroon-800/50 mb-8">Fill in your details to start the onboarding process.</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                          required
                          type="text"
                          placeholder="Business / Brand Name"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-royal-200 bg-royal-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-400 transition-all"
                        />
                        <input
                          required
                          type="text"
                          placeholder="Contact Person"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-royal-200 bg-royal-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-400 transition-all"
                        />
                      </div>
                      <input
                        required
                        type="email"
                        placeholder="Business Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-royal-200 bg-royal-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-400 transition-all"
                      />
                      <input
                        required
                        type="tel"
                        placeholder="Phone Number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-royal-200 bg-royal-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-400 transition-all"
                      />
                      <select
                        required
                        className="w-full px-4 py-3 rounded-xl border border-royal-200 bg-royal-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-400 transition-all"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Supplier Category
                        </option>
                        {SUPPLIER_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="City / State"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-royal-200 bg-royal-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-400 transition-all"
                      />
                      <textarea
                        rows={3}
                        placeholder="Tell us about your products & capacity..."
                        className="w-full px-4 py-3 rounded-xl border border-royal-200 bg-royal-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-400 transition-all resize-none"
                      />
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className="w-full bg-royal-500 hover:bg-royal-400 text-maroon-950 font-bold py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-colors"
                      >
                        Register as Supplier
                        <ArrowRight size={16} />
                      </motion.button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
