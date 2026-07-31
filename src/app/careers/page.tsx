'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, MapPin, Clock, Users, Briefcase, Heart,
  GraduationCap, Star, ChevronDown, ChevronUp,
  ArrowUpRight, CheckCircle2, Sparkles, Phone, Mail, AlertCircle, Loader2,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/* ── Job Listings ── */
const JOBS = [
  {
    id: 'job-01',
    title: 'Master Safa Artist',
    department: 'Artist Network',
    location: 'Jaipur / Delhi / Mumbai',
    type: 'Full-time',
    experience: '2+ years',
    salary: '₹25,000 – ₹50,000/month',
    icon: Crown,
    color: 'bg-royal-100 text-royal-700',
    highlight: true,
    desc: 'Join our elite network of safa artists and travel across India to tie safas at premium weddings and events. Work with top grooms, receive premium bookings, and grow your career.',
    responsibilities: [
      'Tie safas at client weddings & events across India',
      'Style Jodhpuri, Rounded & Barati safa variations',
      'Place kalgi, brooch & accessory elements',
      'Coordinate with wedding planners & event teams',
      'Maintain high client satisfaction standards',
    ],
    requirements: [
      'Minimum 2 years of safa tying experience',
      'Proficiency in 2+ safa styles',
      'Willingness to travel for events',
      'Good communication with clients',
      'SafaKing training certification (preferred)',
    ],
  },
  {
    id: 'job-02',
    title: 'Safa Tying Trainer',
    department: 'SafaKing Academy',
    location: 'Jaipur / Delhi',
    type: 'Full-time',
    experience: '4+ years',
    salary: '₹30,000 – ₹55,000/month',
    icon: GraduationCap,
    color: 'bg-amber-100 text-amber-700',
    highlight: false,
    desc: 'Teach the next generation of safa artists at SafaKing Academy. Conduct hands-on training sessions, demonstrate regional tying styles, and certify new artists.',
    responsibilities: [
      'Conduct daily safa tying training sessions',
      'Demonstrate all 3 signature styles',
      'Evaluate and certify student performance',
      'Maintain training materials and curriculum',
      'Report batch progress to academy head',
    ],
    requirements: [
      '4+ years of professional safa tying',
      'Previous teaching or mentoring experience',
      'Strong knowledge of regional safa styles',
      'Patient and effective communication',
      'Available for both Jaipur & Delhi centers',
    ],
  },
  {
    id: 'job-03',
    title: 'Sales & Supplier Coordinator',
    department: 'Business Development',
    location: 'Jaipur (On-site)',
    type: 'Full-time',
    experience: '1+ year',
    salary: '₹18,000 – ₹30,000/month',
    icon: Briefcase,
    color: 'bg-emerald-100 text-emerald-700',
    highlight: false,
    desc: 'Handle B2B supplier relationships, onboard new fabric suppliers, and manage wholesale safa orders. Ideal for someone with a background in textile sales.',
    responsibilities: [
      'Onboard and manage safa fabric suppliers',
      'Handle wholesale enquiries and orders',
      'Coordinate between suppliers and warehouse',
      'Maintain supplier database and pricing',
      'Negotiate fabric rates and delivery terms',
    ],
    requirements: [
      '1+ year in sales or textile industry',
      'Strong negotiation & communication skills',
      'Proficiency in MS Excel / Google Sheets',
      'Knowledge of Rajasthani/Indian fabric market',
      'Hindi & English communication',
    ],
  },
  {
    id: 'job-04',
    title: 'Social Media & Content Creator',
    department: 'Marketing',
    location: 'Remote / Jaipur',
    type: 'Full-time / Part-time',
    experience: 'Fresher welcome',
    salary: '₹12,000 – ₹22,000/month',
    icon: Star,
    color: 'bg-pink-100 text-pink-700',
    highlight: false,
    desc: 'Create stunning Reels, posts, and content showcasing SafaKing safas, artists, and training. Help us grow our social presence and attract grooms across India.',
    responsibilities: [
      'Create Instagram & YouTube video content',
      'Shoot behind-the-scenes safa tying videos',
      'Write product captions and campaign copy',
      'Manage daily posting schedule',
      'Track engagement metrics and report',
    ],
    requirements: [
      'Portfolio of social media content',
      'Experience with Reels / short video editing',
      'Eye for Indian wedding aesthetics',
      'Basic Canva / CapCut / Adobe skills',
      'Passion for Indian culture & fashion',
    ],
  },
];

