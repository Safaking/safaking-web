'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, CheckCircle2, Phone, AlertCircle, Loader2 } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { supabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function TrainingSection() {
  const { user } = useAuth();
  const [enrolled, setEnrolled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [center, setCenter] = useState('jaipur');
  const [gender, setGender] = useState('');
  const [qualification, setQualification] = useState('');
  const [currentOccupation, setCurrentOccupation] = useState('');
  const [wantsToJoinPlatform, setWantsToJoinPlatform] = useState(true);
  const [nearestHqCity, setNearestHqCity] = useState('');

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: insertErr } = await supabase.from('academy_enrollments').insert({
      user_id: user?.id ?? null,
      full_name: fullName.trim(),
      phone: phone.trim(),
      city: city.trim() || null,
      center,
      gender: gender || null,
      qualification: qualification.trim() || null,
      current_occupation: currentOccupation.trim() || null,
      wants_to_join_platform: wantsToJoinPlatform,
      nearest_hq_city: nearestHqCity.trim() || null,
      status: 'pending',
    });

    setSubmitting(false);

    if (insertErr) {
      setError(friendlyError(insertErr));
      return;
    }

    setFullName('');
    setPhone('');
    setCity('');
    setGender('');
    setQualification('');
    setCurrentOccupation('');
    setNearestHqCity('');
    setEnrolled(true);
    setTimeout(() => setEnrolled(false), 5000);
  };

  return (
    <section id="training" className="relative py-28 px-4 sm:px-6 lg:px-8 bg-maroon-950 text-white overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.12, 0.05] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-royal-500/10 rounded-full blur-3xl"
        />
        <div className="absolute inset-0 pattern-diamond opacity-15" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Header */}
        <AnimatedSection className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-royal-500/15 border border-royal-400/30 text-royal-300 text-xs font-bold uppercase tracking-widest mb-5"
          >
            <GraduationCap size={14} /> SafaKing Academy
          </motion.span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-black text-royal-50 mb-5">
            Safa Artist{' '}
            <span className="text-gradient-gold italic">Training</span> Facilities
          </h2>
          <p className="text-royal-100/55 max-w-2xl mx-auto text-base leading-relaxed">
            Learn the sacred art of safa tying from heritage masters at our training centers in Jaipur and Delhi.
          </p>
        </AnimatedSection>

        {/* Main content — photo gallery left + enroll form right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Left — photo collage */}
          <AnimatedSection>
            {/* Photo collage — 3 images */}
            <div className="grid grid-cols-2 gap-3">
              {/* Big image — teaching scene */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="col-span-2 relative aspect-[16/9] rounded-3xl overflow-hidden border border-royal-400/20 shadow-2xl shadow-black/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/training-artist-teaching.jpg"
                  alt="Master artist tying safa on student"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-maroon-950/60 to-transparent" />
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="absolute bottom-4 left-4 glass-dark rounded-xl px-4 py-2.5 border border-royal-400/20"
                >
                  <p className="text-xl font-display font-black text-royal-300">240+</p>
                  <p className="text-[10px] text-royal-200/60 font-bold uppercase tracking-wider">Artists Trained</p>
                </motion.div>
              </motion.div>

              {/* Bottom left — hands closeup */}
              <motion.div
                whileHover={{ scale: 1.03 }}
                className="relative aspect-square rounded-2xl overflow-hidden border border-royal-400/15 shadow-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/training-closeup-hands.jpg"
                  alt="Expert hands placing kalgi on safa"
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-maroon-950/50 to-transparent" />
              </motion.div>

              {/* Bottom right — group class */}
              <motion.div
                whileHover={{ scale: 1.03 }}
                className="relative aspect-square rounded-2xl overflow-hidden border border-royal-400/15 shadow-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/training-class-students.jpg"
                  alt="Group safa training class"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-maroon-950/50 to-transparent" />
              </motion.div>
            </div>
          </AnimatedSection>

          {/* Right — what you learn + enroll form */}
          <AnimatedSection>

            {/* Enroll form */}
            <AnimatePresence mode="wait">
              {enrolled ? (
                <motion.div
                  key="success"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  className="flex flex-col items-center py-14 text-center glass-dark rounded-3xl border border-royal-400/20"
                >
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.6 }}
                  >
                    <CheckCircle2 size={64} className="text-green-400 mb-4" />
                  </motion.div>
                  <h4 className="text-2xl font-display font-bold text-royal-50">Enrollment Request Sent!</h4>
                  <p className="text-sm text-royal-200/55 mt-2">We&apos;ll share batch schedule and fees shortly.</p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleEnroll}
                  className="glass-dark rounded-3xl border border-royal-400/20 p-7 space-y-4 shadow-2xl"
                >
                  <div className="text-center mb-2">
                    <GraduationCap size={30} className="text-royal-400 mx-auto mb-3" />
                    <h4 className="font-display font-bold text-2xl text-royal-50">Enroll in SafaKing Academy</h4>
                    <p className="text-xs text-royal-200/50 mt-1">Join 240+ trained safa artists across India</p>
                  </div>

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
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/5 text-white placeholder:text-royal-200/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                    />
                    <input
                      required
                      type="tel"
                      placeholder="Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/5 text-white placeholder:text-royal-200/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Your City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/5 text-white placeholder:text-royal-200/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="" className="text-maroon-900 bg-white">Gender (optional)</option>
                      <option value="male" className="text-maroon-900 bg-white">Male</option>
                      <option value="female" className="text-maroon-900 bg-white">Female</option>
                      <option value="other" className="text-maroon-900 bg-white">Other</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Qualification"
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/5 text-white placeholder:text-royal-200/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="What do you currently do?"
                    value={currentOccupation}
                    onChange={(e) => setCurrentOccupation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/5 text-white placeholder:text-royal-200/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                  />

                  <select
                    className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                    value={center}
                    onChange={(e) => setCenter(e.target.value)}
                  >
                    <option value="jaipur" className="text-maroon-900 bg-white">Jaipur — Chomu House</option>
                    <option value="delhi" className="text-maroon-900 bg-white">Delhi — Karol Bagh</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Nearest city to our HQ, if not Jaipur/Delhi"
                    value={nearestHqCity}
                    onChange={(e) => setNearestHqCity(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-royal-400/20 bg-white/5 text-white placeholder:text-royal-200/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                  />

                  <label className="flex items-start gap-2 px-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wantsToJoinPlatform}
                      onChange={(e) => setWantsToJoinPlatform(e.target.checked)}
                      className="mt-0.5 accent-royal-400"
                    />
                    <span className="text-xs text-royal-100/80">
                      After training, I would like to work as a Safa Artist with SafaKing.
                    </span>
                  </label>

                  <motion.button
                    whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-royal-500 hover:bg-royal-400 disabled:opacity-60 disabled:cursor-not-allowed text-maroon-950 font-bold py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Submitting…
                      </>
                    ) : (
                      <>
                        <Phone size={15} /> Request Enrollment
                      </>
                    )}
                  </motion.button>
                  <p className="text-[10px] text-center text-royal-200/40">
                    Free counselling call · No advance required
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
