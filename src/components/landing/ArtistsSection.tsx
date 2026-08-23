'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Calendar, MapPin, Star, Phone, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { AnimatedSection, StaggerContainer, staggerItem } from './AnimatedSection';

const SAFA_STYLES = [
  {
    name: 'Rounded',
    region: 'Pan-India',
    image: '/artist-jodhpuri-blue.jpg',
    imagePosition: 'object-top',
    desc: 'The classic rounded safa — clean pleats with a smooth crown shape, ideal for all occasions and face cuts.',
    duration: '30 min',
    price: 50,
    popular: false,
    color: 'from-blue-900 to-indigo-950',
    tag: 'Classic Style',
    features: ['Smooth rounded crown', 'Quick 30-minute tying', 'Suits all fabric types'],
  },
  {
    name: 'Jodhpuri',
    region: 'Rajasthan',
    image: '/hero-groom-maroon.jpg',
    imagePosition: 'object-top',
    desc: 'Grand flared kalgi with rich brocade pleats — the crown of Marwar royalty. Perfect for the wedding baraat.',
    duration: '45 min',
    price: 50,
    popular: true,
    color: 'from-maroon-900 to-red-950',
    tag: 'Most Booked',
    features: ['Gold zari brocade fabric', 'Kalgi & pearl brooch included', 'Flared Marwari pleats'],
  },
  {
    name: 'Barati Safa',
    region: 'North India',
    image: '/product-pink-chanderi.jpg',
    imagePosition: 'object-center',
    desc: 'Vibrant festive safa worn by wedding baraat members — lively, colourful, and traditionally tied for processions.',
    duration: '25 min',
    price: 50,
    popular: false,
    color: 'from-pink-900 to-rose-950',
    tag: 'Baraat Special',
    features: ['Bright silk & Bandhani options', 'Fast group tying available', 'Perfect for baraat party'],
  },
];

import { supabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendWhatsAppNotification } from '@/lib/whatsapp';

import { checkArtistPincode, PincodeCheckResult } from '@/lib/pincodes';
import { ContractCheckbox } from '@/components/booking/ContractCheckbox';

interface ArtistsSectionProps {
  onOpenArtistRegister?: () => void;
}