const PERKS = [
  { icon: Crown,         title: 'Premium Brand',       desc: 'Work with India\'s top safa house' },
  { icon: MapPin,        title: 'Travel India',         desc: 'Artists travel to top wedding venues' },
  { icon: GraduationCap, title: 'Free Training',        desc: 'Academy courses at no cost' },
  { icon: Heart,         title: 'Growth Path',          desc: 'Clear career progression' },
  { icon: Users,         title: 'Great Team',           desc: 'Heritage-trained colleagues' },
  { icon: Sparkles,      title: 'Premium Weddings',     desc: 'Work at elite events' },
];

/* ── Component ── */
const EMPTY_APPLICATION = {
  fullName: '',
  phone: '',
  email: '',
  city: '',
  experience: '',
  message: '',
};

export default function CareersPage() {
  const { user } = useAuth();
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_APPLICATION);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = (key: keyof typeof EMPTY_APPLICATION) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const handleApply = async (e: React.FormEvent, jobId: string) => {
    e.preventDefault();
    const job = JOBS.find((j) => j.id === jobId);
    if (!job) return;

    setError(null);
    setSubmitting(true);

    const { error: insertErr } = await supabase.from('job_applications').insert({
      user_id: user?.id ?? null,
      job_id: job.id,
      job_title: job.title,
      full_name: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: form.city.trim() || null,
      experience: form.experience.trim() || null,
      message: form.message.trim() || null,
      status: 'pending',
    });

    setSubmitting(false);

    if (insertErr) {
      setError(friendlyError(insertErr));
      return;
    }

    setForm(EMPTY_APPLICATION);
    setSubmitted(jobId);
    setApplying(null);
    setTimeout(() => setSubmitted(null), 6000);
  };

  const closeApplyModal = () => {
    setApplying(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950 font-sans">

      {/* Top Banner */}
      <div className="bg-maroon-800 text-amber-200 text-xs font-bold tracking-widest text-center py-2.5 px-4 flex justify-center items-center gap-2">
        <Sparkles size={12} className="animate-pulse text-amber-300" />
        <span>SAFAKING • WE&apos;RE HIRING • JOIN INDIA&apos;S PREMIER SAFA HOUSE</span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-950/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-maroon-800 text-amber-300 flex items-center justify-center shadow-md">
                <Crown size={20} />
              </div>
              <div>
                <p className="font-black text-maroon-800 text-xl tracking-widest uppercase leading-none">SafaKing</p>
                <p className="text-[9px] font-bold tracking-[0.3em] text-amber-800 uppercase">Royal Turban House</p>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-8 text-xs font-bold tracking-widest text-maroon-700 uppercase">
              <Link href="/" className="hover:text-maroon-900 transition-colors">Home</Link>
              <Link href="/shop" className="hover:text-maroon-900 transition-colors">Shop</Link>
              <Link href="/#artists" className="hover:text-maroon-900 transition-colors">Artists</Link>
              <span className="text-maroon-800 border-b-2 border-maroon-800 pb-0.5">Careers</span>
            </nav>
            <motion.a
              href="#openings"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="bg-maroon-800 hover:bg-maroon-900 text-amber-200 text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-full transition-colors shadow-md flex items-center gap-2"
            >
              View Openings <ArrowUpRight size={13} />
            </motion.a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-maroon-950 text-white py-28 px-4">
        {/* BG decorations */}
        <div className="absolute inset-0 pattern-diamond opacity-20 pointer-events-none" />
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 9, repeat: Infinity }}
          className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-royal-500/15 rounded-full blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 12, repeat: Infinity }}
          className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-amber-400/10 rounded-full blur-3xl pointer-events-none"
        />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-royal-500/15 border border-royal-400/30 text-royal-300 text-xs font-bold uppercase tracking-widest mb-8"
          >
            <Briefcase size={13} /> We&apos;re Hiring
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-display font-black leading-tight mb-6"
          >
            Build Your Career at
            <br />
            <span className="text-gradient-gold italic">SafaKing</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-royal-100/65 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-10"
          >
            Join India&apos;s premier royal safa house — whether you&apos;re a master artist, a trainer,
            or a creative — there&apos;s a place for you here.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <motion.a
              href="#openings"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="bg-royal-500 hover:bg-royal-400 text-maroon-950 font-bold px-8 py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 transition-colors"
            >
              See Open Positions <ArrowUpRight size={15} />
            </motion.a>
            <motion.a
              href="#perks"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="border-2 border-royal-400/40 hover:border-royal-300 text-royal-100 font-bold px-8 py-4 rounded-2xl text-xs uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-royal-500/10"
            >
              Why SafaKing?
            </motion.a>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-16 grid grid-cols-3 gap-8 max-w-sm mx-auto"
          >
            {[{ v: '4', l: 'Open Roles' }, { v: '240+', l: 'Team Members' }, { v: '10K+', l: 'Weddings Served' }].map((s) => (
              <div key={s.l} className="text-center">
                <p className="text-2xl font-display font-black text-royal-300">{s.v}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-royal-200/40 mt-0.5">{s.l}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Perks */}
      <section id="perks" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-amber-100">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-royal-700 mb-3 block">Why Join Us</span>
            <h2 className="text-3xl sm:text-4xl font-display font-black text-maroon-900">
              Perks of Working at <span className="text-gradient-gold italic">SafaKing</span>
            </h2>
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            {PERKS.map((perk, i) => (
              <motion.div
                key={perk.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -6, scale: 1.04 }}
                className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-[#FDF6EC] border border-amber-200/60 hover:border-royal-300 hover:shadow-lg transition-all cursor-default"
              >
                <div className="w-12 h-12 rounded-2xl bg-maroon-100 flex items-center justify-center">
                  <perk.icon size={22} className="text-maroon-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-maroon-900">{perk.title}</p>
                  <p className="text-[10px] text-maroon-800/50 mt-0.5 leading-snug">{perk.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Job Listings */}
      <section id="openings" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#FDF6EC]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-royal-700 mb-3 block">Open Positions</span>
            <h2 className="text-3xl sm:text-4xl font-display font-black text-maroon-900">
              Find Your Role
            </h2>
            <p className="text-sm text-maroon-800/50 mt-2 max-w-md mx-auto">
              {JOBS.length} positions open across Artist Network, Academy, Sales & Marketing
            </p>
          </motion.div>

          <div className="space-y-4">
            {JOBS.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-3xl border-2 overflow-hidden transition-all duration-300 bg-white shadow-sm ${
                  openJob === job.id ? 'border-royal-400 shadow-xl shadow-royal-200/40' : 'border-amber-200/60 hover:border-royal-300 hover:shadow-md'
                }`}
              >
                {/* Job header row */}
                <button
                  onClick={() => setOpenJob(openJob === job.id ? null : job.id)}
                  className="w-full text-left p-6 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${job.color} flex items-center justify-center shrink-0 shadow-sm`}>
                      <job.icon size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-bold text-lg text-maroon-900">{job.title}</h3>
                        {job.highlight && (
                          <span className="text-[9px] font-black uppercase tracking-wider bg-royal-500 text-maroon-950 px-2.5 py-0.5 rounded-full">
                            Hiring Fast
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-maroon-800/60 font-medium">
                          <Briefcase size={11} /> {job.department}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-maroon-800/60 font-medium">
                          <MapPin size={11} /> {job.location}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-maroon-800/60 font-medium">
                          <Clock size={11} /> {job.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden sm:block text-xs font-bold text-royal-700 bg-royal-100 px-3 py-1.5 rounded-full border border-royal-200">
                      {job.salary}
                    </span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      openJob === job.id ? 'bg-royal-500 text-maroon-950' : 'bg-amber-100 text-maroon-700'
                    }`}>
                      {openJob === job.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                <AnimatePresence>
                  {openJob === job.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-8 border-t border-amber-100 pt-6">
                        <p className="text-sm text-maroon-800/65 leading-relaxed mb-7">{job.desc}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-maroon-700 mb-3">Responsibilities</h4>
                            <ul className="space-y-2">
                              {job.responsibilities.map((r) => (
                                <li key={r} className="flex items-start gap-2.5 text-xs text-maroon-800/70">
                                  <CheckCircle2 size={13} className="text-royal-500 shrink-0 mt-0.5" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-maroon-700 mb-3">Requirements</h4>
                            <ul className="space-y-2">
                              {job.requirements.map((r) => (
                                <li key={r} className="flex items-start gap-2.5 text-xs text-maroon-800/70">
                                  <CheckCircle2 size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <div className="text-xs text-maroon-800/50 font-medium">
                            Experience: <span className="font-bold text-maroon-800">{job.experience}</span>
                          </div>
                          <div className="sm:ml-auto">
                            <motion.button
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setApplying(job.id)}
                              className="bg-maroon-800 hover:bg-maroon-900 text-amber-100 text-xs font-bold uppercase tracking-widest px-7 py-3 rounded-2xl shadow-lg flex items-center gap-2 transition-colors"
                            >
                              Apply for This Role <ArrowUpRight size={13} />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Modal */}
      <AnimatePresence>
        {applying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-maroon-950/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeApplyModal}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="bg-maroon-950 px-8 py-6 relative">
                <div className="absolute inset-0 pattern-diamond opacity-20" />
                <div className="relative">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-royal-400 mb-1">Apply for</p>
                  <h3 className="text-xl font-display font-black text-white">
                    {JOBS.find((j) => j.id === applying)?.title}
                  </h3>
                  <p className="text-xs text-royal-200/55 mt-0.5">
                    {JOBS.find((j) => j.id === applying)?.department} · {JOBS.find((j) => j.id === applying)?.location}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={(e) => handleApply(e, applying)} className="p-8 space-y-4">
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed">{error}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <input
                    required
                    type="text"
                    placeholder="Full Name"
                    {...field('fullName')}
                    className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-[#FDF6EC] text-maroon-900 placeholder:text-maroon-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                  />
                  <input
                    required
                    type="tel"
                    placeholder="Phone Number"
                    {...field('phone')}
                    className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-[#FDF6EC] text-maroon-900 placeholder:text-maroon-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                  />
                </div>
                <input
                  required
                  type="email"
                  placeholder="Email Address"
                  {...field('email')}
                  className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-[#FDF6EC] text-maroon-900 placeholder:text-maroon-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                />
                <input
                  type="text"
                  placeholder="Your City"
                  {...field('city')}
                  className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-[#FDF6EC] text-maroon-900 placeholder:text-maroon-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                />
                <input
                  type="text"
                  placeholder="Years of Experience"
                  {...field('experience')}
                  className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-[#FDF6EC] text-maroon-900 placeholder:text-maroon-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all"
                />
                <textarea
                  rows={3}
                  placeholder="Tell us about yourself and why you want to join SafaKing..."
                  {...field('message')}
                  className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-[#FDF6EC] text-maroon-900 placeholder:text-maroon-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-royal-400/30 transition-all resize-none"
                />
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeApplyModal}
                    className="flex-1 border-2 border-amber-200 text-maroon-700 text-xs font-bold uppercase tracking-wider py-3.5 rounded-xl hover:bg-amber-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-maroon-800 hover:bg-maroon-900 disabled:opacity-60 disabled:cursor-not-allowed text-amber-100 text-xs font-bold uppercase tracking-wider py-3.5 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Submitting…
                      </>
                    ) : (
                      'Submit Application'
                    )}
                  </motion.button>
                </div>
                <p className="text-[10px] text-center text-maroon-800/35">
                  We&apos;ll contact you within 2 business days · No spam
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.85 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-maroon-900 text-white rounded-2xl px-7 py-4 shadow-2xl flex items-center gap-4 border border-royal-400/30"
          >
            <CheckCircle2 size={24} className="text-green-400 shrink-0" />
            <div>
              <p className="font-bold text-sm">Application Submitted!</p>
              <p className="text-xs text-royal-200/60 mt-0.5">We&apos;ll call you within 2 business days.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA — General Application */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-maroon-950 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 pattern-diamond opacity-20" />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.18, 0.08] }}
          transition={{ duration: 9, repeat: Infinity }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-[600px] h-[600px] bg-royal-500/15 rounded-full blur-3xl" />
        </motion.div>
        <div className="max-w-2xl mx-auto relative z-10">
          <GraduationCap size={40} className="text-royal-400 mx-auto mb-5" />
          <h2 className="text-3xl sm:text-4xl font-display font-black mb-4">
            Don&apos;t See Your Role?
          </h2>
          <p className="text-royal-100/55 text-sm leading-relaxed mb-8">
            We&apos;re always open to talented safa artists, trainers, and passionate team members.
            Send us your profile and we&apos;ll reach out when something opens up.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="tel:+911234567890"
              className="flex items-center gap-2 bg-royal-500 hover:bg-royal-400 text-maroon-950 font-bold px-7 py-3.5 rounded-2xl text-xs uppercase tracking-widest shadow-lg transition-colors"
            >
              <Phone size={14} /> Call Us
            </a>
            <a
              href="mailto:careers@safaking.com"
              className="flex items-center gap-2 border-2 border-royal-400/40 hover:border-royal-300 text-royal-100 font-bold px-7 py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all hover:bg-royal-500/10"
            >
              <Mail size={14} /> Email Resume
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-maroon-950 border-t border-royal-400/10 py-8 text-center text-xs text-royal-200/40">
        <p className="font-display font-bold text-royal-300 text-base uppercase tracking-widest mb-1">SafaKing</p>
        <p>© 2026 SafaKing Royal Turban House · All Rights Reserved</p>
        <Link href="/" className="text-royal-400 hover:text-royal-300 underline underline-offset-2 mt-2 inline-block transition-colors">
          ← Back to Home
        </Link>
      </footer>
    </div>
  );
}
