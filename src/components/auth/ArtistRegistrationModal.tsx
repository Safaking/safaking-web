'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, User, Phone, MapPin, Briefcase, Users, IndianRupee, Link as LinkIcon,
  X, CheckCircle2, AlertCircle, Loader2, Sparkles, MessageCircle, Wallet,
  Navigation, Camera, ScrollText,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getActiveContract, recordContractAcceptance, Contract } from '@/lib/client-update';

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

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function ArtistRegistrationModal({ isOpen, onClose }: ArtistRegistrationModalProps) {
  const { user } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) getActiveContract('artist').then(setContract);
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
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

    setSubmitting(true);

    // Photo is uploaded first: if it fails, the applicant knows before their
    // application text is lost, and they can retry without re-typing everything.
    let photoUrl: string | null = null;
    if (photoFile && user) {
      const ext = photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${user.id}/application-photo-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('portfolio')
        .upload(path, photoFile, { contentType: photoFile.type });

      if (uploadErr) {
        setSubmitting(false);
        setError(`Could not upload your photo: ${uploadErr.message}`);
        return;
      }
      photoUrl = supabase.storage.from('portfolio').getPublicUrl(path).data.publicUrl;
    }

    const { data: application, error: insertErr } = await supabase
      .from('artist_applications')
      .insert({
        user_id: user?.id ?? null,
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
      })
      .select('id')
      .single();

    // Never report success on a failed insert. A missing table used to be
    // swallowed here, which silently discarded every artist application.
    if (insertErr || !application) {
      setSubmitting(false);
      setError(friendlyError(insertErr));
      return;
    }

    if (contract) {
      try {
        await recordContractAcceptance({ contractId: contract.id, userId: user?.id ?? null });
      } catch (err) {
        // The application itself is already saved; a missing acceptance
        // record is a lesser problem than losing the whole submission, so we
        // surface it as a warning rather than failing the form.
        console.warn('Could not record contract acceptance:', err);
      }
    }

    setSubmitting(false);
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

                {/* Photo */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Your Photo <span className="text-rose-500">*</span>
                  </label>
                  {user ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-300 hover:border-maroon-400 flex items-center justify-center overflow-hidden shrink-0 bg-gray-50"
                      >
                        {photoPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photoPreview} alt="Your photo" className="w-full h-full object-cover" />
                        ) : (
                          <Camera size={20} className="text-gray-400" />
                        )}
                      </button>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => handlePhotoPick(e.target.files?.[0])}
                      />
                      <p className="text-[11px] text-gray-500">
                        A clear face photo — shown to our team, not published publicly.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                      Sign in first to attach a photo. You can still submit without one and add it later.
                    </p>
                  )}
                </div>

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
                </div>

                {/* Two required mobile numbers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="tel"
                      placeholder="Mobile Number 1 *"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="tel"
                      placeholder="Mobile Number 2 *"
                      value={phoneAlt}
                      onChange={(e) => setPhoneAlt(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 -mt-2.5">
                  * Both numbers are required, in case one is unreachable on the wedding day.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <MessageCircle size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="WhatsApp Number (if different)"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                  <div className="relative">
                    <Wallet size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="UPI ID for payment (e.g. name@upi)"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Navigation size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="number"
                      min={1}
                      placeholder="Max Travel Distance (km)"
                      value={maxTravelKm}
                      onChange={(e) => setMaxTravelKm(e.target.value)}
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
                  <div>
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
                    {Number(perSafaRate) > 0 && (
                      <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                        After SafaKing&apos;s 20% platform charge, you&apos;ll receive{' '}
                        <span className="font-bold text-emerald-700">
                          ₹{Math.round(Number(perSafaRate) * 0.8).toLocaleString()}
                        </span>{' '}
                        per safa.
                      </p>
                    )}
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

                {/* Contract */}
                {contract && (
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5">
                      <ScrollText size={13} className="text-gray-500" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        {contract.title}
                      </p>
                    </div>
                    <p className="p-3 text-[11px] text-gray-600 leading-relaxed max-h-28 overflow-y-auto custom-scrollbar">
                      {contract.body}
                    </p>
                    <label className="flex items-start gap-2 p-3 border-t border-gray-200 cursor-pointer bg-white">
                      <input
                        type="checkbox"
                        checked={contractAccepted}
                        onChange={(e) => setContractAccepted(e.target.checked)}
                        className="mt-0.5 accent-maroon-900"
                      />
                      <span className="text-[11px] text-gray-700">
                        I have read and accept this agreement, including arriving on time, wearing a
                        helmet, carrying insurance, and never accepting payment directly from a
                        customer.
                      </span>
                    </label>
                  </div>
                )}

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
