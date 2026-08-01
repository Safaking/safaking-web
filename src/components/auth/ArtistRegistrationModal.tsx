'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, User, Phone, MapPin, Briefcase, Users, IndianRupee, Link as LinkIcon,
  X, CheckCircle2, AlertCircle, Loader2, Sparkles
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface ArtistRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAFA_SPECIALTIES = [
  'Jodhpuri Silk Safa',
  'Barati Safa (Baraat)',
  'Royal Groom Turban',
  'Rajasthani Bandhani',
  'Pacharangi / Multi-color',
  'Mewari Rajwadi Style',
];

export function ArtistRegistrationModal({ isOpen, onClose }: ArtistRegistrationModalProps) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [experienceYears, setExperienceYears] = useState('5');
  const [specialties, setSpecialties] = useState<string[]>(['Jodhpuri Silk Safa', 'Royal Groom Turban']);
  const [teamSize, setTeamSize] = useState('1');
  const [perSafaRate, setPerSafaRate] = useState('50');
  const [portfolioLink, setPortfolioLink] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSpecialty = (item: string) => {
    setSpecialties((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: insertErr } = await supabase.from('artist_applications').insert({
      user_id: user?.id ?? null,
      full_name: fullName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      experience_years: Number(experienceYears) || 1,
      specialties,
      team_size: Number(teamSize) || 1,
      per_safa_rate: Number(perSafaRate) || 50,
      portfolio_link: portfolioLink.trim() || null,
      status: 'pending',
    });

    setSubmitting(false);

    // Never report success on a failed insert. A missing table used to be
    // swallowed here, which silently discarded every artist application.
    if (insertErr) {
      setError(friendlyError(insertErr));
      return;
    }

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 3500);
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-maroon-950/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg overflow-hidden bg-white rounded-3xl shadow-2xl border border-royal-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/20"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="relative bg-maroon-950 text-white p-8 text-center overflow-hidden">
            <div className="absolute inset-0 pattern-diamond opacity-20" />
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-12 h-12 rounded-full bg-royal-gradient mx-auto flex items-center justify-center mb-3 shadow-lg shadow-royal-500/20 relative z-10"
            >
              <Crown size={24} className="text-maroon-950" />
            </motion.div>
            <h3 className="font-display font-black text-2xl text-royal-100 tracking-wider uppercase relative z-10">
              Join as Safa Artist
            </h3>
            <p className="text-xs text-royal-200/60 mt-1 relative z-10">
              Receive high-paying wedding safa tying contracts across India
            </p>
          </div>

          {/* Body */}
          <div className="p-7">
            {submitted ? (
              <div className="py-12 text-center space-y-4">
                <CheckCircle2 size={56} className="text-emerald-500 mx-auto animate-bounce" />
                <h4 className="font-display font-bold text-2xl text-maroon-900">Application Submitted!</h4>
                <p className="text-xs text-gray-600 max-w-xs mx-auto leading-relaxed">
                  Thank you for applying to SafaKing&apos;s Master Artist Network. Our operations team will review your application and contact you shortly.
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="text"
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="tel"
                      placeholder="WhatsApp Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="text"
                      placeholder="Base City (e.g. Jaipur)"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                  <div className="relative">
                    <Briefcase size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="number"
                      min={0}
                      placeholder="Years of Experience"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                </div>

                {/* Specialties Selection */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Safa Tying Specialties
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SAFA_SPECIALTIES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleSpecialty(item)}
                        className={`p-2 rounded-xl text-left text-[11px] font-bold border transition-all flex items-center justify-between ${
                          specialties.includes(item)
                            ? 'bg-maroon-950 text-royal-300 border-maroon-950 shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span>{item}</span>
                        {specialties.includes(item) && <Sparkles size={12} className="text-royal-300 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="number"
                      min={1}
                      placeholder="Team Crew Size (e.g. 5)"
                      value={teamSize}
                      onChange={(e) => setTeamSize(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                  <div className="relative">
                    <IndianRupee size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      placeholder="Expected Rate / Safa (₹)"
                      value={perSafaRate}
                      onChange={(e) => setPerSafaRate(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                </div>

                <div className="relative">
                  <LinkIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    placeholder="Portfolio / Instagram Link (Optional)"
                    value={portfolioLink}
                    onChange={(e) => setPortfolioLink(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-1/3 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-2/3 py-3.5 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Submitting…
                      </>
                    ) : (
                      'Register as Artist'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
