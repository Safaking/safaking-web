'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Store, Loader2, AlertCircle, CheckCircle2, XCircle, Crown, Pause, Play, Package, Truck, ShieldAlert, Phone, RefreshCw,
} from 'lucide-react';
import { supabase, friendlyError, DBSupplierApplication } from '@/lib/supabase';
import {
  DeliveryZone, SHIPMENT_LABEL, SUPPLIER_PRODUCT_COLUMNS, ShipmentStatus, SupplierProduct, SupplierProfile, ZONE_LABEL,
  deliverySetupMissing, rupees,
} from '@/lib/supplier';

type View = 'applications' | 'suppliers' | 'listings' | 'orders';

interface ShipmentRow {
  id: string;
  order_id: string;
  supplier_id: string;
  status: ShipmentStatus | 'awaiting_payment';
  zone: DeliveryZone;
  items_amount: number;
  shipping_amount: number;
  payout_amount: number;
  courier: string | null;
  tracking_number: string | null;
  created_at: string;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancel_reason: string | null;
  payout_hold: boolean;
  hold_reason: string | null;
  payout_id: string | null;
}

const KYC_CHIP: Record<SupplierProfile['verification_status'], string> = {
  verified: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-rose-100 text-rose-800',
  unverified: 'bg-gray-100 text-gray-600',
};

const KYC_LABEL: Record<SupplierProfile['verification_status'], string> = {
  verified: 'Documents approved',
  pending: 'Documents to check',
  rejected: 'Document rejected',
  unverified: 'No documents yet',
};

const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const chip = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider';

/**
 * Admin → Suppliers. Applications, the supplier accounts, listings waiting
 * for approval, and supplier orders. Every decision runs through a database
 * function that checks the person is allowed to make it (040).
 */
