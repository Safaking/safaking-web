'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Crown, ShoppingBag, Calendar, Users, Package, GraduationCap, Briefcase, MapPin,
  TrendingUp, Plus, Edit, Trash2, ArrowLeft, LogOut, AlertCircle, Loader2, X, Save,
  CalendarRange, SlidersHorizontal, ShieldCheck, ShieldAlert, Siren, Mail, Wallet,
  Phone, User, Navigation, MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  supabase, friendlyError,
  DBOrder, DBArtistBooking, DBArtistApplication, DBDeliverablePincode, DBSupplierApplication, DBAcademyEnrollment,
  DBJobApplication, DBProduct, DBRentalBooking, DBAppSetting, UserProfile, UserRole,
} from '@/lib/supabase';
import { getWhatsAppClickLink } from '@/lib/whatsapp';
import { STATIC_PINCODES } from '@/lib/pincodes';
import { VerificationQueue } from '@/components/verification/VerificationQueue';
import { CancellationDesk } from '@/components/protection/CancellationDesk';
import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
import { LiveOpsBoard } from '@/components/liveops/LiveOpsBoard';
import { TrainingManager } from '@/components/admin/TrainingManager';
import { TeamBuilder } from '@/components/liveops/TeamBuilder';
import { ContactInbox } from '@/components/admin/ContactInbox';
import { PaymentReleaseQueue } from '@/components/admin/PaymentReleaseQueue';

type Tab =
  | 'orders' | 'rentals' | 'bookings' | 'artist_apps' | 'products'
  | 'pincodes' | 'suppliers' | 'academy' | 'careers' | 'users' | 'settings' | 'verification' | 'protection' | 'analytics' | 'liveops' | 'training' | 'messages' | 'payouts';

const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'liveops', label: 'Live Ops', icon: Siren },
  { id: 'analytics', label: 'Reports', icon: TrendingUp },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'rentals', label: 'Rentals', icon: CalendarRange },
  { id: 'bookings', label: 'Artist Bookings', icon: Calendar },
  { id: 'artist_apps', label: 'Artist Applications', icon: Crown },
  { id: 'verification', label: 'Verification', icon: ShieldCheck },
  { id: 'protection', label: 'Cancellations', icon: ShieldAlert },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'pincodes', label: 'Pincodes', icon: MapPin },
  { id: 'suppliers', label: 'Suppliers', icon: Briefcase },
  { id: 'academy', label: 'Academy Leads', icon: GraduationCap },
  { id: 'training', label: 'Training & Certificates', icon: GraduationCap },
  { id: 'careers', label: 'Job Applications', icon: Users },
  { id: 'payouts', label: 'Payment Release', icon: Wallet },
  { id: 'messages', label: 'Messages', icon: Mail },
  { id: 'users', label: 'Users & Roles', icon: Users },
  { id: 'settings', label: 'Pricing Settings', icon: SlidersHorizontal },
];

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
const APPLICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
const ENROLLMENT_STATUSES = ['pending', 'contacted', 'enrolled'] as const;
const JOB_STATUSES = ['pending', 'shortlisted', 'hired', 'rejected'] as const;
const RENTAL_STATUSES = [
  'pending', 'confirmed', 'dispatched', 'active', 'returned', 'completed', 'cancelled',
] as const;
const ROLES: UserRole[] = ['customer', 'artist', 'admin'];

const EMPTY_PRODUCT = {
  name: '', code: '', price: '', original_price: '', category: '', color: '',
  fabric: '', style: '', occasion: '', image: '', description: '', stock: '',
  is_bestseller: false, is_new: false, featured: false, active: true,
  // Rental pricing — admin controlled, per safa.
  is_rentable: false, rent_price_per_day: '', rent_deposit: '',
};
type ProductForm = typeof EMPTY_PRODUCT;

function statusTone(status: string): string {
  switch (status) {
    case 'delivered':
    case 'completed':
    case 'approved':
    case 'enrolled':
    case 'hired':
      return 'bg-emerald-100 text-emerald-800';
    case 'shipped':
    case 'assigned':
    case 'contacted':
    case 'shortlisted':
      return 'bg-blue-100 text-blue-800';
    case 'cancelled':
    case 'rejected':
      return 'bg-rose-100 text-rose-800';
    default:
      return 'bg-amber-100 text-amber-800';
  }
}

