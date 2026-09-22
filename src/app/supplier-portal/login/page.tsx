'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail, Lock, User, Phone, MapPin, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2,
  Store, Hash, Landmark, Wallet, ScrollText, Crown, FileText,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, friendlyError } from '@/lib/supabase';
import {
  DEFAULT_SUPPLIER_RATES, INDIAN_STATES, SUPPLIER_CATEGORIES, SupplierRates, loadSupplierRates, supplierTerms,
} from '@/lib/supplier';

/** Kept while a new applicant confirms their email, so they do not type it all again. */
const DRAFT_KEY = 'safaking-supplier-application';

interface Draft {
  businessName: string;
  contactName: string;
  phone: string;
  category: string;
  city: string;
  stateName: string;
  pincode: string;
  shopAddress: string;
  gstNumber: string;
  upiId: string;
  bankHolder: string;
  bankIfsc: string;
  alsoArtist: boolean;
  message: string;
}

function readDraft(): Partial<Draft> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as Partial<Draft>;
  } catch {
    return {};
  }
}

function SupplierLoginContent() {
  const { user, role, signIn, signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<'login' | 'join'>(searchParams.get('tab') === 'join' ? 'join' : 'login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [alsoArtist, setAlsoArtist] = useState(false);
  const [message, setMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [rates, setRates] = useState<SupplierRates>(DEFAULT_SUPPLIER_RATES);

  useEffect(() => {
    loadSupplierRates().then(setRates);
    const draft = readDraft();
    if (draft.businessName) setBusinessName(draft.businessName);
    if (draft.contactName) setContactName(draft.contactName);
    if (draft.phone) setPhone(draft.phone);
    if (draft.category) setCategory(draft.category);
    if (draft.city) setCity(draft.city);
    if (draft.stateName) setStateName(draft.stateName);
    if (draft.pincode) setPincode(draft.pincode);
    if (draft.shopAddress) setShopAddress(draft.shopAddress);
    if (draft.gstNumber) setGstNumber(draft.gstNumber);
    if (draft.upiId) setUpiId(draft.upiId);
    if (draft.bankHolder) setBankHolder(draft.bankHolder);
    if (draft.bankIfsc) setBankIfsc(draft.bankIfsc);
    if (draft.alsoArtist) setAlsoArtist(true);
    if (draft.message) setMessage(draft.message);
  }, []);

  // Signed in already: an approved supplier goes to the portal, an applicant
  // to their status. Anyone else stays here to apply.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: supplier } = await supabase
        .from('supplier_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (supplier) {
        router.replace('/supplier-portal');
        return;
      }
      const { data: application } = await supabase
        .from('supplier_applications')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (application) {
        router.replace('/supplier-portal/status');
        return;
      }
      setTab('join');
    })();
    return () => {
      cancelled = true;
    };
  }, [user, router]);

  // One account does one job: an artist or staff login cannot also sell.
  const otherAccount = !!user && !!role && role !== 'customer';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const failure = await signIn(email.trim(), password);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setNotice('Signed in. Opening your supplier account…');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otherAccount) {
      setError(
        `You are signed in with ${role === 'artist' ? 'an artist' : 'a staff'} account. A supplier needs its own account: sign out, then apply with a different email.`
      );
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(pincode.trim())) {
      setError('Enter the 6-digit pincode your parcels will be sent from.');
      return;
    }
    if (gstNumber.trim() && !/^[0-9]{2}[A-Za-z0-9]{13}$/.test(gstNumber.trim())) {
      setError('A GSTIN is 15 characters and starts with two digits.');
      return;
    }
    if (bankIfsc.trim() && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(bankIfsc.trim())) {
      setError('That IFSC code does not look right. It has 11 characters, like SBIN0001234.');
      return;
    }
    if (!upiId.trim() && !(bankHolder.trim() && bankIfsc.trim())) {
      setError('Tell us where to pay you: a UPI ID, or the account holder name and IFSC.');
      return;
    }
    if (!termsAccepted) {
      setError('Please read and accept the supplier terms.');
      return;
    }

    setBusy(true);
    let userId = user?.id ?? null;
    let accountEmail = user?.email ?? null;

    if (!user) {
      const failure = await signUp({
        email: joinEmail.trim(),
        password: joinPassword,
        fullName: contactName.trim(),
        phone: phone.trim(),
        city: city.trim() || undefined,
        role: 'customer',
      });

      if (failure === 'CONFIRM_EMAIL') {
        try {
          const draft: Draft = {
            businessName, contactName, phone, category, city, stateName, pincode,
            shopAddress, gstNumber, upiId, bankHolder, bankIfsc, alsoArtist, message,
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
          /* the draft is a convenience only */
        }
        setBusy(false);
        setNotice('Account created. Confirm your email from your inbox, then sign in here. Your details are kept.');
        setTab('login');
        return;
      }
      if (failure) {
        setBusy(false);
        setError(failure);
        return;
      }
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
      accountEmail = data.user?.email ?? joinEmail.trim();
    }

    if (!userId) {
      setBusy(false);
      setError('Could not confirm your account. Please try again.');
      return;
    }

    const { error: insertErr } = await supabase.from('supplier_applications').insert({
      user_id: userId,
      business_name: businessName.trim(),
      contact_name: contactName.trim(),
      phone: phone.trim(),
      email: accountEmail,
      category: category || null,
      city: city.trim(),
      state: stateName || null,
      pincode: pincode.trim(),
      shop_address: shopAddress.trim(),
      gst_number: gstNumber.trim() || null,
      upi_id: upiId.trim() || null,
      bank_holder_name: bankHolder.trim() || null,
      bank_ifsc: bankIfsc.trim() || null,
      also_artist: alsoArtist,
      message: message.trim() || null,
      terms_accepted_at: new Date().toISOString(),
    });

    if (insertErr) {
      setBusy(false);
      setError(friendlyError(insertErr));
      return;
    }

    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nothing to clear */
    }
    setBusy(false);
    router.push('/supplier-portal/status');
  };

  const inputClass =
    'w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-royal-200 bg-royal-50/30 text-maroon-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-400 transition-all';
  const plainInputClass =
    'w-full px-4 py-3 text-xs rounded-xl border border-royal-200 bg-royal-50/30 text-maroon-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-400 transition-all';
  const iconClass = 'absolute left-3.5 top-1/2 -translate-y-1/2 text-maroon-800/40';
  const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-maroon-800/60 mb-1.5';

  return (
    <div className="min-h-screen bg-royal-50 text-maroon-950 flex flex-col">
      {/* Top Header Bar */}
      <header className="sk-web-header bg-maroon-950 border-b border-royal-400/20 py-4 px-6 sm:px-12 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2.5 text-royal-100 hover:text-royal-300 transition-colors">
          <div className="w-8 h-8 shrink-0">
            <Image src="/logo.png" alt="SafaKing" width={32} height={32} className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-black tracking-widest uppercase text-base">SafaKing</span>
        </Link>
        <Link href="/" className="text-xs font-bold text-royal-300 hover:text-royal-100 transition-colors uppercase tracking-wider">
          ← Back to SafaKing Home
        </Link>
      </header>

      {/* Hero Header */}
      <div className="bg-maroon-950 text-white text-center py-10 sm:py-14 px-4 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 pattern-diamond opacity-10" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-royal-500/20 border border-royal-400/30 text-royal-300 text-xs font-bold uppercase tracking-widest">
            <Crown size={14} /> SafaKing Partner Network
          </span>
          <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-royal-100 tracking-wider uppercase">
            Supplier Portal
          </h1>
          <p className="text-xs sm:text-sm text-royal-200/75 max-w-xl mx-auto leading-relaxed">
            Sell your safas &amp; accessories to SafaKing&apos;s customers across India. You set the price, stock and delivery charges. We bring the orders directly to you.
          </p>
        </div>
      </div>

      {/* Centered Main Form Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 -mt-6 pb-20 relative z-20">
        <div className="bg-white rounded-3xl border border-royal-200/80 shadow-2xl p-6 sm:p-10">
          <div className="flex border border-royal-200 bg-royal-50/50 p-1.5 rounded-2xl mb-8 shadow-inner">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                tab === 'login' ? 'bg-royal-500 text-maroon-950 shadow-md' : 'text-maroon-800/60 hover:text-maroon-950'
              }`}
            >
              Supplier Login
            </button>
            <button
              onClick={() => setTab('join')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                tab === 'join' ? 'bg-royal-500 text-maroon-950 shadow-md' : 'text-maroon-800/60 hover:text-maroon-950'
              }`}
            >
              Join as Supplier
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3.5 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2 p-3.5 mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
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
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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
              <p className="text-[11px] text-center text-maroon-800/50 pt-2">
                Applied already? Sign in to see where your application is.
              </p>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              {otherAccount && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    You are signed in with {role === 'artist' ? 'an artist' : 'a staff'} account. A supplier needs its
                    own account, so sign out and apply with a different email.
                  </p>
                </div>
              )}

              {!user && (
                <>
                  <div className="relative">
                    <Mail size={15} className={iconClass} />
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="Email Address (your supplier login)"
                      value={joinEmail}
                      onChange={(e) => setJoinEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="relative">
                    <Lock size={15} className={iconClass} />
                    <input
                      required
                      minLength={8}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Create a Password (min. 8 characters)"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      className={`${inputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-maroon-800/40 hover:text-maroon-800"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Store size={15} className={iconClass} />
                  <input
                    required
                    type="text"
                    placeholder="Business / Brand Name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="relative">
                  <User size={15} className={iconClass} />
                  <input
                    required
                    type="text"
                    placeholder="Contact Person"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
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
                    placeholder="Mobile Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <select
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={plainInputClass}
                >
                  <option value="" disabled>
                    What do you supply?
                  </option>
                  {SUPPLIER_CATEGORIES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Where your parcels are sent from</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <MapPin size={15} className={iconClass} />
                    <input
                      required
                      type="text"
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <select
                    required
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className={plainInputClass}
                  >
                    <option value="" disabled>
                      State
                    </option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <Hash size={15} className={iconClass} />
                    <input
                      required
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Pincode"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className={inputClass}
                    />
                  </div>
                </div>
                <textarea
                  required
                  rows={2}
                  placeholder="Shop / pickup address"
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  className={`${plainInputClass} mt-3 resize-none`}
                />
              </div>

              <div className="relative">
                <FileText size={15} className={iconClass} />
                <input
                  type="text"
                  maxLength={15}
                  placeholder="GSTIN (if registered)"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  className={inputClass}
                />
              </div>

              <div className="rounded-xl border border-royal-200 bg-white p-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-maroon-800/70">Where we pay you</p>
                <div className="relative">
                  <Wallet size={15} className={iconClass} />
                  <input
                    type="text"
                    placeholder="UPI ID (e.g. name@okhdfcbank)"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <User size={15} className={iconClass} />
                    <input
                      type="text"
                      placeholder="Account holder name"
                      value={bankHolder}
                      onChange={(e) => setBankHolder(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="relative">
                    <Landmark size={15} className={iconClass} />
                    <input
                      type="text"
                      maxLength={11}
                      placeholder="IFSC code"
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                      className={inputClass}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-maroon-800/50 leading-relaxed">
                  After you join, this account can only be changed by calling SafaKing, so nobody who gets hold
                  of your password can redirect your money. You upload a bank proof in the portal.
                </p>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-royal-200 bg-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoArtist}
                  onChange={(e) => setAlsoArtist(e.target.checked)}
                  className="mt-0.5 accent-maroon-900"
                />
                <span className="text-[11px] text-maroon-800/80">
                  <span className="font-bold text-maroon-950">I also tie safas</span> (I am a safa artist too)
                </span>
              </label>
              {alsoArtist && (
                <div className="flex items-start gap-2 p-3 -mt-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900">
                  <Crown size={15} className="shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Please make a separate artist account too, with a different email. One account for selling and
                    one for tying keeps your orders, bookings and payments apart.{' '}
                    <Link href="/artist-portal/login?tab=join" className="font-bold underline">
                      Join as an artist
                    </Link>
                  </p>
                </div>
              )}

              <textarea
                rows={3}
                placeholder="Tell us about your products and how many you can supply"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={`${plainInputClass} resize-none`}
              />

              <div className="rounded-xl border border-royal-200 bg-white overflow-hidden">
                <div className="px-3 py-2 bg-royal-50/60 border-b border-royal-200 flex items-center gap-1.5">
                  <ScrollText size={13} className="text-maroon-800/50" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-maroon-800/70">Supplier terms</p>
                </div>
                <ol className="p-3 space-y-1.5 text-[11px] text-maroon-800/80 leading-relaxed list-decimal list-inside max-h-44 overflow-y-auto custom-scrollbar">
                  {supplierTerms(rates).map((term) => (
                    <li key={term}>{term}</li>
                  ))}
                </ol>
                <label className="flex items-start gap-2 p-3 border-t border-royal-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 accent-maroon-900"
                  />
                  <span className="text-[11px] text-maroon-800/80">I have read and accept these terms.</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={busy || otherAccount}
                className="w-full py-3.5 bg-royal-500 hover:bg-royal-400 disabled:opacity-60 text-maroon-950 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {busy ? 'Submitting…' : 'Submit Application'}
              </button>
            </form>
          )}

          <p className="text-center text-[11px] text-maroon-800/40 mt-8">
            Looking to shop instead?{' '}
            <Link href="/" className="font-bold text-maroon-700 hover:underline">
              Go to SafaKing
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function SupplierLoginPage() {
  return (
    <Suspense fallback={null}>
      <SupplierLoginContent />
    </Suspense>
  );
}
