'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Crown, Phone, Mail, MapPin, MessageCircle, Clock, ArrowLeft,
  Loader2, AlertCircle, CheckCircle2, Send,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getWhatsAppClickLink } from '@/lib/whatsapp';

/** Single source of truth for how to reach SafaKing. */
const CONTACT = {
  phone: '+91 90013 47143',
  phoneDigits: '919001347143',
  email: 'hello@safaking.com',
  address: 'MI Road, Jaipur, Rajasthan 302001',
  hours: 'Monday to Saturday, 10 AM – 8 PM',
};

const SUBJECTS = [
  'Booking a safa artist',
  'Renting safas for an event',
  'Buying safas',
  'Training / Academy',
  'Becoming a supplier',
  'Something else',
];

export default function ContactPage() {
  const { user, profile } = useAuth();

  const [form, setForm] = useState({
    fullName: '', phone: '', email: '', subject: SUBJECTS[0], message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.full_name) setForm((f) => ({ ...f, fullName: f.fullName || profile.full_name }));
    if (profile?.phone) setForm((f) => ({ ...f, phone: f.phone || profile.phone! }));
    if (user?.email) setForm((f) => ({ ...f, email: f.email || user.email! }));
  }, [profile, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.message.trim().length < 10) {
      setError('Please tell us a little more so we can help properly.');
      return;
    }

    setSending(true);

    const { error: insertErr } = await supabase.from('contact_messages').insert({
      user_id: user?.id ?? null,
      full_name: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      subject: form.subject,
      message: form.message.trim(),
    });

    setSending(false);

    // Never claim a message was sent when it was not. A contact form that
    // swallows failures is worse than no form at all.
    if (insertErr) {
      setError(friendlyError(insertErr));
      return;
    }

    setSent(true);
    setForm((f) => ({ ...f, message: '' }));
  };

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-2 text-royal-200/70 hover:text-royal-300">
            <ArrowLeft size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Home</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
                Contact Us
              </h1>
              <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                We reply the same day
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-royal-gradient flex items-center justify-center">
              <Crown size={20} className="text-maroon-950" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid lg:grid-cols-5 gap-6">
        {/* ---- Reach us directly ---- */}
        <aside className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
            <h2 className="font-display font-bold text-lg text-maroon-950 mb-1">
              Talk to us directly
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              For a wedding this week, calling is fastest.
            </p>

            <div className="space-y-3">
              <a
                href={getWhatsAppClickLink(
                  CONTACT.phoneDigits,
                  'Namaste SafaKing, I would like to enquire about'
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <MessageCircle size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black uppercase tracking-wider text-emerald-800">
                    WhatsApp
                  </span>
                  <span className="block text-sm font-bold text-maroon-950">{CONTACT.phone}</span>
                </span>
              </a>

              <a
                href={`tel:+${CONTACT.phoneDigits}`}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 hover:bg-amber-100/60 transition-colors"
              >
                <span className="w-10 h-10 rounded-xl bg-maroon-950 text-royal-300 flex items-center justify-center shrink-0">
                  <Phone size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black uppercase tracking-wider text-gray-500">
                    Call
                  </span>
                  <span className="block text-sm font-bold text-maroon-950">{CONTACT.phone}</span>
                </span>
              </a>

              <a
                href={`mailto:${CONTACT.email}`}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 hover:bg-amber-100/60 transition-colors"
              >
                <span className="w-10 h-10 rounded-xl bg-royal-100 text-royal-800 flex items-center justify-center shrink-0">
                  <Mail size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black uppercase tracking-wider text-gray-500">
                    Email
                  </span>
                  <span className="block text-sm font-bold text-maroon-950 truncate">
                    {CONTACT.email}
                  </span>
                </span>
              </a>
            </div>

            <div className="mt-5 pt-5 border-t border-amber-100 space-y-3 text-xs text-gray-600">
              <p className="flex items-start gap-2">
                <MapPin size={14} className="text-amber-600 shrink-0 mt-0.5" />
                {CONTACT.address}
              </p>
              <p className="flex items-start gap-2">
                <Clock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                {CONTACT.hours}
              </p>
            </div>
          </div>

          <div className="bg-maroon-950 rounded-3xl p-6 text-royal-100">
            <p className="text-xs font-black uppercase tracking-widest text-royal-300 mb-2">
              Looking for a price?
            </p>
            <p className="text-xs text-royal-200/70 leading-relaxed mb-4">
              You can get an instant quotation without waiting for us — tell us your city, date and
              guest count.
            </p>
            <Link
              href="/plan"
              className="inline-block px-5 py-2.5 bg-royal-500 hover:bg-royal-400 text-maroon-950 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-colors"
            >
              Plan my event →
            </Link>
          </div>
        </aside>

        {/* ---- Message form ---- */}
        <section className="lg:col-span-3">
          <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 sm:p-8">
            <h2 className="font-display font-bold text-lg text-maroon-950 mb-1">
              Send us a message
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              Fill this in and our team will get back to you.
            </p>

            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center space-y-3"
              >
                <CheckCircle2 size={56} className="text-emerald-500 mx-auto" />
                <h3 className="font-display font-black text-xl text-maroon-900">
                  Message received
                </h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                  Our team has your message and will reply on {form.phone || 'the number you gave'}.
                  For anything urgent, WhatsApp us instead.
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-2 px-5 py-2.5 bg-maroon-950 hover:bg-maroon-900 text-royal-300 text-[11px] font-bold uppercase tracking-wider rounded-xl"
                >
                  Send another
                </button>
              </motion.div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed">{error}</p>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Your name
                    </label>
                    <input
                      required
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Phone / WhatsApp
                    </label>
                    <input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Email <span className="font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      What is it about?
                    </label>
                    <select
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20 bg-white"
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Message
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Tell us your event date, city and how many safas you need — it helps us answer properly the first time."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none outline-none focus:ring-2 focus:ring-maroon-800/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-4 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {sending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Send size={15} /> Send message
                    </>
                  )}
                </button>

                <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                  We use your number only to reply to this enquiry.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
