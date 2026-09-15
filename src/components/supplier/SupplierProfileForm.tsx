'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Truck, Store, Crown } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { INDIAN_STATES, SUPPLIER_CATEGORIES, SupplierProfile } from '@/lib/supplier';

interface FormState {
  business_name: string;
  contact_name: string;
  phone: string;
  email: string;
  category: string;
  city: string;
  state: string;
  pincode: string;
  shop_address: string;
  gst_number: string;
  ship_same_city: string;
  ship_same_state: string;
  ship_rest_india: string;
  dispatch_days: string;
  also_artist: boolean;
}

const fromSupplier = (s: SupplierProfile): FormState => ({
  business_name: s.business_name,
  contact_name: s.contact_name,
  phone: s.phone,
  email: s.email ?? '',
  category: s.category ?? '',
  city: s.city ?? '',
  state: s.state ?? '',
  pincode: s.pincode ?? '',
  shop_address: s.shop_address ?? '',
  gst_number: s.gst_number ?? '',
  ship_same_city: s.ship_same_city?.toString() ?? '',
  ship_same_state: s.ship_same_state?.toString() ?? '',
  ship_rest_india: s.ship_rest_india?.toString() ?? '',
  dispatch_days: String(s.dispatch_days ?? 2),
  also_artist: s.also_artist,
});

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none';
const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1';

export function SupplierProfileForm({
  supplier, onSaved,
}: {
  supplier: SupplierProfile;
  onSaved: (next: SupplierProfile) => void;
}) {
  const [form, setForm] = useState<FormState>(() => fromSupplier(supplier));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pincode = form.pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      setError('Enter the 6-digit pincode your parcels are sent from.');
      return;
    }
    const charges = [form.ship_same_city, form.ship_same_state, form.ship_rest_india].map((v) =>
      v.trim() === '' ? NaN : Math.round(Number(v))
    );
    if (charges.some((c) => !Number.isFinite(c) || c < 0 || c > 5000)) {
      setError('Enter all three delivery charges in rupees, between 0 and 5,000. Enter 0 for free delivery.');
      return;
    }
    const days = Math.round(Number(form.dispatch_days));
    if (!Number.isFinite(days) || days < 0 || days > 30) {
      setError('Days to send an order must be between 0 and 30.');
      return;
    }
    const gst = form.gst_number.trim().toUpperCase();
    if (gst && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gst)) {
      setError('A GSTIN is 15 characters and starts with two digits.');
      return;
    }

    setSaving(true);
    const { data, error: saveErr } = await supabase
      .from('supplier_profiles')
      .update({
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        category: form.category || null,
        city: form.city.trim() || null,
        state: form.state || null,
        pincode,
        shop_address: form.shop_address.trim() || null,
        gst_number: gst || null,
        ship_same_city: charges[0],
        ship_same_state: charges[1],
        ship_rest_india: charges[2],
        dispatch_days: days,
        also_artist: form.also_artist,
      })
      .eq('id', supplier.id)
      .select('*')
      .single();
    setSaving(false);

    if (saveErr) {
      setError(friendlyError(saveErr));
      return;
    }
    onSaved(data as SupplierProfile);
    setForm(fromSupplier(data as SupplierProfile));
    setSaved(true);
  };

  const cityPrefix = /^[1-9][0-9]{5}$/.test(form.pincode.trim()) ? form.pincode.trim().slice(0, 3) : null;

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 space-y-4">
        <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
          <Truck size={18} className="text-amber-600" /> Delivery charges
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          The customer pays these on top of your price, once per order from you, and you receive them in full. We work
          out which one applies from the customer&apos;s pincode.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Pincode you send parcels from</label>
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Days to send an order, once paid</label>
            <input
              required
              type="number"
              min={0}
              max={30}
              value={form.dispatch_days}
              onChange={(e) => set('dispatch_days', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {([
            ['ship_same_city', 'Your city', cityPrefix ? `Pincodes starting ${cityPrefix}` : 'Same district'],
            ['ship_same_state', 'Your state', form.state ? `Rest of ${form.state}` : 'Same state'],
            ['ship_rest_india', 'Rest of India', 'Everywhere else'],
          ] as const).map(([key, label, hint]) => (
            <div key={key} className="rounded-2xl border border-amber-200/70 bg-amber-50/40 p-3">
              <label className={labelClass}>{label} (₹)</label>
              <input
                required
                type="number"
                min={0}
                max={5000}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className={inputClass}
              />
              <p className="text-[10px] text-gray-500 mt-1">{hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 space-y-4">
        <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
          <Store size={18} className="text-amber-600" /> Business details
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Business / brand name</label>
            <input required value={form.business_name} onChange={(e) => set('business_name', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Contact person</label>
            <input required value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Mobile number</label>
            <input required type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>What you supply</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputClass}>
              <option value="">Choose…</option>
              {SUPPLIER_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>GSTIN</label>
            <input
              maxLength={15}
              value={form.gst_number}
              onChange={(e) => set('gst_number', e.target.value.toUpperCase())}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <select value={form.state} onChange={(e) => set('state', e.target.value)} className={inputClass}>
              <option value="">Choose…</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Shop / pickup address</label>
          <textarea
            rows={2}
            value={form.shop_address}
            onChange={(e) => set('shop_address', e.target.value)}
            className={`${inputClass} resize-none`}
          />
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.also_artist}
            onChange={(e) => set('also_artist', e.target.checked)}
            className="mt-0.5 accent-maroon-900"
          />
          <span className="text-xs text-gray-700 flex items-center gap-1.5">
            <Crown size={13} className="text-amber-600" /> I also tie safas (with a separate artist account)
          </span>
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3.5 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />} Save
        </button>
        {saved && (
          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Saved
          </span>
        )}
        <span className="text-[11px] text-gray-500">To change where you are paid, call SafaKing.</span>
      </div>
    </form>
  );
}
