'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Crown, Phone, Mail, MapPin, Clock, MessageCircle, Send, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { TopBanner } from '@/components/landing/TopBanner';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { AuthModal } from '@/components/auth/AuthModal';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { getWhatsAppClickLink } from '@/lib/whatsapp';
import { BUSINESS, telHref, mailtoHref } from '@/lib/business';

export default function ContactPage() {
  const [authOpen, setAuthOpen] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inquiryType, setInquiryType] = useState('Wedding Safa Booking');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setTimeout(() => setSubmitted(false), 5000);
    }, 1000);
  };

  const whatsappMessage = `Hello SafaKing Team, I would like to inquire about ${inquiryType}. My Name: ${name || 'Customer'}.`;

  return (
    <div className="min-h-screen bg-royal-50 text-maroon-950">
      <TopBanner />
      <Header onOpenAuth={() => setAuthOpen(true)} wishlistCount={0} />

      {/* Header Banner */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-maroon-950 text-white overflow-hidden text-center">
        <div className="absolute inset-0 pattern-diamond opacity-20" />
        <div className="max-w-4xl mx-auto relative z-10 space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-royal-500/20 border border-royal-400/30 text-royal-300 text-xs font-bold uppercase tracking-widest"
          >
            <Crown size={15} /> Royal Support & Concierge
          </motion.div>
          <h1 className="text-4xl sm:text-6xl font-display font-black text-royal-100 uppercase tracking-wider">
            Contact SafaKing
          </h1>
          <p className="text-royal-200/70 text-sm max-w-xl mx-auto leading-relaxed">
            Have questions about wedding safas, artist dispatches, custom orders, or supplier partnerships? Our royal support team is here to assist you 7 days a week.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Contact Cards */}
          <div className="space-y-6">
            <div className="p-8 rounded-3xl bg-white border border-royal-200/80 shadow-lg space-y-6">
              <h3 className="font-display font-bold text-xl text-maroon-950">Get in Touch</h3>

              <div className="space-y-5 text-xs font-medium">
                <a
                  href={telHref}
                  className="flex items-start gap-4 p-3.5 rounded-2xl hover:bg-amber-50/60 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-royal-100 text-maroon-950 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-maroon-950 text-sm">Phone / WhatsApp</p>
                    <p className="text-gray-600 mt-0.5">{BUSINESS.phone} · {BUSINESS.phoneAlt}</p>
                    <p className="text-[10px] text-emerald-700 font-bold mt-1">Instant WhatsApp Support</p>
                  </div>
                </a>

                <a
                  href={mailtoHref}
                  className="flex items-start gap-4 p-3.5 rounded-2xl hover:bg-amber-50/60 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-royal-100 text-maroon-950 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Mail size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-maroon-950 text-sm">Email Support</p>
                    <p className="text-gray-600 mt-0.5">{BUSINESS.email}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Response within 2 hours</p>
                  </div>
                </a>

                <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-royal-50/50 border border-royal-200/50">
                  <div className="w-10 h-10 rounded-xl bg-royal-100 text-maroon-950 flex items-center justify-center shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-maroon-950 text-sm">Flagship Royal Studio</p>
                    <p className="text-gray-600 mt-0.5 leading-relaxed">
                      {BUSINESS.address}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/50">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-amber-950 text-sm">Studio Hours</p>
                    <p className="text-gray-600 mt-0.5">Monday – Sunday: 10:00 AM – 8:30 PM</p>
                  </div>
                </div>
              </div>

              {/* Direct WhatsApp Action Button */}
              <a
                href={getWhatsAppClickLink(BUSINESS.phoneDigits, whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <MessageCircle size={18} /> Chat on WhatsApp Now
              </a>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-2">
            <div className="p-8 sm:p-10 rounded-3xl bg-white border border-royal-200/80 shadow-xl space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-royal-600">Send an Inquiry</span>
                <h2 className="text-2xl sm:text-4xl font-display font-black text-maroon-950 mt-1">
                  How Can We Help You Today?
                </h2>
              </div>

              {submitted ? (
                <div className="py-12 text-center space-y-4">
                  <CheckCircle2 size={56} className="text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="font-display font-bold text-2xl text-maroon-950">Inquiry Sent Successfully!</h3>
                  <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed">
                    Thank you for contacting SafaKing. Our concierge team will review your message and reply via phone or email shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <p className="text-xs leading-relaxed">{error}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        Full Name
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Vikram Singh"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-maroon-800/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        Phone / WhatsApp
                      </label>
                      <input
                        required
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-maroon-800/20 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        Email Address
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="e.g. vikram@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-maroon-800/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        Inquiry Type
                      </label>
                      <select
                        value={inquiryType}
                        onChange={(e) => setInquiryType(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-xs font-bold focus:ring-2 focus:ring-maroon-800/20 outline-none bg-white"
                      >
                        <option value="Wedding Safa Booking">Wedding Safa Booking</option>
                        <option value="Product Sale / Order Inquiry">Product Sale / Order Inquiry</option>
                        <option value="Artist Application">Artist Application</option>
                        <option value="Supplier / Wholesale Partnership">Supplier / Wholesale Partnership</option>
                        <option value="Academy Training Inquiry">Academy Training Inquiry</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Your Message / Details
                    </label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Please share event date, number of safas, city, or any specific style requirements..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-maroon-800/20 outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-2xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Sending Inquiry…
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Send Royal Inquiry
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <CartDrawer />
    </div>
  );
}