function Badge({ status }: { status: string }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusTone(status)}`}
    >
      {status}
    </span>
  );
}

function StatusSelect<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white font-bold text-[11px] capitalize focus:ring-2 focus:ring-maroon-950/20"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function Panel({
  title, subtitle, children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display font-bold text-lg text-maroon-950">{title}</h3>
        {subtitle && <span className="text-xs text-gray-400 font-medium">{subtitle}</span>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="p-12 text-center">
      <AlertCircle size={30} className="text-gray-300 mx-auto mb-3" />
      <p className="text-sm font-bold text-gray-600">{label}</p>
    </div>
  );
}

const TH = 'p-4 text-left';
const THEAD =
  'bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-amber-100';

export default function AdminPanelPage() {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('orders');

  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [bookings, setBookings] = useState<DBArtistBooking[]>([]);
  const [artistApps, setArtistApps] = useState<DBArtistApplication[]>([]);
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [pincodes, setPincodes] = useState<DBDeliverablePincode[]>(STATIC_PINCODES);
  const [suppliers, setSuppliers] = useState<DBSupplierApplication[]>([]);
  const [enrollments, setEnrollments] = useState<DBAcademyEnrollment[]>([]);
  const [jobApps, setJobApps] = useState<DBJobApplication[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rentals, setRentals] = useState<DBRentalBooking[]>([]);
  const [settings, setSettings] = useState<DBAppSetting[]>([]);
  const [savingSetting, setSavingSetting] = useState<string | null>(null);

  const [newPinCode, setNewPinCode] = useState('');
  const [newPinCity, setNewPinCity] = useState('');
  const [newPinDays, setNewPinDays] = useState('2');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT);
  const [savingProduct, setSavingProduct] = useState(false);
  const [teamFor, setTeamFor] = useState<string | null>(null);
  const [viewingApplication, setViewingApplication] = useState<DBArtistApplication | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const artists = useMemo(() => users.filter((u) => u.role === 'artist'), [users]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [o, b, aa, p, pin, s, e, j, u, r, cfg] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('artist_bookings').select('*').order('event_date', { ascending: true }),
      supabase.from('artist_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('deliverable_pincodes').select('*').order('pincode', { ascending: true }),
      supabase.from('supplier_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('academy_enrollments').select('*').order('created_at', { ascending: false }),
      supabase.from('job_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('rental_bookings').select('*').order('start_date', { ascending: true }),
      supabase.from('app_settings').select('*').order('key', { ascending: true }),
    ]);

    // Filter out missing table errors (PGRST205/42P01) for optional auxiliary tables so missing secondary tables don't block the UI
    const isMissingTable = (err: { code?: string } | null) =>
      err?.code === 'PGRST205' || err?.code === '42P01';
    const coreError = [o, b, p].find((r) => r.error && !isMissingTable(r.error))?.error;
    const secondaryError = [aa, pin, s, e, j, u, r, cfg].find((x) => x.error && !isMissingTable(x.error))?.error;
    
    if (coreError || secondaryError) {
      setError(friendlyError(coreError || secondaryError));
    }

    setOrders((o.data as DBOrder[]) ?? []);
    setBookings((b.data as DBArtistBooking[]) ?? []);
    setArtistApps((aa.data as DBArtistApplication[]) ?? []);
    setProducts((p.data as DBProduct[]) ?? []);
    if (pin.data && pin.data.length > 0) {
      setPincodes(pin.data as DBDeliverablePincode[]);
    }
    setSuppliers((s.data as DBSupplierApplication[]) ?? []);
    setEnrollments((e.data as DBAcademyEnrollment[]) ?? []);
    setJobApps((j.data as DBJobApplication[]) ?? []);
    setUsers((u.data as UserProfile[]) ?? []);
    setRentals((r.data as DBRentalBooking[]) ?? []);
    setSettings((cfg.data as DBAppSetting[]) ?? []);
    setLoading(false);
  }, []);

  const [newNotification, setNewNotification] = useState<string | null>(null);

  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {
      // Browser blocked autoplay audio; the visual alert still fires.
    }
  };

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel('admin-live-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          playChime();
          const newOrder = payload.new as DBOrder;
          setNewNotification(`🛍️ NEW ORDER: ₹${newOrder.total_amount?.toLocaleString()} from ${newOrder.customer_name} (${newOrder.customer_phone})`);
          setOrders((prev) => [newOrder, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'artist_bookings' },
        (payload) => {
          playChime();
          const newBooking = payload.new as DBArtistBooking;
          setNewNotification(`👑 NEW SAFA ARTIST BOOKING: ${newBooking.customer_name} for ${newBooking.city_venue}`);
          setBookings((prev) => [newBooking, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  /** Optimistic row update that rolls back and surfaces the error on failure. */
  async function patchRow<T extends { id: string }>(
    table: string,
    id: string,
    patch: Partial<T>,
    setRows: React.Dispatch<React.SetStateAction<T[]>>
  ) {
    let previous: T[] = [];
    setRows((prev) => {
      previous = prev;
      return prev.map((row) => (row.id === id ? { ...row, ...patch } : row));
    });

    const { error: updateErr } = await supabase
      .from(table)
      .update(patch as Record<string, unknown>)
      .eq('id', id);
    if (updateErr) {
      setRows(previous);
      setError(friendlyError(updateErr));
    } else {
      setError(null);
    }
  }

  /**
   * Approving an artist application is the ONLY thing that should grant
   * /artist-portal access — signup itself only ever creates a 'customer'
   * account now (see AuthModal.tsx). So approval here also flips that
   * applicant's own profiles.role to 'artist'; rejecting or reverting to
   * pending does not touch it (an already-approved artist keeps portal
   * access even if a later application is marked rejected/pending, since
   * that's a separate, deliberate admin action on the role dropdown itself).
   */
  async function updateArtistApplicationStatus(
    application: DBArtistApplication,
    status: DBArtistApplication['status']
  ) {
    if (status === 'approved' && !application.user_id) {
      setError(
        `${application.full_name}'s application has no linked account (they applied signed out) — ` +
          'ask them to sign in and re-apply before approving.'
      );
      return;
    }

    await patchRow<DBArtistApplication>('artist_applications', application.id, { status }, setArtistApps);

    if (status === 'approved' && application.user_id) {
      await patchRow<UserProfile>('profiles', application.user_id, { role: 'artist' }, setUsers);

      // Mirrors on_artist_application_approved() in supabase/016_client_update.sql —
      // done here too (not just relying on that DB trigger) so approval works
      // correctly even on a project where that migration was never applied.
      // This is exactly what left an already-approved artist (Nakul Joshi)
      // invisible on /artists: the trigger never ran, so no artist_profiles
      // row existed for the public listing to show.
      const { error: profileErr } = await supabase.from('artist_profiles').upsert(
        {
          id: application.user_id,
          display_name: application.full_name,
          phone: application.phone,
          phone_alt: application.phone_alt || null,
          whatsapp_number: application.whatsapp_number || null,
          upi_id: application.upi_id || null,
          photo_url: application.photo_url || null,
          base_city: application.city,
          safas_per_day: Math.max(1, (application.team_size || 1) * 50),
          per_safa_rate: application.per_safa_rate ?? 50,
          team_size: application.team_size || 1,
          max_travel_km: application.max_travel_km ?? 50,
          specialties: application.specialties ?? [],
          experience_years: application.experience_years ?? 1,
          portfolio_link: application.portfolio_link || null,
          verified: true,
          active: true,
        },
        { onConflict: 'id' }
      );
      if (profileErr) setError(friendlyError(profileErr));
    }
  }

  /**
   * Order status changes affect how many of a SKU the web has "committed" —
   * cancelling one frees stock back up. Fires a best-effort push to the
   * desktop POS afterward (see /api/sync/resync-order) so its own
   * availability figure doesn't stay stale after an admin cancels an order.
   */
  const updateOrderStatus = async (orderId: string, status: DBOrder['status']) => {
    await patchRow<DBOrder>('orders', orderId, { status }, setOrders);
    fetch('/api/sync/resync-order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId }),
    }).catch(() => {
      /* best-effort — the order status change itself already succeeded */
    });
  };

  const assignArtist = async (bookingId: string, artistId: string) => {
    if (!artistId) return;
    const artist = artists.find((a) => a.id === artistId);
    await patchRow<DBArtistBooking>(
      'artist_bookings',
      bookingId,
      { artist_id: artistId, artist_name: artist?.full_name ?? null, status: 'assigned' },
      setBookings
    );
  };

  const saveSetting = async (key: string, raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      setError('Setting value must be a non-negative number.');
      return;
    }
    setSavingSetting(key);
    setError(null);

    const { error: updateErr } = await supabase
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (updateErr) setError(friendlyError(updateErr));
    else setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));

    setSavingSetting(null);
  };

  const assignRentalArtist = async (rentalId: string, artistId: string) => {
    const artist = artists.find((a) => a.id === artistId);
    await patchRow<DBRentalBooking>(
      'rental_bookings',
      rentalId,
      { artist_id: artistId || null, artist_name: artist?.full_name ?? null },
      setRentals
    );
  };

  // ---- Products CRUD -------------------------------------------------------
  const openProductEditor = (product?: DBProduct) => {
    if (product) {
      setEditingProduct(product.id);
      setProductForm({
        name: product.name ?? '',
        code: product.code ?? '',
        price: String(product.price ?? ''),
        original_price: String(product.original_price ?? ''),
        category: product.category ?? '',
        color: product.color ?? '',
        fabric: product.fabric ?? '',
        style: product.style ?? '',
        occasion: product.occasion ?? '',
        image: product.image ?? '',
        description: product.description ?? '',
        stock: String(product.stock ?? 0),
        is_bestseller: !!product.is_bestseller,
        is_new: !!product.is_new,
        featured: !!(product as DBProduct & { featured?: boolean }).featured,
        active: product.active !== false,
        is_rentable: !!(product as DBProduct & { is_rentable?: boolean }).is_rentable,
        rent_price_per_day: String(
          (product as DBProduct & { rent_price_per_day?: number }).rent_price_per_day ?? ''
        ),
        rent_deposit: String(
          (product as DBProduct & { rent_deposit?: number }).rent_deposit ?? ''
        ),
      });
    } else {
      setEditingProduct('new');
      setProductForm(EMPTY_PRODUCT);
    }
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    setError(null);

    const payload = {
      name: productForm.name.trim(),
      code: productForm.code.trim() || null,
      price: Number(productForm.price) || 0,
      original_price: productForm.original_price ? Number(productForm.original_price) : null,
      category: productForm.category.trim() || null,
      color: productForm.color.trim() || null,
      fabric: productForm.fabric.trim() || null,
      style: productForm.style.trim() || null,
      occasion: productForm.occasion.trim() || null,
      image: productForm.image.trim() || null,
      description: productForm.description.trim() || null,
      stock: Number(productForm.stock) || 0,
      is_bestseller: productForm.is_bestseller,
      is_new: productForm.is_new,
      featured: productForm.featured,
      active: productForm.active,
      is_rentable: productForm.is_rentable,
      rent_price_per_day: productForm.rent_price_per_day
        ? Number(productForm.rent_price_per_day)
        : null,
      rent_deposit: productForm.rent_deposit ? Number(productForm.rent_deposit) : null,
      // Any manual save counts as the admin having reviewed it — clears the
      // "new from desktop, needs review" flag whether or not this row came
      // from a sync (a no-op for ordinary products).
      pending_sync: false,
    };

    const query =
      editingProduct === 'new'
        ? supabase.from('products').insert(payload).select().single()
        : supabase.from('products').update(payload).eq('id', editingProduct!).select().single();

    const { data, error: saveErr } = await query;
    setSavingProduct(false);

    if (saveErr || !data) {
      setError(friendlyError(saveErr));
      return;
    }

    const saved = data as DBProduct;
    setProducts((prev) =>
      editingProduct === 'new'
        ? [...prev, saved]
        : prev.map((p) => (p.id === saved.id ? saved : p))
    );
    setEditingProduct(null);
  };

  const toggleProductSelected = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pendingProducts = products.filter((p) => p.pending_sync);

  const toggleSelectAllPending = () => {
    setSelectedProductIds((prev) =>
      prev.size === pendingProducts.length ? new Set() : new Set(pendingProducts.map((p) => p.id))
    );
  };

  /**
   * Publishes every selected product as-is (whatever price/stock is already
   * on the row — desktop's price by default, 0 stock, from the sync
   * backfill). Admins who want to adjust a specific one first should edit it
   * individually before selecting it here.
   */
  const bulkApproveSelected = async () => {
    if (selectedProductIds.size === 0) return;
    setBulkApproving(true);
    setError(null);

    const ids = [...selectedProductIds];
    const { error: updateErr } = await supabase
      .from('products')
      .update({ active: true, pending_sync: false })
      .in('id', ids);

    setBulkApproving(false);

    if (updateErr) {
      setError(friendlyError(updateErr));
      return;
    }

    setProducts((prev) =>
      prev.map((p) => (selectedProductIds.has(p.id) ? { ...p, active: true, pending_sync: false } : p))
    );
    setSelectedProductIds(new Set());
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    const { error: deleteErr } = await supabase.from('products').delete().eq('id', id);
    if (deleteErr) {
      setError(friendlyError(deleteErr));
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total_amount, 0);
  const pendingSuppliers = suppliers.filter((s) => s.status === 'pending').length;

  const handleAddPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = newPinCode.replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length !== 6 || !newPinCity) return;

    const newObj: DBDeliverablePincode = {
      id: `pin-${Date.now()}`,
      pincode: cleanPin,
      city_state: newPinCity.trim(),
      estimated_days: Number(newPinDays) || 2,
      active: true,
    };

    setPincodes((prev) => [newObj, ...prev]);

    try {
      await supabase.from('deliverable_pincodes').insert([
        {
          pincode: cleanPin,
          city_state: newPinCity.trim(),
          estimated_days: Number(newPinDays) || 2,
          active: true,
        },
      ]);
    } catch (err) {
      console.warn('Pincode insert warning:', err);
    }

    setNewPinCode('');
    setNewPinCity('');
  };

  const handleDeletePincode = async (id: string, pincode: string) => {
    setPincodes((prev) => prev.filter((p) => p.id !== id && p.pincode !== pincode));
    try {
      await supabase.from('deliverable_pincodes').delete().eq('pincode', pincode);
    } catch (err) {
      console.warn('Pincode delete warning:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg border-b border-royal-400/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="w-10 h-10 rounded-full bg-royal-gradient flex items-center justify-center shadow-md"
              >
                <Crown size={20} className="text-maroon-950" />
              </Link>
              <div>
                <h1 className="font-display font-black text-xl text-royal-100 uppercase tracking-widest leading-none">
                  SafaKing Admin Control
                </h1>
                <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                  {profile?.full_name || 'Master Operations & Logistics'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="hidden sm:flex items-center gap-1.5 text-xs text-royal-200/70 hover:text-royal-300 font-bold uppercase tracking-wider"
              >
                <ArrowLeft size={14} /> Back to Main Site
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-royal-100 font-bold uppercase tracking-wider transition-colors"
              >
                <LogOut size={14} /> Exit Admin
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {error && (
          <div className="flex items-start gap-2 p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
              <X size={14} />
            </button>
          </div>
        )}

        {newNotification && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-royal-100 border border-royal-300 text-maroon-950 font-bold shadow-lg animate-pulse">
            <span className="text-lg">🔔</span>
            <p className="text-xs leading-relaxed flex-1">{newNotification}</p>
            <button onClick={() => setNewNotification(null)} className="text-maroon-800 hover:text-maroon-950 p-1">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            {
              label: 'Total Sales Revenue',
              value: `₹${totalRevenue.toLocaleString()}`,
              icon: TrendingUp,
              tone: 'bg-royal-100 text-royal-800',
            },
            {
              label: 'Orders',
              value: orders.length,
              icon: ShoppingBag,
              tone: 'bg-amber-100 text-amber-800',
            },
            {
              label: 'Artist Bookings',
              value: bookings.length,
              icon: Calendar,
              tone: 'bg-emerald-100 text-emerald-800',
            },
            {
              label: 'Suppliers Pending',
              value: pendingSuppliers,
              icon: Package,
              tone: 'bg-indigo-100 text-indigo-800',
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="p-6 rounded-3xl bg-white border border-amber-200/60 shadow-sm flex items-center gap-5"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${metric.tone}`}>
                <metric.icon size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  {metric.label}
                </p>
                <p className="text-2xl font-display font-black text-maroon-950 mt-0.5">
                  {loading ? '—' : metric.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-amber-200/70 mb-8 overflow-x-auto gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'border-maroon-950 text-maroon-950 bg-white rounded-t-2xl shadow-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-16 text-center bg-white rounded-3xl border border-amber-200/60">
            <Loader2 size={30} className="text-amber-500 mx-auto mb-3 animate-spin" />
            <p className="text-sm font-bold text-gray-600">Loading control data…</p>
          </div>
        ) : (
          <>
            {/* ---- ORDERS ---- */}
            {activeTab === 'orders' && (
              <Panel title="Fulfilment & Orders" subtitle="Change a status to update it live">
                {orders.length === 0 ? (
                  <Empty label="No orders yet." />
                ) : (
                  <table className="w-full text-left">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Customer</th>
                        <th className={TH}>Phone</th>
                        <th className={TH}>Shipping Address</th>
                        <th className={TH}>Payment (Split)</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-xs">
                      {orders.map((order) => {
                        const adv = order.advance_amount ?? Math.round(order.total_amount * 0.5);
                        const bal = order.balance_amount ?? (order.total_amount - adv);
                        const isFullyPaid = order.payment_status === 'fully_paid';

                        return (
                          <tr key={order.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="p-4 font-bold text-maroon-950">{order.customer_name}</td>
                            <td className="p-4 text-gray-600">{order.customer_phone}</td>
                            <td className="p-4 text-gray-600 max-w-xs">{order.shipping_address}</td>
                            <td className="p-4">
                              <span className="font-bold text-maroon-950">Total: ₹{order.total_amount.toLocaleString()}</span>
                              <div className="text-[10px] space-y-0.5 mt-0.5">
                                <span className="block text-emerald-700 font-bold">⚡ Advance: ₹{adv.toLocaleString()} (Paid)</span>
                                <span className={`block font-bold ${isFullyPaid ? 'text-emerald-700' : 'text-amber-800'}`}>
                                  📦 Balance: ₹{bal.toLocaleString()} ({isFullyPaid ? 'Collected ✓' : 'Due on Delivery'})
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge status={order.status} />
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                  <StatusSelect
                                    value={order.status}
                                    options={ORDER_STATUSES}
                                    onChange={(status) => updateOrderStatus(order.id, status)}
                                  />
                                  <a
                                    href={getWhatsAppClickLink(
                                      order.customer_phone,
                                      `Hello ${order.customer_name}, regarding your SafaKing order #${order.id.slice(0, 8).toUpperCase()} (₹${order.total_amount}):`
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[10px] flex items-center gap-1 transition-colors"
                                    title="Chat on WhatsApp"
                                  >
                                    💬
                                  </a>
                                </div>
                                {!isFullyPaid && (
                                  <button
                                    onClick={() =>
                                      patchRow<DBOrder>(
                                        'orders',
                                        order.id,
                                        { payment_status: 'fully_paid' },
                                        setOrders
                                      )
                                    }
                                    className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider text-center transition-colors"
                                  >
                                    Mark Balance Paid ✓
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Panel>
            )}

            {/* ---- BOOKINGS ---- */}
            {activeTab === 'bookings' && (
              <Panel
                title="Artist Booking Dispatch"
                subtitle={
                  artists.length === 0
                    ? 'No artists registered yet — an artist must sign up first'
                    : `${artists.length} artist${artists.length === 1 ? '' : 's'} available`
                }
              >
                {bookings.length === 0 ? (
                  <Empty label="No bookings yet." />
                ) : (
                  <table className="w-full text-left">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Client</th>
                        <th className={TH}>Event Date</th>
                        <th className={TH}>City / Venue</th>
                        <th className={TH}>Safa Style</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Assign Artist</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-xs">
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="p-4 font-bold text-maroon-950">
                            {booking.customer_name}
                            <br />
                            <span className="text-[10px] text-gray-400 font-normal">
                              {booking.customer_phone}
                            </span>
                          </td>
                          <td className="p-4 text-gray-700 font-medium">{booking.event_date}</td>
                          <td className="p-4 text-gray-700">{booking.city_venue}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-royal-100 text-royal-800 text-[10px] font-bold rounded-full uppercase">
                              {booking.safa_style}
                            </span>
                          </td>
                          <td className="p-4">
                            <Badge status={booking.status} />
                          </td>
                          <td className="p-4">
                            <select
                              value={booking.artist_id ?? ''}
                              onChange={(e) => assignArtist(booking.id, e.target.value)}
                              disabled={artists.length === 0}
                              className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white font-bold text-[11px] focus:ring-2 focus:ring-maroon-950/20 disabled:opacity-50"
                            >
                              <option value="">Unassigned</option>
                              {artists.map((artist) => (
                                <option key={artist.id} value={artist.id}>
                                  {artist.full_name || artist.email}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            )}

            {/* ---- ARTIST APPLICATIONS ---- */}
            {activeTab === 'artist_apps' && (
              <Panel title="Safa Artist Applications" subtitle="Review artist credentials & approve for wedding dispatches">
                {artistApps.length === 0 ? (
                  <Empty label="No artist applications received yet." />
                ) : (
                  <table className="w-full text-left">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Artist Name</th>
                        <th className={TH}>Phone</th>
                        <th className={TH}>Base City & Exp</th>
                        <th className={TH}>Specialties</th>
                        <th className={TH}>Team & Rate</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-xs">
                      {artistApps.map((artist) => (
                        <tr key={artist.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="p-4 font-bold text-maroon-950">
                            {artist.full_name}
                            {artist.portfolio_link && (
                              <a
                                href={artist.portfolio_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-[10px] text-royal-700 underline font-normal mt-0.5"
                              >
                                View Portfolio ↗
                              </a>
                            )}
                          </td>
                          <td className="p-4 text-gray-700 font-medium">
                            <a href={`tel:${artist.phone}`} className="hover:underline">
                              {artist.phone}
                            </a>
                          </td>
                          <td className="p-4 text-gray-700">
                            <span className="font-bold">{artist.city}</span>
                            <span className="block text-[10px] text-gray-400">
                              {artist.experience_years} yrs exp
                            </span>
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {(artist.specialties || []).map((spec) => (
                                <span
                                  key={spec}
                                  className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[9px] font-bold uppercase"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-gray-700 font-medium">
                            <span>Crew: {artist.team_size}</span>
                            {artist.per_safa_rate && (
                              <span className="block text-[10px] font-bold text-gradient-gold">
                                ₹{artist.per_safa_rate}/safa
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <Badge status={artist.status} />
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setViewingApplication(artist)}
                                className="px-2 py-1 rounded-xl bg-royal-100 hover:bg-royal-200 text-maroon-900 font-bold text-[10px] transition-colors"
                              >
                                Details
                              </button>
                              <StatusSelect
                                value={artist.status}
                                options={['pending', 'approved', 'rejected']}
                                onChange={(status) => updateArtistApplicationStatus(artist, status)}
                              />
                              <a
                                href={getWhatsAppClickLink(
                                  artist.phone,
                                  `Hello ${artist.full_name}, regarding your SafaKing Safa Artist application:`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[10px] transition-colors"
                              >
                                💬
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            )}

            {/* ---- PINCODES ---- */}
            {activeTab === 'pincodes' && (
              <div className="space-y-6">
                <Panel title="Add Deliverable Pincode" subtitle="Add new Indian pincodes for deliverability checks">
                  <form onSubmit={handleAddPincode} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      required
                      type="text"
                      maxLength={6}
                      placeholder="6-Digit Pincode (e.g. 302001)"
                      value={newPinCode}
                      onChange={(e) => setNewPinCode(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold focus:ring-2 focus:ring-maroon-800/20 outline-none"
                    />
                    <input
                      required
                      type="text"
                      placeholder="City / Region (e.g. Jaipur, Rajasthan)"
                      value={newPinCity}
                      onChange={(e) => setNewPinCity(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold focus:ring-2 focus:ring-maroon-800/20 outline-none"
                    />
                    <input
                      required
                      type="number"
                      min={1}
                      max={14}
                      placeholder="Est. Delivery Days (e.g. 2)"
                      value={newPinDays}
                      onChange={(e) => setNewPinDays(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold focus:ring-2 focus:ring-maroon-800/20 outline-none"
                    />
                    <button
                      type="submit"
                      className="py-2.5 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus size={14} /> Add Pincode
                    </button>
                  </form>
                </Panel>

                <Panel title="Deliverable Service Areas" subtitle={`${pincodes.length} deliverable pincodes configured`}>
                  {pincodes.length === 0 ? (
                    <Empty label="No deliverable pincodes added yet." />
                  ) : (
                    <table className="w-full text-left">
                      <thead className={THEAD}>
                        <tr>
                          <th className={TH}>Pincode</th>
                          <th className={TH}>City & Region</th>
                          <th className={TH}>Est. Delivery</th>
                          <th className={TH}>Status</th>
                          <th className={TH}>Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 text-xs">
                        {pincodes.map((pin) => (
                          <tr key={pin.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="p-4 font-black text-maroon-950 font-mono text-sm">
                              {pin.pincode}
                            </td>
                            <td className="p-4 font-bold text-gray-700">{pin.city_state}</td>
                            <td className="p-4 text-gray-600 font-medium">
                              {pin.estimated_days || 2} Days
                            </td>
                            <td className="p-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                  pin.active !== false
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {pin.active !== false ? 'Active ✓' : 'Inactive'}
                              </span>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => handleDeletePincode(pin.id, pin.pincode)}
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                                title="Remove Pincode"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
              </div>
            )}

            {/* ---- PRODUCTS ---- */}
            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center gap-3 flex-wrap">
                  {selectedProductIds.size > 0 ? (
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200">
                      <span className="text-xs font-bold text-maroon-950">
                        {selectedProductIds.size} selected
                      </span>
                      <button
                        onClick={bulkApproveSelected}
                        disabled={bulkApproving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold rounded-xl text-[11px] uppercase tracking-wider transition-colors"
                      >
                        {bulkApproving ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Approving…
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={13} /> Approve &amp; Publish Selected
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedProductIds(new Set())}
                        className="text-[11px] font-bold text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <div />
                  )}
                  <button
                    onClick={() => openProductEditor()}
                    className="flex items-center gap-2 px-5 py-3 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-2xl text-xs uppercase tracking-widest shadow-lg transition-colors"
                  >
                    <Plus size={15} /> New Product
                  </button>
                </div>

                <Panel
                  title="Catalogue"
                  subtitle={
                    products.some((p) => p.pending_sync)
                      ? `${products.length} products · ${products.filter((p) => p.pending_sync).length} new from desktop, needs review`
                      : `${products.length} products`
                  }
                >
                  {products.length === 0 ? (
                    <Empty label="No products yet — add one, or run supabase/seed.sql." />
                  ) : (
                    <table className="w-full text-left">
                      <thead className={THEAD}>
                        <tr>
                          <th className={TH}>
                            {pendingProducts.length > 0 && (
                              <input
                                type="checkbox"
                                checked={selectedProductIds.size === pendingProducts.length}
                                onChange={toggleSelectAllPending}
                                className="accent-maroon-900"
                                aria-label="Select all pending review"
                              />
                            )}
                          </th>
                          <th className={TH}>Product</th>
                          <th className={TH}>Code</th>
                          <th className={TH}>Price</th>
                          <th className={TH}>Stock</th>
                          <th className={TH}>Flags</th>
                          <th className={TH}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 text-xs">
                        {products.map((product) => (
                          <tr key={product.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="p-4">
                              <input
                                type="checkbox"
                                checked={selectedProductIds.has(product.id)}
                                onChange={() => toggleProductSelected(product.id)}
                                className="accent-maroon-900"
                                aria-label={`Select ${product.name}`}
                              />
                            </td>
                            <td className="p-4 font-bold text-maroon-950 max-w-xs">
                              {product.pending_sync && (
                                <span className="inline-block mb-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider">
                                  New from Desktop — Review
                                </span>
                              )}
                              {product.name}
                              <span className="block text-[10px] text-gray-400 font-normal">
                                {product.category} · {product.fabric}
                              </span>
                            </td>
                            <td className="p-4 text-gray-500 font-mono text-[11px]">{product.code}</td>
                            <td className="p-4 font-black text-gradient-gold">
                              ₹{product.price.toLocaleString()}
                              {product.desktop_price != null && product.desktop_price !== product.price && (
                                <span className="block text-[10px] font-bold text-amber-700 normal-case">
                                  Desktop: ₹{product.desktop_price.toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <span
                                className={`font-bold ${
                                  product.stock > 0 ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {product.stock}
                              </span>
                            </td>
                            <td className="p-4 space-x-1">
                              {product.active === false && <Badge status="inactive" />}
                              {product.is_bestseller && (
                                <span className="px-2 py-0.5 rounded-full bg-royal-100 text-royal-800 text-[10px] font-bold uppercase">
                                  Bestseller
                                </span>
                              )}
                              {product.is_new && (
                                <span className="px-2 py-0.5 rounded-full bg-maroon-100 text-maroon-900 text-[10px] font-bold uppercase">
                                  New
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openProductEditor(product)}
                                  className="p-2 rounded-lg bg-royal-100 text-royal-800 hover:bg-royal-200 transition-colors"
                                  aria-label={`Edit ${product.name}`}
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  onClick={() => deleteProduct(product.id, product.name)}
                                  className="p-2 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors"
                                  aria-label={`Delete ${product.name}`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
              </div>
            )}

            {/* ---- SUPPLIERS ---- */}
            {activeTab === 'suppliers' && (
              <Panel title="Supplier Network Submissions">
                {suppliers.length === 0 ? (
                  <Empty label="No supplier applications yet." />
                ) : (
                  <table className="w-full text-left">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Business</th>
                        <th className={TH}>Contact</th>
                        <th className={TH}>Phone / Email</th>
                        <th className={TH}>City</th>
                        <th className={TH}>Category</th>
                        <th className={TH}>Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-xs">
                      {suppliers.map((supplier) => (
                        <tr key={supplier.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="p-4 font-bold text-maroon-950">{supplier.business_name}</td>
                          <td className="p-4 text-gray-700">{supplier.contact_name}</td>
                          <td className="p-4 text-gray-600">
                            {supplier.phone}
                            <span className="block text-[10px] text-gray-400">{supplier.email}</span>
                          </td>
                          <td className="p-4 text-gray-700">{supplier.city}</td>
                          <td className="p-4 text-gray-700">{supplier.category}</td>
                          <td className="p-4">
                            <StatusSelect
                              value={supplier.status}
                              options={APPLICATION_STATUSES}
                              onChange={(status) =>
                                patchRow<DBSupplierApplication>(
                                  'supplier_applications', supplier.id, { status }, setSuppliers
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            )}

            {/* ---- ACADEMY ---- */}
            {activeTab === 'academy' && (
              <Panel title="Academy Enrollment Requests">
                {enrollments.length === 0 ? (
                  <Empty label="No enrollment requests yet." />
                ) : (
                  <table className="w-full text-left">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Applicant</th>
                        <th className={TH}>Phone</th>
                        <th className={TH}>City</th>
                        <th className={TH}>Centre</th>
                        <th className={TH}>Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-xs">
                      {enrollments.map((enrollment) => (
                        <tr key={enrollment.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="p-4 font-bold text-maroon-950">{enrollment.full_name}</td>
                          <td className="p-4 text-gray-600">{enrollment.phone}</td>
                          <td className="p-4 text-gray-700">{enrollment.city}</td>
                          <td className="p-4 text-gray-700 capitalize">{enrollment.center}</td>
                          <td className="p-4">
                            <StatusSelect
                              value={enrollment.status}
                              options={ENROLLMENT_STATUSES}
                              onChange={(status) =>
                                patchRow<DBAcademyEnrollment>(
                                  'academy_enrollments', enrollment.id, { status }, setEnrollments
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            )}

            {/* ---- CAREERS ---- */}
            {activeTab === 'careers' && (
              <Panel title="Job Applications">
                {jobApps.length === 0 ? (
                  <Empty label="No job applications yet." />
                ) : (
                  <table className="w-full text-left">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Applicant</th>
                        <th className={TH}>Role Applied</th>
                        <th className={TH}>Contact</th>
                        <th className={TH}>Experience</th>
                        <th className={TH}>Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-xs">
                      {jobApps.map((application) => (
                        <tr key={application.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="p-4 font-bold text-maroon-950">
                            {application.full_name}
                            <span className="block text-[10px] text-gray-400 font-normal">
                              {application.city}
                            </span>
                          </td>
                          <td className="p-4 text-gray-700">{application.job_title}</td>
                          <td className="p-4 text-gray-600">
                            {application.phone}
                            <span className="block text-[10px] text-gray-400">
                              {application.email}
                            </span>
                          </td>
                          <td className="p-4 text-gray-700">{application.experience || '—'}</td>
                          <td className="p-4">
                            <StatusSelect
                              value={application.status}
                              options={JOB_STATUSES}
                              onChange={(status) =>
                                patchRow<DBJobApplication>(
                                  'job_applications', application.id, { status }, setJobApps
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            )}

            {/* ---- RENTALS ---- */}
            {activeTab === 'rentals' && (
              <Panel
                title="Rental Bookings"
                subtitle={`${rentals.filter((r) => r.status === 'pending').length} awaiting confirmation`}
              >
                {rentals.length === 0 ? (
                  <Empty label="No rentals yet." />
                ) : (
                  <table className="w-full text-left">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Customer</th>
                        <th className={TH}>Dates</th>
                        <th className={TH}>Venue</th>
                        <th className={TH}>Safas</th>
                        <th className={TH}>Money</th>
                        <th className={TH}>Artist</th>
                        <th className={TH}>Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-xs">
                      {rentals.map((rental) => (
                        <tr key={rental.id} className="hover:bg-amber-50/30 transition-colors align-top">
                          <td className="p-4 font-bold text-maroon-950">
                            {rental.customer_name}
                            <a
                              href={getWhatsAppClickLink(
                                rental.customer_phone,
                                `Namaste ${rental.customer_name}, regarding your SafaKing rental ${rental.id.slice(0, 8).toUpperCase()}`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[10px] text-emerald-700 font-bold hover:underline mt-0.5"
                            >
                              {rental.customer_phone} · WhatsApp
                            </a>
                          </td>
                          <td className="p-4 text-gray-700">
                            {rental.start_date}
                            <span className="block text-[10px] text-gray-400">
                              to {rental.end_date} · {rental.rental_days}d
                            </span>
                          </td>
                          <td className="p-4 text-gray-700 max-w-[16rem]">
                            {rental.venue_address}
                            <span className="block text-[10px] text-gray-400">{rental.pincode}</span>
                          </td>
                          <td className="p-4 font-black text-maroon-900">{rental.safa_count}</td>
                          <td className="p-4">
                            <span className="font-black text-gradient-gold">
                              ₹{rental.total_amount.toLocaleString()}
                            </span>
                            <span className="block text-[10px] text-gray-500 mt-0.5">
                              rent ₹{rental.rent_amount.toLocaleString()} · dep ₹
                              {rental.deposit_amount.toLocaleString()}
                            </span>
                            <span className="block text-[10px] text-gray-500">
                              adv ₹{rental.advance_amount.toLocaleString()} · bal ₹
                              {rental.balance_amount.toLocaleString()}
                            </span>
                            <span
                              className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                rental.payment_status === 'advance_paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {rental.payment_status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-4">
                            {rental.needs_artist ? (
                              <>
                                <select
                                  value={rental.artist_id ?? ''}
                                  onChange={(e) => assignRentalArtist(rental.id, e.target.value)}
                                  disabled={artists.length === 0}
                                  className="px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white font-bold text-[11px] disabled:opacity-50"
                                >
                                  <option value="">Unassigned</option>
                                  {artists.map((artist) => (
                                    <option key={artist.id} value={artist.id}>
                                      {artist.full_name || artist.email}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => setTeamFor(rental.id)}
                                  className="block mt-1.5 px-2.5 py-1 rounded-lg bg-maroon-950 text-royal-300 text-[10px] font-bold uppercase tracking-wider"
                                  title="Build a crew for a large event"
                                >
                                  Team ({rental.safa_count})
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-bold">Not required</span>
                            )}
                          </td>
                          <td className="p-4">
                            <a
                              href={`/documents/booking/${rental.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[10px] font-bold text-royal-700 hover:underline mb-1.5"
                            >
                              Confirmation ↗
                            </a>
                            <StatusSelect
                              value={rental.status}
                              options={RENTAL_STATUSES}
                              onChange={(status) =>
                                patchRow<DBRentalBooking>(
                                  'rental_bookings', rental.id, { status }, setRentals
                                )
                              }
                            />
                            {rental.notes && (
                              <span className="block text-[10px] text-rose-600 font-bold mt-1 max-w-[12rem]">
                                {rental.notes}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            )}

            {/* ---- PRICING SETTINGS ---- */}
            {activeTab === 'settings' && (
              <Panel
                title="Pricing Settings"
                subtitle="Applied to every new rental and booking immediately"
              >
                {settings.length === 0 ? (
                  <Empty label="Settings table not found — run supabase/004_rentals.sql." />
                ) : (
                  <div className="divide-y divide-amber-100">
                    {settings.map((setting) => (
                      <div
                        key={setting.key}
                        className="p-6 flex flex-col sm:flex-row sm:items-center gap-4"
                      >
                        <div className="flex-1">
                          <p className="font-bold text-sm text-maroon-950">{setting.label}</p>
                          {setting.description && (
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                              {setting.description}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-400 font-mono mt-1">{setting.key}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            step="any"
                            defaultValue={setting.value}
                            onBlur={(e) => {
                              if (Number(e.target.value) !== setting.value) {
                                saveSetting(setting.key, e.target.value);
                              }
                            }}
                            className="w-32 px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:ring-2 focus:ring-maroon-950/20"
                          />
                          {savingSetting === setting.key && (
                            <Loader2 size={15} className="animate-spin text-amber-600" />
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="p-6 text-xs text-gray-500 leading-relaxed">
                      Changes save when you click away from a field. Existing rentals keep the
                      prices they were booked at — rental_items stores a snapshot per line.
                    </p>
                  </div>
                )}
              </Panel>
            )}

            {/* ---- VERIFICATION ---- */}
            {activeTab === 'verification' && <VerificationQueue />}

            {/* ---- BOOKING PROTECTION ---- */}
            {activeTab === 'protection' && <CancellationDesk />}

            {/* ---- ANALYTICS ---- */}
            {activeTab === 'analytics' && <AnalyticsPanel />}

            {/* ---- LIVE OPS ---- */}
            {activeTab === 'liveops' && <LiveOpsBoard />}

            {/* ---- TRAINING ACADEMY ---- */}
            {activeTab === 'training' && <TrainingManager />}

            {/* ---- CONTACT INBOX ---- */}
            {activeTab === 'payouts' && <PaymentReleaseQueue />}

            {/* ---- CONTACT INBOX ---- */}
            {activeTab === 'messages' && <ContactInbox />}

            {/* ---- USERS ---- */}
            {activeTab === 'users' && (
              <Panel
                title="Users & Roles"
                subtitle="Promote an artist or another administrator here"
              >
                {users.length === 0 ? (
                  <Empty label="No registered users yet." />
                ) : (
                  <table className="w-full text-left">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Name</th>
                        <th className={TH}>Email</th>
                        <th className={TH}>Phone</th>
                        <th className={TH}>City</th>
                        <th className={TH}>Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-xs">
                      {users.map((account) => (
                        <tr key={account.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="p-4 font-bold text-maroon-950">
                            {account.full_name || '—'}
                          </td>
                          <td className="p-4 text-gray-600">{account.email}</td>
                          <td className="p-4 text-gray-600">{account.phone || '—'}</td>
                          <td className="p-4 text-gray-600">{account.city || '—'}</td>
                          <td className="p-4">
                            {account.id === profile?.id ? (
                              <span className="text-[11px] font-bold text-gray-500">
                                {account.role} (you)
                              </span>
                            ) : (
                              <StatusSelect
                                value={account.role}
                                options={ROLES}
                                onChange={(role) =>
                                  patchRow<UserProfile>('profiles', account.id, { role }, setUsers)
                                }
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            )}
          </>
        )}
      </main>

      {teamFor && (
        <TeamBuilder
          rentalId={teamFor}
          onClose={() => setTeamFor(null)}
          onAssigned={fetchAll}
        />
      )}

      {/* Product editor */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-maroon-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.form
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            onSubmit={saveProduct}
            className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-maroon-950 px-7 py-5 flex items-center justify-between">
              <h3 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest">
                {editingProduct === 'new' ? 'New Product' : 'Edit Product'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(
                  [
                    ['name', 'Product Name', 'text', true],
                    ['code', 'Product Code', 'text', false],
                    ['price', 'Price (₹)', 'number', true],
                    ['original_price', 'Original Price (₹)', 'number', false],
                    ['stock', 'Stock Quantity', 'number', true],
                    ['category', 'Category (Groom / Jodhpuri / Bandhani)', 'text', false],
                    ['color', 'Colour', 'text', false],
                    ['fabric', 'Fabric', 'text', false],
                    ['style', 'Style', 'text', false],
                    ['occasion', 'Occasion', 'text', false],
                    ['rent_price_per_day', 'Rent per day (₹)', 'number', false],
                    ['rent_deposit', 'Refundable deposit (₹)', 'number', false],
                    ['image', 'Image path (e.g. /product-pink-chanderi.jpg)', 'text', false],
                  ] as const
                ).map(([key, label, type, required]) => (
                  <div key={key} className={key === 'image' ? 'sm:col-span-2' : ''}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      {label}
                    </label>
                    <input
                      type={type}
                      required={required}
                      value={productForm[key]}
                      onChange={(e) =>
                        setProductForm((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                />
              </div>

              <div className="flex flex-wrap gap-4">
                {(
                  [
                    ['active', 'Active (visible in shop)'],
                    ['is_rentable', 'Available to rent'],
                    ['featured', 'Featured on landing page'],
                    ['is_bestseller', 'Bestseller'],
                    ['is_new', 'New arrival'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm[key]}
                      onChange={(e) =>
                        setProductForm((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="accent-maroon-900"
                    />
                    <span className="text-xs font-bold text-gray-600">{label}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 border-2 border-amber-200 text-maroon-700 text-xs font-bold uppercase tracking-wider py-3.5 rounded-xl hover:bg-amber-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="flex-1 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-xs font-bold uppercase tracking-wider py-3.5 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  {savingProduct ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Save Product
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.form>
        </div>
      )}

      {/* Artist application details */}
      {viewingApplication && (
        <div className="fixed inset-0 z-50 bg-maroon-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-maroon-950 px-7 py-5 flex items-center justify-between">
              <h3 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest">
                Artist Application
              </h3>
              <button
                type="button"
                onClick={() => setViewingApplication(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-7 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl border-2 border-gray-200 overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center">
                  {viewingApplication.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={viewingApplication.photo_url}
                      alt={viewingApplication.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={28} className="text-gray-300" />
                  )}
                </div>
                <div>
                  <p className="font-display font-black text-xl text-maroon-950">
                    {viewingApplication.full_name}
                  </p>
                  <Badge status={viewingApplication.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    <Phone size={11} /> Primary Phone
                  </p>
                  <a href={`tel:${viewingApplication.phone}`} className="font-bold text-maroon-950 hover:underline">
                    {viewingApplication.phone}
                  </a>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    <Phone size={11} /> Alternate Phone
                  </p>
                  <p className="font-bold text-maroon-950">{viewingApplication.phone_alt || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    <MessageCircle size={11} /> WhatsApp
                  </p>
                  <p className="font-bold text-maroon-950">{viewingApplication.whatsapp_number || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    <Wallet size={11} /> UPI ID
                  </p>
                  <p className="font-bold text-maroon-950">{viewingApplication.upi_id || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    <MapPin size={11} /> Base City
                  </p>
                  <p className="font-bold text-maroon-950">{viewingApplication.city}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    <Navigation size={11} /> Max Travel
                  </p>
                  <p className="font-bold text-maroon-950">
                    {viewingApplication.max_travel_km ? `${viewingApplication.max_travel_km} km` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Experience</p>
                  <p className="font-bold text-maroon-950">{viewingApplication.experience_years} yrs</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Crew Size</p>
                  <p className="font-bold text-maroon-950">{viewingApplication.team_size}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Rate / Safa</p>
                  <p className="font-bold text-maroon-950">
                    {viewingApplication.per_safa_rate ? `₹${viewingApplication.per_safa_rate}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Applied</p>
                  <p className="font-bold text-maroon-950">
                    {viewingApplication.created_at
                      ? new Date(viewingApplication.created_at).toLocaleDateString('en-IN')
                      : '—'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Specialties</p>
                <div className="flex flex-wrap gap-1">
                  {(viewingApplication.specialties || []).map((spec) => (
                    <span
                      key={spec}
                      className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[9px] font-bold uppercase"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              {viewingApplication.portfolio_link && (
                <a
                  href={viewingApplication.portfolio_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-royal-700 underline font-bold"
                >
                  View Portfolio ↗
                </a>
              )}

              {!viewingApplication.user_id && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    No account linked to this application (applied while signed out) — approving
                    won&apos;t grant portal access until they sign in and re-apply.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <StatusSelect
                  value={viewingApplication.status}
                  options={['pending', 'approved', 'rejected']}
                  onChange={(status) => {
                    updateArtistApplicationStatus(viewingApplication, status);
                    setViewingApplication({ ...viewingApplication, status });
                  }}
                />
                <a
                  href={getWhatsAppClickLink(
                    viewingApplication.phone,
                    `Hello ${viewingApplication.full_name}, regarding your SafaKing Safa Artist application:`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[11px] transition-colors"
                >
                  💬 WhatsApp
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