export function ArtistsSection({ onOpenArtistRegister }: ArtistsSectionProps = {}) {
  const { user } = useAuth();
  const [selectedStyle, setSelectedStyle] = useState(SAFA_STYLES[0].name);
  const [safaCount, setSafaCount] = useState<number>(25);
  const [pincode, setPincode] = useState('302001');
  const [pincodeResult, setPincodeResult] = useState<PincodeCheckResult | null>({
    deliverable: true,
    message: '✓ Master Safa Artists Available in Jaipur, Rajasthan!',
  });

  const [booked, setBooked] = useState(false);
  const [, setHovered] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advanceRate, setAdvanceRate] = useState(0.2);
  const [contractAccepted, setContractAccepted] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [cityVenue, setCityVenue] = useState('');

  const currentStyleObj = SAFA_STYLES.find((s) => s.name === selectedStyle) || SAFA_STYLES[0];
  const unitPrice = currentStyleObj.price || 50;
  const totalBookingAmount = safaCount * unitPrice;
  const advanceAmount = Math.round(totalBookingAmount * advanceRate);
  const balanceAmount = totalBookingAmount - advanceAmount;

  // The advance percentage is admin-controlled (10-30%).
  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'advance_rate')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value != null) setAdvanceRate(Number(data.value));
      });
  }, []);

  const handlePincodeChange = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);
    if (clean.length === 6) {
      const res = await checkArtistPincode(clean);
      setPincodeResult(res);
    } else {
      setPincodeResult(null);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (pincodeResult && !pincodeResult.deliverable) {
      setError('Safa Artist service is currently unavailable for this pincode. Please contact us for custom travel.');
      return;
    }
    if (!contractAccepted) {
      setError('Please accept the booking terms to continue.');
      return;
    }

    setSubmitting(true);

    const bookingPayload = {
      customer_id: user?.id ?? null,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      event_date: eventDate,
      city_venue: `${cityVenue.trim()} (Pincode: ${pincode}, Count: ${safaCount} Safas)`,
      safa_style: `${selectedStyle} x ${safaCount}`,
      amount: totalBookingAmount,
      advance_amount: advanceAmount,
      balance_amount: balanceAmount,
      // No money has moved yet — artist bookings do not go through Razorpay
      // (see Pillar 2). Recording 'advance_paid' here would be a false record.
      payment_status: 'advance_pending',
      status: 'pending',
    };

    // No column-stripping retry here: silently dropping advance_amount /
    // balance_amount / payment_status saved bookings with no payment record
    // while still reporting success. The columns exist as of
    // supabase/002_production_hardening.sql.
    const { error: insertErr } = await supabase.from('artist_bookings').insert(bookingPayload);

    setSubmitting(false);

    if (insertErr) {
      setError(friendlyError(insertErr));
      return;
    }

    sendWhatsAppNotification('booking', {
      bookingId: 'new',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      cityVenue: `${cityVenue.trim()} (Pincode: ${pincode}, Count: ${safaCount})`,
      eventDate,
      safaStyle: `${selectedStyle} x ${safaCount}`,
    });

    setCustomerName('');
    setContractAccepted(false);
    setCustomerPhone('');
    setEventDate('');
    setCityVenue('');
    setBooked(true);
    setTimeout(() => setBooked(false), 5000);
  };

  return (
    <section id="artists" className="relative py-28 px-4 sm:px-6 lg:px-8 bg-cream-gradient overflow-hidden">
      {/* Background decoration */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-0 right-0 w-[500px] h-[500px] bg-royal-300/15 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute bottom-0 left-0 w-96 h-96 bg-maroon-300/10 rounded-full blur-3xl pointer-events-none"
      />

      <div className="max-w-7xl mx-auto relative z-10">
        <AnimatedSection className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-maroon-100 text-maroon-700 text-xs font-bold uppercase tracking-widest mb-5"
          >
            <Crown size={14} /> Master Safa Artists
          </motion.span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-black text-maroon-900 mb-5">
            Tied in Every{' '}
            <span className="text-gradient-gold italic">Royal Style</span>
          </h2>
          <p className="text-maroon-800/60 max-w-2xl mx-auto text-base leading-relaxed mb-6">
            Our certified safa artists travel across India to tie your safa in the tradition of your
            heritage — from Jodhpuri grandeur to Patiala elegance.
          </p>

          {onOpenArtistRegister && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenArtistRegister}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-maroon-950 text-royal-300 font-bold text-xs uppercase tracking-widest shadow-lg border border-royal-400/30 hover:bg-maroon-900 transition-colors"
            >
              <Crown size={15} /> Are You a Safa Artist? Apply to Join Network ➔
            </motion.button>
          )}
        </AnimatedSection>

        {/* Style cards — 3 categories */}
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-20">
          {SAFA_STYLES.map((style) => (
            <motion.div
              key={style.name}
              variants={staggerItem}
              onClick={() => setSelectedStyle(style.name)}
              onHoverStart={() => setHovered(style.name)}
              onHoverEnd={() => setHovered(null)}
              whileHover={{ y: -10, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`group cursor-pointer rounded-3xl overflow-hidden border-2 transition-all duration-300 shadow-lg ${
                selectedStyle === style.name
                  ? 'border-royal-500 shadow-2xl shadow-royal-500/25'
                  : 'border-transparent hover:border-royal-300 bg-white'
              }`}
            >
              {/* Image */}
              <div className="relative aspect-[3/4] overflow-hidden">
                <Image
                  src={style.image}
                  alt={style.name}
                  fill
                  className={`object-cover ${style.imagePosition} transition-transform duration-700 group-hover:scale-110`}
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${style.color}/70 via-transparent to-transparent opacity-70`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                {/* Tag badge */}
                <motion.span
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="absolute top-4 left-4 bg-royal-500 text-maroon-950 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg"
                >
                  {style.tag}
                </motion.span>

                {/* Selected tick */}
                {selectedStyle === style.name && (
                  <motion.div
                    layoutId="selectedBadge"
                    className="absolute top-4 right-4 w-8 h-8 bg-royal-500 rounded-full flex items-center justify-center shadow-lg"
                  >
                    <CheckCircle2 size={16} className="text-maroon-950" />
                  </motion.div>
                )}

                {/* Name overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <p className="text-royal-300 text-[10px] font-bold uppercase tracking-[0.25em] mb-1">{style.region}</p>
                  <h3 className="text-white font-display font-black text-2xl leading-tight">{style.name}</h3>
                  <p className="text-white/60 text-xs mt-1 font-bold uppercase tracking-wider">~{style.duration} tying time</p>
                </div>
              </div>

              {/* Card body */}
              <div className="p-6 bg-white">
                <p className="text-sm text-maroon-800/65 leading-relaxed mb-4">{style.desc}</p>

                {/* Feature bullets */}
                <ul className="space-y-2 mb-4">
                  {style.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5 text-xs text-maroon-900 font-medium">
                      <CheckCircle2 size={13} className="text-royal-500 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>

                <motion.div
                  animate={{ opacity: selectedStyle === style.name ? 1 : 0, scale: selectedStyle === style.name ? 1 : 0.8 }}
                  className="text-[10px] font-black text-royal-600 bg-royal-100 border border-royal-200 px-3 py-1.5 rounded-full inline-flex items-center gap-1"
                >
                  <CheckCircle2 size={11} /> Selected for booking
                </motion.div>
              </div>
            </motion.div>
          ))}
        </StaggerContainer>

        {/* Booking CTA */}
        <AnimatedSection>
          <div className="relative rounded-3xl overflow-hidden bg-royal-gradient shadow-2xl shadow-maroon-900/40">
            <div className="absolute inset-0 pattern-diamond opacity-30" />

            {/* Animated glow orbs */}
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 6, repeat: Infinity }}
              className="absolute top-0 right-1/4 w-64 h-64 bg-royal-400/20 rounded-full blur-3xl pointer-events-none"
            />

            <div className="relative grid grid-cols-1 lg:grid-cols-2">
              {/* Left — safa artist image */}
              <div className="relative aspect-[4/3] lg:aspect-auto min-h-[300px] overflow-hidden">
                <Image
                  src="/artist-jodhpuri-blue.jpg"
                  alt="Master Safa Artist"
                  fill
                  className="object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-maroon-950/70 lg:block hidden" />
                <div className="absolute inset-0 bg-gradient-to-t from-maroon-950/60 to-transparent lg:hidden" />

                {/* Rating pill */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="absolute bottom-6 left-6 glass-card rounded-2xl px-4 py-3 border border-royal-400/30 shadow-xl"
                >
                  <div className="flex items-center gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className="fill-royal-400 text-royal-400" />
                    ))}
                  </div>
                  <p className="text-white text-xs font-bold">4.9 · 2,400+ bookings</p>
                </motion.div>
              </div>

              <div className="p-8 sm:p-12">
                <div className="mb-6">
                  <span className="text-royal-300 text-xs font-bold uppercase tracking-widest">Book Your Artist</span>
                  <h3 className="text-3xl sm:text-4xl font-display font-black text-white mt-2 leading-tight">
                    Reserve a Master Safa Artist for Your Wedding
                  </h3>
                </div>

                <ul className="space-y-3 mb-8">
                  {[
                    'On-site safa tying at venue or home',
                    'All safa styles & regional traditions',
                    'Includes brooch, kalgi & accessory setup',
                    'Available across 40+ cities in India',
                  ].map((item, i) => (
                    <motion.li
                      key={item}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 * i }}
                      className="flex items-start gap-3 text-sm text-royal-100/80"
                    >
                      <CheckCircle2 size={18} className="text-royal-400 shrink-0 mt-0.5" />
                      {item}
                    </motion.li>
                  ))}
                </ul>

                <AnimatePresence mode="wait">
                  {booked ? (
                    <motion.div
                      key="success"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex flex-col items-center py-8 text-center"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.5 }}
                      >
                        <CheckCircle2 size={60} className="text-green-400 mb-4" />
                      </motion.div>
                      <h4 className="text-2xl font-display font-bold text-white">Booking Request Sent!</h4>
                      <p className="text-sm text-royal-200/60 mt-2">Our team will call you within 2 hours.</p>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleBooking}
                      className="space-y-3"
                    >
                      <h4 className="font-display font-bold text-lg text-white mb-4">
                        Quick Booking — {selectedStyle}
                      </h4>

                      {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-100">
                          <AlertCircle size={15} className="shrink-0 mt-0.5" />
                          <p className="text-[11px] leading-relaxed">{error}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          required
                          type="text"
                          placeholder="Your Name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/10 text-white placeholder:text-royal-200/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                        />
                        <input
                          required
                          type="tel"
                          placeholder="Phone Number"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/10 text-white placeholder:text-royal-200/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-royal-400" />
                          <input
                            required
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-royal-400/20 bg-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                          />
                        </div>
                        <div className="relative">
                          <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-royal-400" />
                          <input
                            required
                            type="text"
                            placeholder="City / Venue Address"
                            value={cityVenue}
                            onChange={(e) => setCityVenue(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-royal-400/20 bg-white/10 text-white placeholder:text-royal-200/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                          />
                        </div>
                      </div>

                      {/* Event Pincode & Artist Availability Badge */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[10px] font-bold text-royal-300/70 uppercase tracking-widest">
                            Event Venue Pincode (6-Digits)
                          </label>
                        </div>
                        <input
                          required
                          type="text"
                          maxLength={6}
                          placeholder="e.g. 302001"
                          value={pincode}
                          onChange={(e) => handlePincodeChange(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/10 text-white text-sm placeholder:text-royal-200/40 focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                        />
                        {pincodeResult && (
                          <p
                            className={`text-xs font-bold mt-1.5 p-2 rounded-xl border ${
                              pincodeResult.deliverable
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {pincodeResult.message}
                          </p>
                        )}
                      </div>

                      {/* Safa Count Selector */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-[10px] font-bold text-royal-300/70 uppercase tracking-widest">
                            Number of Safas to Tie (Count)
                          </p>
                          <span className="text-xs font-black text-royal-300">{safaCount} Safas</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {[10, 25, 50, 100].map((count) => (
                            <button
                              key={count}
                              type="button"
                              onClick={() => setSafaCount(count)}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                safaCount === count
                                  ? 'bg-royal-500 text-maroon-950 border-royal-400 shadow-md font-black'
                                  : 'bg-white/10 text-white border-royal-400/20 hover:bg-white/20'
                              }`}
                            >
                              {count}
                            </button>
                          ))}
                          <input
                            type="number"
                            min={1}
                            value={safaCount}
                            onChange={(e) => setSafaCount(Math.max(1, Number(e.target.value) || 1))}
                            className="w-16 py-2.5 px-2 text-center rounded-xl border border-royal-400/20 bg-white/10 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-royal-400/30"
                          />
                        </div>
                      </div>

                      {/* Pill-style style selector */}
                      <div>
                        <p className="text-[10px] font-bold text-royal-300/70 uppercase tracking-widest mb-2">Select Safa Tying Style</p>
                        <div className="grid grid-cols-3 gap-2">
                          {SAFA_STYLES.map((s) => (
                            <motion.button
                              key={s.name}
                              type="button"
                              onClick={() => setSelectedStyle(s.name)}
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                              className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-2xl border-2 text-center transition-all duration-200 ${
                                selectedStyle === s.name
                                  ? 'bg-royal-500 border-royal-400 shadow-lg shadow-royal-500/40'
                                  : 'bg-white/8 border-royal-400/20 hover:border-royal-400/50 hover:bg-white/15'
                              }`}
                            >
                              {selectedStyle === s.name && (
                                <motion.div
                                  layoutId="pillSelected"
                                  className="absolute inset-0 rounded-2xl bg-royal-500"
                                  style={{ zIndex: -1 }}
                                />
                              )}
                              <span className={`text-xs font-black leading-tight ${
                                selectedStyle === s.name ? 'text-maroon-950' : 'text-white'
                              }`}>
                                {s.name}
                              </span>
                              <span className={`text-[10px] font-bold mt-0.5 ${
                                selectedStyle === s.name ? 'text-maroon-800' : 'text-royal-400'
                              }`}>
                                ₹{s.price}/safa
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Split Payment Summary Card */}
                      <div className="p-3.5 rounded-2xl bg-maroon-950/80 border border-royal-400/30 space-y-1.5 text-xs">
                        <div className="flex justify-between font-bold text-royal-200/80">
                          <span>Total Booking Fee ({safaCount} Safas @ ₹{unitPrice})</span>
                          <span className="text-white font-black">₹{totalBookingAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold text-emerald-300 bg-emerald-950/60 p-2 rounded-xl border border-emerald-500/30">
                          <span>⚡ {Math.round(advanceRate * 100)}% Booking Advance Today</span>
                          <span>₹{advanceAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold text-amber-300 bg-amber-950/60 p-2 rounded-xl border border-amber-500/30">
                          <span>🎨 Balance to Artist at Event</span>
                          <span>₹{balanceAmount.toLocaleString()}</span>
                        </div>
                      </div>

                      <ContractCheckbox accepted={contractAccepted} onChange={setContractAccepted} theme="dark" />

                      <motion.button
                        whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
                        whileTap={{ scale: 0.97 }}
                        type="submit"
                        disabled={submitting || (!!pincodeResult && !pincodeResult.deliverable)}
                        className="w-full bg-royal-500 hover:bg-royal-400 disabled:opacity-60 disabled:cursor-not-allowed text-maroon-950 font-bold py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-colors"
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Reserving Date…
                          </>
                        ) : (
                          <>
                            <Phone size={16} /> Pay {Math.round(advanceRate * 100)}% Advance (₹{advanceAmount.toLocaleString()}) & Lock Date for {safaCount} Safas
                          </>
                        )}
                      </motion.button>
                      <p className="text-[10px] text-center text-royal-200/50">
                        ⚡ {Math.round(advanceRate * 100)}% Advance Today · Balance to Artist at Event
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