export function SupplierDesk() {
  const [view, setView] = useState<View>('applications');
  const [applications, setApplications] = useState<DBSupplierApplication[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [listings, setListings] = useState<SupplierProduct[]>([]);
  const [extraPhotos, setExtraPhotos] = useState<Record<string, string[]>>({});
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [apps, profiles, products, parcels] = await Promise.all([
      supabase.from('supplier_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('supplier_profiles').select('*').order('business_name', { ascending: true }),
      supabase
        .from('products')
        .select(SUPPLIER_PRODUCT_COLUMNS)
        .not('supplier_id', 'is', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('order_shipments')
        .select(
          'id, order_id, supplier_id, status, zone, items_amount, shipping_amount, payout_amount, courier, tracking_number, ' +
            'created_at, dispatched_at, delivered_at, cancel_reason, payout_hold, hold_reason, payout_id'
        )
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

    const firstError = apps.error ?? profiles.error ?? products.error ?? parcels.error;
    setError(firstError ? friendlyError(firstError) : null);
    setApplications((apps.data as DBSupplierApplication[]) ?? []);
    setSuppliers((profiles.data as SupplierProfile[]) ?? []);
    const productRows = (products.data as unknown as SupplierProduct[]) ?? [];
    setListings(productRows);
    setShipments((parcels.data as unknown as ShipmentRow[]) ?? []);

    if (productRows.length > 0) {
      const { data: images } = await supabase
        .from('product_images')
        .select('product_id, url')
        .in('product_id', productRows.map((p) => p.id))
        .order('sort_order', { ascending: true });
      const grouped: Record<string, string[]> = {};
      for (const row of (images ?? []) as { product_id: string; url: string }[]) {
        (grouped[row.product_id] ??= []).push(row.url);
      }
      setExtraPhotos(grouped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const supplierName = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.business_name])),
    [suppliers]
  );

  const counts = {
    applications: applications.filter((a) => a.status === 'pending').length,
    suppliers: suppliers.length,
    listings: listings.filter((p) => p.listing_status === 'pending').length,
    orders: shipments.filter((s) => s.payout_hold || s.status === 'cancelled').length,
  };

  const run = async (key: string, task: () => PromiseLike<{ error: unknown }>, success: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    const { error: taskErr } = await task();
    setBusy(null);
    if (taskErr) {
      setError(friendlyError(taskErr));
      return;
    }
    setNotice(success);
    await load();
  };

  const approveApplication = (app: DBSupplierApplication) =>
    run(
      app.id,
      () => supabase.rpc('approve_supplier_application', { p_application_id: app.id }),
      `${app.business_name} is now a SafaKing supplier. They can sign in to the Supplier Portal.`
    );

  const rejectApplication = (app: DBSupplierApplication) => {
    const note = window.prompt(`Why is ${app.business_name} not approved? They will see this.`);
    if (note === null) return;
    return run(
      app.id,
      () => supabase.rpc('reject_supplier_application', { p_application_id: app.id, p_note: note }),
      `${app.business_name}'s application was not approved.`
    );
  };

  const toggleSupplier = (supplier: SupplierProfile) => {
    if (supplier.active && !window.confirm(`Pause ${supplier.business_name}? Their products leave the shop at once.`)) return;
    return run(
      supplier.id,
      () => supabase.from('supplier_profiles').update({ active: !supplier.active }).eq('id', supplier.id),
      supplier.active ? `${supplier.business_name} is paused.` : `${supplier.business_name} is active again.`
    );
  };

  const reviewListing = (product: SupplierProduct, approve: boolean) => {
    let note: string | null = null;
    if (!approve) {
      note = window.prompt(`What should the supplier fix in "${product.name}"?`);
      if (note === null) return;
    }
    return run(
      product.id,
      () => supabase.rpc('review_supplier_product', { p_product_id: product.id, p_approve: approve, p_note: note }),
      approve ? `"${product.name}" is live in the shop.` : `"${product.name}" was sent back to the supplier.`
    );
  };

  const setHold = (shipment: ShipmentRow, hold: boolean) => {
    let reason: string | null = null;
    if (hold) {
      reason = window.prompt('Why is the supplier payment on hold?');
      if (reason === null) return;
    }
    return run(
      shipment.id,
      () => supabase.rpc('set_shipment_payout_hold', { p_shipment_id: shipment.id, p_hold: hold, p_reason: reason }),
      hold ? 'Payment for that parcel is on hold.' : 'Payment for that parcel is released.'
    );
  };

  const tabs: { id: View; label: string; icon: typeof Store }[] = [
    { id: 'applications', label: 'Applications', icon: Store },
    { id: 'suppliers', label: 'Suppliers', icon: Crown },
    { id: 'listings', label: 'Listings to check', icon: Package },
    { id: 'orders', label: 'Supplier orders', icon: Truck },
  ];

  const sortedListings = [...listings].sort(
    (a, b) => Number(b.listing_status === 'pending') - Number(a.listing_status === 'pending')
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all ${
                view === id ? 'bg-maroon-950 text-royal-300 shadow-md' : 'bg-white text-gray-600 border border-amber-200/60 hover:text-maroon-900'
              }`}
            >
              <Icon size={14} /> {label}
              {counts[id] > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${view === id ? 'bg-royal-300 text-maroon-950' : 'bg-amber-100 text-amber-900'}`}>
                  {counts[id]}
                </span>
              )}
            </button>
          ))}
        </div>
        <button onClick={load} className="p-2.5 rounded-xl bg-white border border-amber-200/60 text-gray-600 hover:text-maroon-900" aria-label="Reload">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
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

      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-amber-200/60">
          <Loader2 size={26} className="animate-spin mx-auto mb-3 text-amber-500" />
          <p className="text-sm font-bold text-gray-600">Loading suppliers…</p>
        </div>
      ) : view === 'applications' ? (
        applications.length === 0 ? (
          <EmptyCard label="No supplier applications yet." />
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {applications.map((app) => (
              <div key={app.id} className={`bg-white rounded-3xl border shadow-sm p-5 space-y-3 ${app.also_artist ? 'border-2 border-amber-400' : 'border-amber-200/60'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display font-black text-lg text-maroon-950">{app.business_name}</p>
                    <p className="text-[11px] text-gray-500">
                      {app.contact_name} · applied {day(app.created_at)}
                    </p>
                  </div>
                  <span
                    className={`${chip} ${
                      app.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : app.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                {app.also_artist && (
                  <p className="flex items-start gap-2 text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-300 rounded-xl p-2.5">
                    <Crown size={13} className="shrink-0 mt-0.5" />
                    Also a safa artist. Their artist work needs a separate artist account with a different email.
                  </p>
                )}

                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <Detail label="Phone">
                    <a href={`tel:${app.phone}`} className="font-bold hover:underline">{app.phone}</a>
                  </Detail>
                  <Detail label="Email">{app.email ?? '—'}</Detail>
                  <Detail label="Sends from">{[app.city, app.state, app.pincode].filter(Boolean).join(', ') || '—'}</Detail>
                  <Detail label="Supplies">{app.category ?? '—'}</Detail>
                  <Detail label="GSTIN">{app.gst_number ?? 'Not registered'}</Detail>
                  <Detail label="Pay to">
                    {app.upi_id ? `UPI ${app.upi_id}` : [app.bank_holder_name, app.bank_ifsc].filter(Boolean).join(' · ') || '—'}
                  </Detail>
                </dl>
                {app.shop_address && <p className="text-xs text-gray-600">{app.shop_address}</p>}
                {app.message && <p className="text-xs text-gray-700 bg-gray-50 rounded-xl p-2.5">{app.message}</p>}
                {app.review_note && <p className="text-[11px] text-rose-800">Not approved: {app.review_note}</p>}

                {app.status === 'pending' &&
                  (app.user_id ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => approveApplication(app)}
                        disabled={busy === app.id}
                        className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                      >
                        {busy === app.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve supplier
                      </button>
                      <button
                        onClick={() => rejectApplication(app)}
                        disabled={busy === app.id}
                        className="px-4 py-2.5 bg-white border-2 border-rose-300 hover:bg-rose-50 text-rose-700 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                      >
                        <XCircle size={13} /> Not approved
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-2.5">
                      Sent from the old homepage form, without an account. Call them and ask them to apply at
                      safaking.in/supplier-portal.
                    </p>
                  ))}
              </div>
            ))}
          </div>
        )
      ) : view === 'suppliers' ? (
        suppliers.length === 0 ? (
          <EmptyCard label="No approved suppliers yet." />
        ) : (
          <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-maroon-800/60 border-b border-amber-100">
                <tr>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">Sends from</th>
                  <th className="p-4">Documents</th>
                  <th className="p-4">Delivery charges</th>
                  <th className="p-4">Listings</th>
                  <th className="p-4">Pay to</th>
                  <th className="p-4">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {suppliers.map((s) => {
                  const own = listings.filter((p) => p.supplier_id === s.id);
                  return (
                    <tr key={s.id} className="hover:bg-amber-50/30">
                      <td className="p-4">
                        <p className="font-bold text-maroon-950">{s.business_name}</p>
                        <p className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Phone size={10} /> {s.contact_name} · {s.phone}
                        </p>
                        {s.also_artist && (
                          <span className={`${chip} mt-1 bg-amber-200 text-amber-900`}>
                            <Crown size={10} /> Also an artist
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-gray-700">{[s.city, s.state, s.pincode].filter(Boolean).join(', ') || '—'}</td>
                      <td className="p-4">
                        <span className={`${chip} ${KYC_CHIP[s.verification_status]}`}>{KYC_LABEL[s.verification_status]}</span>
                      </td>
                      <td className="p-4 text-gray-700">
                        {deliverySetupMissing(s) ? (
                          <span className="text-amber-700 font-bold">Not set</span>
                        ) : (
                          <>
                            {rupees(s.ship_same_city ?? 0)} / {rupees(s.ship_same_state ?? 0)} / {rupees(s.ship_rest_india ?? 0)}
                            <span className="block text-[10px] text-gray-400">city / state / India · sends in {s.dispatch_days}d</span>
                          </>
                        )}
                      </td>
                      <td className="p-4 text-gray-700">
                        {own.filter((p) => p.listing_status === 'approved' && p.active).length} live
                        <span className="block text-[10px] text-gray-400">
                          {own.filter((p) => p.listing_status === 'pending').length} to check
                        </span>
                      </td>
                      <td className="p-4 text-gray-700 max-w-[180px]">
                        {s.upi_id ? `UPI ${s.upi_id}` : [s.bank_holder_name, s.bank_ifsc].filter(Boolean).join(' · ') || '—'}
                        {s.bank_account_last4 && <span className="block text-[10px] text-gray-400">A/c ending {s.bank_account_last4}</span>}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => toggleSupplier(s)}
                          disabled={busy === s.id}
                          className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 disabled:opacity-60 ${
                            s.active ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {s.active ? <Pause size={11} /> : <Play size={11} />} {s.active ? 'Pause' : 'Resume'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="p-4 text-[11px] text-gray-500">
              Payment details are changed here only after calling the supplier. Documents are checked under
              Verification.
            </p>
          </div>
        )
      ) : view === 'listings' ? (
        sortedListings.length === 0 ? (
          <EmptyCard label="No supplier listings yet." />
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedListings.map((p) => (
              <div key={p.id} className={`bg-white rounded-3xl border shadow-sm overflow-hidden ${p.listing_status === 'pending' ? 'border-2 border-amber-400' : 'border-amber-200/60'}`}>
                <div className="flex gap-1 bg-gray-100 overflow-x-auto">
                  {[p.image, ...(extraPhotos[p.id] ?? [])].filter(Boolean).map((url) => (
                    <a key={url} href={url as string} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url as string} alt={p.name} className="h-40 w-auto object-cover" />
                    </a>
                  ))}
                </div>
                <div className="p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm text-maroon-950">{p.name}</p>
                    <span
                      className={`${chip} shrink-0 ${
                        p.listing_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : p.listing_status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.listing_status === 'approved' ? 'Live' : p.listing_status === 'rejected' ? 'Sent back' : 'To check'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">{supplierName.get(p.supplier_id) ?? 'Supplier'} · {p.code}</p>
                  <p className="text-xs text-gray-700">
                    <span className="font-black text-maroon-950">{rupees(p.price)}</span>
                    {p.original_price ? <span className="line-through text-gray-400 ml-1.5">{rupees(p.original_price)}</span> : null}
                    <span className="ml-2">GST {Number(p.gst_percent ?? 0)}% · {p.stock} in stock</span>
                  </p>
                  <p className="text-[11px] text-gray-500">{[p.category, p.color, p.fabric].filter(Boolean).join(' · ')}</p>
                  {p.description && <p className="text-xs text-gray-700 line-clamp-4">{p.description}</p>}
                  {p.listing_note && <p className="text-[11px] text-rose-800">Note sent: {p.listing_note}</p>}
                  {!p.active && <p className="text-[11px] font-bold text-gray-500">Hidden by the supplier</p>}
                  {p.listing_status !== 'approved' && (
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => reviewListing(p, true)}
                        disabled={busy === p.id}
                        className="flex-1 px-3 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5"
                      >
                        {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve
                      </button>
                      {p.listing_status === 'pending' && (
                        <button
                          onClick={() => reviewListing(p, false)}
                          disabled={busy === p.id}
                          className="flex-1 px-3 py-2.5 bg-white border-2 border-rose-300 hover:bg-rose-50 text-rose-700 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <XCircle size={13} /> Send back
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : shipments.length === 0 ? (
        <EmptyCard label="No supplier orders yet." />
      ) : (
        <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-maroon-800/60 border-b border-amber-100">
              <tr>
                <th className="p-4">Order</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Parcel</th>
                <th className="p-4">Money</th>
                <th className="p-4">Supplier payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {shipments.map((s) => (
                <tr key={s.id} className={s.payout_hold ? 'bg-rose-50/40' : 'hover:bg-amber-50/30'}>
                  <td className="p-4">
                    <p className="font-bold text-maroon-950 font-mono">#{s.order_id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-[10px] text-gray-500">{day(s.created_at)}</p>
                  </td>
                  <td className="p-4 text-gray-700">{supplierName.get(s.supplier_id) ?? '—'}</td>
                  <td className="p-4">
                    <span className="font-bold text-maroon-950">
                      {s.status === 'awaiting_payment' ? 'Not paid yet' : SHIPMENT_LABEL[s.status]}
                    </span>
                    <span className="block text-[10px] text-gray-500">{ZONE_LABEL[s.zone]}</span>
                    {s.courier && (
                      <span className="block text-[10px] text-gray-500">
                        {s.courier}
                        {s.tracking_number ? ` · ${s.tracking_number}` : ''}
                      </span>
                    )}
                    {s.status === 'cancelled' && s.cancel_reason && (
                      <span className="block text-[10px] font-bold text-rose-700">{s.cancel_reason}. Refund the customer.</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-700">
                    {rupees(Number(s.items_amount))} + {rupees(s.shipping_amount)} delivery
                    <span className="block text-[10px] text-gray-500">Supplier gets {rupees(Number(s.payout_amount))}</span>
                  </td>
                  <td className="p-4">
                    {s.payout_hold ? (
                      <div className="space-y-1">
                        <span className={`${chip} bg-rose-100 text-rose-800`}>
                          <ShieldAlert size={10} /> On hold
                        </span>
                        {s.hold_reason && <p className="text-[10px] text-rose-800 max-w-[220px]">{s.hold_reason}</p>}
                        <button
                          onClick={() => setHold(s, false)}
                          disabled={busy === s.id}
                          className="block px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider"
                        >
                          Release
                        </button>
                      </div>
                    ) : s.payout_id ? (
                      <span className="text-[11px] text-gray-600">In a payout</span>
                    ) : s.status === 'cancelled' ? (
                      <span className="text-[11px] text-gray-400">—</span>
                    ) : (
                      <button
                        onClick={() => setHold(s, true)}
                        disabled={busy === s.id}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wider"
                      >
                        Hold payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="text-maroon-950 break-words">{children}</dd>
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="p-12 text-center bg-white rounded-3xl border border-amber-200/60">
      <AlertCircle size={28} className="text-gray-300 mx-auto mb-3" />
      <p className="text-sm font-bold text-gray-600">{label}</p>
    </div>
  );
}
