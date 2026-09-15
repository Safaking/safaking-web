'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Pencil, Eye, EyeOff, Trash2, Loader2, AlertCircle, CheckCircle2, Clock, XCircle, ImagePlus, X, Package,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import {
  GST_CHOICES, ListingStatus, SUPPLIER_PRODUCT_COLUMNS, SupplierProduct, SupplierProfile, SupplierRates,
  removeSupplierPhoto, rupees, splitSupplierPrice, suggestedGst, uploadSupplierPhoto,
} from '@/lib/supplier';

const MAX_EXTRA_PHOTOS = 5;

interface ExtraPhoto {
  /** null until saved. */
  id: string | null;
  url: string;
}

interface Draft {
  id: string | null;
  name: string;
  description: string;
  category: string;
  color: string;
  fabric: string;
  price: string;
  originalPrice: string;
  stock: string;
  gst: number;
  image: string | null;
  extras: ExtraPhoto[];
  removedExtras: ExtraPhoto[];
}

const emptyDraft = (): Draft => ({
  id: null, name: '', description: '', category: '', color: '', fabric: '', price: '', originalPrice: '',
  stock: '1', gst: 5, image: null, extras: [], removedExtras: [],
});

const LISTING: Record<ListingStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: 'Waiting for SafaKing', cls: 'bg-amber-100 text-amber-800', icon: Clock },
  approved: { label: 'Live', cls: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  rejected: { label: 'Needs changes', cls: 'bg-rose-100 text-rose-800', icon: XCircle },
};

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none';
const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1';

