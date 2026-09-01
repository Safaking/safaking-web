'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Mail, Lock, User, Phone, MapPin, Eye, EyeOff, AlertCircle,
  CheckCircle2, Loader2, MessageCircle, Wallet, Navigation, Briefcase,
  Users, IndianRupee, Link as LinkIcon, Camera, Sparkles, ScrollText,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, friendlyError, UserRole } from '@/lib/supabase';
import { getActiveContract, recordContractAcceptance, Contract } from '@/lib/client-update';

const SAFA_SPECIALTIES = [
  'Jodhpuri Silk Safa',
  'Barati Safa (Baraat)',
  'Royal Groom Turban',
  'Rajasthani Bandhani',
  'Pacharangi / Multi-color',
  'Mewari Rajwadi Style',
];

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const HOME_FOR_ROLE: Record<UserRole, string> = {
  admin: '/artist-portal',
  artist: '/artist-portal',
  customer: '/artist-portal/status',
};

function ArtistLoginContent() {
  const { user, role, signIn, signUp, refreshProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'login' | 'join'>(
    searchParams.get('tab') === 'join' ? 'join' : 'login'
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Join fields
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneAlt, setPhoneAlt] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [upiId, setUpiId] = useState('');
  const [city, setCity] = useState('');
  const [maxTravelKm, setMaxTravelKm] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState('');
  const [perSafaRate, setPerSafaRate] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [contractAccepted, setContractAccepted] = useState(false);

  useEffect(() => {
    getActiveContract('artist').then(setContract);
  }, []);

  // Already signed in with an application on file — send them straight to
  // their status page instead of letting them re-apply from scratch.
  useEffect(() => {
    if (!user) return;
    if (role === 'artist' || role === 'admin') {
      router.replace('/artist-portal');
      return;
    }
    supabase
      .from('artist_applications')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) router.replace('/artist-portal/status');
      });
  }, [user, role, router]);

  const toggleSpecialty = (item: string) => {
    setSpecialties((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  };

  const handlePhotoPick = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Photo is larger than 5 MB — please choose a smaller one.');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const message = await signIn(email.trim(), password);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    setNotice('Signed in — checking your artist status…');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phoneAlt.trim()) {
      setError('A second mobile number is required, in case your primary number is unreachable.');
      return;
    }
    if (contract && !contractAccepted) {
      setError('Please read and accept the artist agreement to continue.');
      return;
    }

    setBusy(true);

    let activeUserId = user?.id ?? null;

    if (!user) {
      const message = await signUp({
        email: joinEmail.trim(),
        password: joinPassword,
        fullName: fullName.trim(),
        phone: phone.trim(),
        city: city.trim() || undefined,
        role: 'customer',
      });

      if (message === 'CONFIRM_EMAIL') {
        setBusy(false);
        setNotice('Account created. Check your inbox and confirm your email, then sign in to finish applying.');
        setTab('login');
        return;
      }
      if (message) {
        setBusy(false);
        setError(message);
        return;
      }

      const { data } = await supabase.auth.getUser();
      activeUserId = data.user?.id ?? null;
    }

    if (!activeUserId) {
      setBusy(false);
      setError('Could not confirm your account — please try again.');
      return;
    }

    let photoUrl: string | null = null;
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${activeUserId}/application-photo-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('portfolio')
        .upload(path, photoFile, { contentType: photoFile.type });

      if (uploadErr) {
        setBusy(false);
        setError(`Could not upload your photo: ${uploadErr.message}`);
        return;
      }
      photoUrl = supabase.storage.from('portfolio').getPublicUrl(path).data.publicUrl;
    }

    const { error: insertErr } = await supabase.from('artist_applications').insert({
      user_id: activeUserId,
      full_name: fullName.trim(),
      phone: phone.trim(),
      phone_alt: phoneAlt.trim(),
      whatsapp_number: whatsappNumber.trim() || phone.trim(),
      upi_id: upiId.trim() || null,
      city: city.trim(),
      max_travel_km: Number(maxTravelKm) || 50,
      experience_years: Number(experienceYears) || 1,
      specialties,
      team_size: Number(teamSize) || 1,
      per_safa_rate: Number(perSafaRate) || 50,
      portfolio_link: portfolioLink.trim() || null,
      photo_url: photoUrl,
      status: 'pending',
    });

    if (insertErr) {
      setBusy(false);
      setError(friendlyError(insertErr));
      return;
    }

    if (contract) {
      try {
        await recordContractAcceptance({ contractId: contract.id, userId: activeUserId });
      } catch (err) {
        console.warn('Could not record contract acceptance:', err);
      }
    }

    await refreshProfile();
    setBusy(false);
    router.push('/artist-portal/status');
  };

  const inputClass =
    'w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-royal-200 bg-royal-50/30 text-maroon-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-400 transition-all';
  const iconClass = 'absolute left-3.5 top-1/2 -translate-y-1/2 text-maroon-800/40';

  return (
    <div className="min-h-screen bg-royal-50 text-maroon-950 flex flex-col lg:flex-row">
      {/* Left — branding panel, full height on desktop */}
      <div className="relative lg:w-[42%] shrink-0 overflow-hidden flex flex-col items-center justify-center py-12 lg:py-0 px-8 bg-white border-b lg:border-b-0 lg:border-r border-royal-200/60">
        <div className="absolute inset-0 pattern-diamond opacity-[0.04]" />
        <div className="relative z-10 text-center max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2 mb-10 text-maroon-700 hover:text-maroon-900">
            <div className="w-6 h-6 shrink-0">
              <Image src="/logo.png" alt="SafaKing" width={24} height={24} className="w-full h-full object-contain" />
            </div>
            <span className="font-display font-black tracking-widest uppercase text-sm">SafaKing</span>
          </Link>

          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="w-20 h-20 mx-auto mb-5"
          >
            <Image src="/logo.png" alt="SafaKing" width={80} height={80} className="w-full h-full object-contain drop-shadow-lg" priority />
          </motion.div>
          <h1 className="font-display font-black text-3xl text-maroon-900 tracking-wider uppercase">
            Artist Portal
          </h1>
          <p className="text-sm text-maroon-800/60 mt-3 leading-relaxed">
            Separate from your customer account — bookings, earnings &amp; check-ins live here.
          </p>
        </div>
      </div>

      {/* Right — form panel, fills the rest of the screen */}
      <div className="flex-1 flex flex-col bg-royal-50">
        <div className="max-w-xl w-full mx-auto px-6 sm:px-10 py-10 lg:py-16 flex-1">
          <div className="flex border border-royal-200 bg-white p-1 rounded-xl mb-6 shadow-sm">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                tab === 'login' ? 'bg-royal-500 text-maroon-950' : 'text-maroon-800/50 hover:text-maroon-800'
              }`}
            >
              Artist Login
            </button>
            <button
              onClick={() => setTab('join')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                tab === 'join' ? 'bg-royal-500 text-maroon-950' : 'text-maroon-800/50 hover:text-maroon-800'
              }`}
            >
              Join as Artist
            </button>
          </div>

          <div>
            {error && (
              <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{error}</p>
              </div>
            )}
            {notice && (
              <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{notice}</p>
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <Mail size={16} className={iconClass} />
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputClass} text-sm`}
                  />
                </div>
                <div className="relative">
                  <Lock size={16} className={iconClass} />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} text-sm pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-maroon-800/40 hover:text-maroon-800"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 bg-royal-500 hover:bg-royal-400 disabled:opacity-60 text-maroon-950 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {busy ? 'Signing In…' : 'Sign In'}
                </button>
                <p className="text-[11px] text-center text-maroon-800/50">
                  Not approved yet? Sign in anyway — you&apos;ll see your application status.
                </p>
              </form>
            ) : (
              <form onSubmit={handleJoin} className="space-y-4">
                {!user && (
                  <>
                    <div className="relative">
                      <Mail size={15} className={iconClass} />
                      <input
                        required
                        type="email"
                        placeholder="Email Address"
                        value={joinEmail}
                        onChange={(e) => setJoinEmail(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className="relative">
                      <Lock size={15} className={iconClass} />
                      <input
                        required
                        minLength={6}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a Password (min. 6 characters)"
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        className={`${inputClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-maroon-800/40 hover:text-maroon-800"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </>
                )}

                {/* Photo */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-maroon-800/60 mb-1.5">
                    Your Photo
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="w-16 h-16 rounded-2xl border-2 border-dashed border-royal-300 hover:border-maroon-400 flex items-center justify-center overflow-hidden shrink-0 bg-royal-50/30"
                    >
                      {photoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoPreview} alt="Your photo" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={20} className="text-maroon-800/40" />
                      )}
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handlePhotoPick(e.target.files?.[0])}
                    />
                    <p className="text-[11px] text-maroon-800/50">
                      A clear face photo — shown to our team, not published publicly.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <User size={15} className={iconClass} />
                    <input
                      required
                      type="text"
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="relative">
                    <MapPin size={15} className={iconClass} />
                    <input
                      required
                      type="text"
                      placeholder="Base City (e.g. Jaipur)"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Phone size={15} className={iconClass} />
                    <input
                      required
                      type="tel"
                      placeholder="Mobile Number 1 *"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="relative">
                    <Phone size={15} className={iconClass} />
                    <input
                      required
                      type="tel"
                      placeholder="Mobile Number 2 *"
                      value={phoneAlt}
                      onChange={(e) => setPhoneAlt(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-maroon-800/40 -mt-2.5">
                  * Both numbers are required, in case one is unreachable on the wedding day.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <MessageCircle size={15} className={iconClass} />
                    <input
                      type="tel"
                      placeholder="WhatsApp Number (if different)"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="relative">
                    <Wallet size={15} className={iconClass} />
                    <input
                      type="text"
                      placeholder="UPI ID for payment"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Navigation size={15} className={iconClass} />
                    <input
                      required
                      type="number"
                      min={1}
                      placeholder="Max Travel Distance (km)"
                      value={maxTravelKm}
                      onChange={(e) => setMaxTravelKm(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="relative">
                    <Briefcase size={15} className={iconClass} />
                    <input
                      required
                      type="number"
                      min={0}
                      placeholder="Years of Experience"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-maroon-800/60 mb-1.5">
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
                            : 'bg-white border-royal-200 text-maroon-800/70 hover:border-royal-400'
                        }`}
                      >
                        <span>{item}</span>
                        {specialties.includes(item) && <Sparkles size={12} className="shrink-0 text-royal-300" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Users size={15} className={iconClass} />
                    <input
                      required
                      type="number"
                      min={1}
                      placeholder="Team Crew Size"
                      value={teamSize}
                      onChange={(e) => setTeamSize(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="relative">
                    <IndianRupee size={15} className={iconClass} />
                    <input
                      type="number"
                      placeholder="Expected Rate / Safa (₹)"
                      value={perSafaRate}
                      onChange={(e) => setPerSafaRate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="relative">
                  <LinkIcon size={15} className={iconClass} />
                  <input
                    type="url"
                    placeholder="Portfolio / Instagram Link (Optional)"
                    value={portfolioLink}
                    onChange={(e) => setPortfolioLink(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {contract && (
                  <div className="rounded-xl border border-royal-200 bg-white overflow-hidden">
                    <div className="px-3 py-2 bg-royal-50/60 border-b border-royal-200 flex items-center gap-1.5">
                      <ScrollText size={13} className="text-maroon-800/50" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-maroon-800/70">
                        {contract.title}
                      </p>
                    </div>
                    <p className="p-3 text-[11px] text-maroon-800/70 leading-relaxed max-h-28 overflow-y-auto custom-scrollbar">
                      {contract.body}
                    </p>
                    <label className="flex items-start gap-2 p-3 border-t border-royal-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contractAccepted}
                        onChange={(e) => setContractAccepted(e.target.checked)}
                        className="mt-0.5 accent-maroon-900"
                      />
                      <span className="text-[11px] text-maroon-800/80">
                        I have read and accept this agreement, including arriving on time, wearing a
                        helmet, carrying insurance, and never accepting payment directly from a
                        customer.
                      </span>
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 bg-royal-500 hover:bg-royal-400 disabled:opacity-60 text-maroon-950 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {busy ? 'Submitting…' : 'Submit Application'}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-[11px] text-maroon-800/40 mt-8">
            Looking to shop or book a rental instead?{' '}
            <Link href="/" className="font-bold text-maroon-700 hover:underline">
              Go to SafaKing
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ArtistLoginPage() {
  return (
    <Suspense fallback={null}>
      <ArtistLoginContent />
    </Suspense>
  );
}