export function SupplierProducts({ supplier, rates }: { supplier: SupplierProfile; rates: SupplierRates }) {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const mainInput = useRef<HTMLInputElement>(null);
  const extraInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadErr } = await supabase
      .from('products')
      .select(SUPPLIER_PRODUCT_COLUMNS)
      .eq('supplier_id', supplier.id)
      .order('created_at', { ascending: false });
    if (loadErr) setError(friendlyError(loadErr));
    else setProducts((data as unknown as SupplierProduct[]) ?? []);
    setLoading(false);
  }, [supplier.id]);

  useEffect(() => {
    load();
  }, [load]);

  // The categories the shop already uses, so a new listing sits with them.
  useEffect(() => {
    supabase
      .from('products_with_availability')
      .select('category')
      .eq('active', true)
      .then(({ data }) => {
        const seen = new Map<string, string>();
        for (const row of (data ?? []) as { category: string | null }[]) {
          const value = row.category?.trim();
          if (value && !/^\d+$/.test(value) && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
        }
        setCategories([...seen.values()].sort((a, b) => a.localeCompare(b)));
      });
  }, []);

  const startNew = () => {
    setError(null);
    setNotice(null);
    setDraft(emptyDraft());
  };

  const startEdit = async (product: SupplierProduct) => {
    setError(null);
    setNotice(null);
    const { data } = await supabase
      .from('product_images')
      .select('id, url')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true });
    setDraft({
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      category: product.category ?? '',
      color: product.color ?? '',
      fabric: product.fabric ?? '',
      price: String(product.price),
      originalPrice: product.original_price ? String(product.original_price) : '',
      stock: String(product.stock),
      gst: Number(product.gst_percent ?? 5),
      image: product.image,
      extras: ((data ?? []) as { id: string; url: string }[]).map((row) => ({ id: row.id, url: row.url })),
      removedExtras: [],
    });
  };

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  const pickMain = async (file: File | undefined) => {
    if (!file || !draft) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadSupplierPhoto(supplier.id, file);
      // A photo uploaded in this edit but replaced again before saving is not needed.
      if (draft.image && draft.image !== products.find((p) => p.id === draft.id)?.image) {
        removeSupplierPhoto(draft.image).catch(() => {});
      }
      update('image', url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the photo.');
    } finally {
      setUploading(false);
      if (mainInput.current) mainInput.current.value = '';
    }
  };

  const pickExtras = async (files: FileList | null) => {
    if (!files || !draft) return;
    const room = MAX_EXTRA_PHOTOS - draft.extras.length;
    if (room <= 0) {
      setError(`A listing can have up to ${MAX_EXTRA_PHOTOS} extra photos.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uploaded: ExtraPhoto[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        uploaded.push({ id: null, url: await uploadSupplierPhoto(supplier.id, file) });
      }
      setDraft((prev) => (prev ? { ...prev, extras: [...prev.extras, ...uploaded] } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the photo.');
    } finally {
      setUploading(false);
      if (extraInput.current) extraInput.current.value = '';
    }
  };

  const dropExtra = (photo: ExtraPhoto) =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            extras: prev.extras.filter((e) => e !== photo),
            removedExtras: photo.id ? [...prev.removedExtras, photo] : prev.removedExtras,
          }
        : prev
    );

  const save = async () => {
    if (!draft) return;
    setError(null);

    const name = draft.name.trim();
    const price = Math.round(Number(draft.price));
    const stock = Math.round(Number(draft.stock));
    const mrp = draft.originalPrice.trim() ? Math.round(Number(draft.originalPrice)) : null;

    if (name.length < 3) return setError('Give the product a name of at least 3 characters.');
    if (!Number.isFinite(price) || price < 1 || price > 500000) return setError('Enter a price between ₹1 and ₹5,00,000.');
    if (mrp != null && (!Number.isFinite(mrp) || mrp < price)) return setError('The MRP cannot be lower than your selling price.');
    if (!Number.isFinite(stock) || stock < 0 || stock > 100000) return setError('Enter how many you have in stock.');
    if (!draft.image) return setError('Add a main photo.');

    const payload = {
      name,
      description: draft.description.trim() || null,
      category: draft.category.trim() || null,
      color: draft.color.trim() || null,
      fabric: draft.fabric.trim() || null,
      price,
      original_price: mrp,
      stock,
      gst_percent: draft.gst,
      image: draft.image,
    };

    setSaving(true);
    try {
      let productId = draft.id;
      if (!productId) {
        const { data, error: insertErr } = await supabase
          .from('products')
          .insert({ ...payload, active: true })
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        productId = (data as { id: string }).id;
      } else {
        const previous = products.find((p) => p.id === productId);
        const { error: updateErr } = await supabase.from('products').update(payload).eq('id', productId);
        if (updateErr) throw updateErr;
        if (previous?.image && previous.image !== draft.image) removeSupplierPhoto(previous.image).catch(() => {});
      }

      const added = draft.extras.filter((e) => !e.id);
      if (added.length > 0) {
        const kept = draft.extras.length - added.length;
        const { error: imagesErr } = await supabase
          .from('product_images')
          .insert(added.map((e, i) => ({ product_id: productId, url: e.url, sort_order: kept + i })));
        if (imagesErr) throw imagesErr;
      }
      if (draft.removedExtras.length > 0) {
        const { error: removeErr } = await supabase
          .from('product_images')
          .delete()
          .in('id', draft.removedExtras.map((e) => e.id as string));
        if (removeErr) throw removeErr;
        draft.removedExtras.forEach((e) => removeSupplierPhoto(e.url).catch(() => {}));
      }

      setNotice(
        draft.id
          ? 'Saved. A new name, price, description or photo is checked by SafaKing before customers see it.'
          : 'Listed. SafaKing checks every new product before customers see it, usually within a day.'
      );
      setDraft(null);
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: SupplierProduct) => {
    setBusy(product.id);
    setError(null);
    const { error: updateErr } = await supabase.from('products').update({ active: !product.active }).eq('id', product.id);
    setBusy(null);
    if (updateErr) setError(friendlyError(updateErr));
    else await load();
  };

  const remove = async (product: SupplierProduct) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setBusy(product.id);
    setError(null);
    const { data, error: deleteErr } = await supabase.from('products').delete().eq('id', product.id).select('id');
    setBusy(null);
    if (deleteErr) {
      setError(friendlyError(deleteErr));
      return;
    }
    if (!data || data.length === 0) {
      setNotice('This product has been ordered before, so it stays on record. Hide it instead.');
      return;
    }
    removeSupplierPhoto(product.image).catch(() => {});
    await load();
  };

  const priceNumber = Math.round(Number(draft?.price ?? 0));
  const split = draft && priceNumber > 0 ? splitSupplierPrice(priceNumber, draft.gst, rates) : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-black text-2xl text-maroon-900">Your Products</h2>
        {!draft && (
          <button
            onClick={startNew}
            disabled={!supplier.active}
            className="px-5 py-2.5 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-50 text-royal-300 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5"
          >
            <Plus size={14} /> Add a product
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{notice}</p>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {draft && (
        <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-md p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-maroon-950">{draft.id ? 'Edit product' : 'New product'}</h3>
            <button onClick={() => setDraft(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div>
            <label className={labelClass}>Photos</label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => mainInput.current?.click()}
                className="relative w-28 h-28 rounded-2xl border-2 border-dashed border-amber-300 hover:border-maroon-400 flex flex-col items-center justify-center overflow-hidden bg-amber-50/40 text-[10px] font-bold text-gray-500"
              >
                {draft.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.image} alt="Main photo" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <ImagePlus size={20} className="mb-1" /> Main photo
                  </>
                )}
              </button>
              {draft.extras.map((photo) => (
                <div key={photo.url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="Extra photo" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => dropExtra(photo)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                    aria-label="Remove photo"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {draft.extras.length < MAX_EXTRA_PHOTOS && (
                <button
                  type="button"
                  onClick={() => extraInput.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 hover:border-maroon-300 flex flex-col items-center justify-center text-[9px] font-bold text-gray-400"
                >
                  <Plus size={16} /> More
                </button>
              )}
              {uploading && <Loader2 size={18} className="animate-spin text-amber-600 self-center" />}
            </div>
            <input ref={mainInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickMain(e.target.files?.[0])} />
            <input ref={extraInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickExtras(e.target.files)} />
            <p className="text-[10px] text-gray-500 mt-1.5">
              Clear, bright photos of the real product on a plain background. Up to {MAX_EXTRA_PHOTOS} extra photos.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Product name</label>
              <input value={draft.name} maxLength={120} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Jodhpuri Bandhej Cotton Safa" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea
                rows={3}
                maxLength={3000}
                value={draft.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Length, fabric, work, what is included, care"
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <input list="safaking-categories" value={draft.category} onChange={(e) => update('category', e.target.value)} className={inputClass} />
              <datalist id="safaking-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Colour</label>
                <input value={draft.color} onChange={(e) => update('color', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Fabric</label>
                <input value={draft.fabric} onChange={(e) => update('fabric', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Your selling price (₹, GST included)</label>
              <input
                type="number"
                min={1}
                value={draft.price}
                onChange={(e) => {
                  update('price', e.target.value);
                  if (!draft.id) update('gst', suggestedGst(Number(e.target.value) || 0));
                }}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>MRP (optional)</label>
                <input type="number" min={1} value={draft.originalPrice} onChange={(e) => update('originalPrice', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>In stock</label>
                <input type="number" min={0} value={draft.stock} onChange={(e) => update('stock', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>GST rate on your bill</label>
              <div className="flex gap-2">
                {GST_CHOICES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => update('gst', rate)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      draft.gst === rate ? 'bg-maroon-950 text-royal-300 border-maroon-950' : 'bg-white text-gray-600 border-gray-200 hover:border-maroon-300'
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Usually 5% for a safa up to ₹2,500 and 18% above. Check with your accountant if unsure.
              </p>
            </div>
          </div>

          {split && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-1.5 text-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">What you receive per piece</p>
              <p className="flex justify-between text-maroon-900"><span>Customer pays</span><span className="font-bold">{rupees(priceNumber)}</span></p>
              <p className="flex justify-between text-gray-600"><span>GST ({draft.gst}%, inside the price)</span><span>− {rupees(split.gst)}</span></p>
              <p className="flex justify-between text-gray-600"><span>SafaKing platform fee ({Math.round(rates.platformRate * 100)}%)</span><span>− {rupees(split.platformFee)}</span></p>
              <p className="flex justify-between text-gray-600"><span>Payment gateway fee ({Math.round(rates.gatewayRate * 100)}%)</span><span>− {rupees(split.gatewayFee)}</span></p>
              <p className="flex justify-between font-black text-emerald-900 pt-1.5 border-t border-emerald-200">
                <span>You receive</span><span>{rupees(split.payout)}</span>
              </p>
              <p className="text-[10px] text-emerald-800/80">
                The customer also pays your delivery charge, which you receive in full.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={save}
              disabled={saving || uploading}
              className="px-8 py-3 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {draft.id ? 'Save changes' : 'Send for approval'}
            </button>
            <button onClick={() => setDraft(null)} className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-amber-200/60">
          <Loader2 size={28} className="text-amber-500 mx-auto mb-3 animate-spin" />
          <p className="font-bold text-gray-700 text-sm">Loading your products…</p>
        </div>
      ) : products.length === 0 ? (
        !draft && (
          <div className="p-12 text-center bg-white rounded-3xl border border-amber-200/60">
            <Package size={34} className="text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-gray-700">No products yet.</p>
            <p className="text-xs text-gray-500 mt-1.5">Add your first safa. SafaKing checks it, then customers can buy it.</p>
          </div>
        )
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((product) => {
            const status = LISTING[product.listing_status];
            const StatusIcon = status.icon;
            const receive = splitSupplierPrice(product.price, Number(product.gst_percent ?? 0), rates).payout;
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col ${product.active ? 'border-amber-200/60' : 'border-gray-200 opacity-75'}`}
              >
                <div className="relative aspect-[4/3] bg-gray-100">
                  {product.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  )}
                  <span className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${status.cls}`}>
                    <StatusIcon size={11} /> {status.label}
                  </span>
                  {!product.active && (
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-800 text-white">
                      Hidden
                    </span>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col gap-1.5">
                  <p className="font-bold text-sm text-maroon-950 leading-snug">{product.name}</p>
                  <p className="text-xs text-gray-600">
                    <span className="font-black text-maroon-950">{rupees(product.price)}</span>
                    {product.original_price && product.original_price > product.price && (
                      <span className="line-through ml-1.5 text-gray-400">{rupees(product.original_price)}</span>
                    )}
                    <span className="ml-2">· {product.stock} in stock</span>
                  </p>
                  <p className="text-[11px] text-emerald-700 font-bold">You receive {rupees(receive)} each</p>
                  {product.listing_status === 'rejected' && product.listing_note && (
                    <p className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-2">
                      <span className="font-bold">To fix:</span> {product.listing_note}
                    </p>
                  )}
                  <div className="mt-auto pt-3 flex flex-wrap gap-2">
                    <button onClick={() => startEdit(product)} className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-1">
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      onClick={() => toggleActive(product)}
                      disabled={busy === product.id}
                      className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold flex items-center gap-1 disabled:opacity-60"
                    >
                      {product.active ? <EyeOff size={12} /> : <Eye size={12} />} {product.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => remove(product)}
                      disabled={busy === product.id}
                      className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold flex items-center gap-1 disabled:opacity-60"
                      aria-label={`Delete ${product.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
