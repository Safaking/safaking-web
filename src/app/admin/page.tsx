'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Crown, ShoppingBag, Calendar, Users, Package, GraduationCap, Briefcase, MapPin,
  TrendingUp, Plus, Edit, Trash2, ArrowLeft, LogOut, AlertCircle, Loader2, X, Save,
  CalendarRange, SlidersHorizontal, ShieldCheck, ShieldAlert, Siren, Mail, Wallet,
  Phone, User, Navigation, MessageCircle, Search, ZoomIn, MessageSquareWarning,
  Camera, KeyRound,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  supabase, friendlyError,
  DBOrder, DBArtistBooking, DBArtistApplication, DBDeliverablePincode, DBSupplierApplication, DBAcademyEnrollment,
  DBJobApplication, DBProduct, DBRentalBooking, DBAppSetting, UserProfile, UserRole,
  PAYMENT_MODES, PAYMENT_MODE_LABEL,
} from '@/lib/supabase';
import { getWhatsAppClickLink } from '@/lib/whatsapp';
import { STATIC_PINCODES } from '@/lib/pincodes';
import { VerificationQueue } from '@/components/verification/VerificationQueue';
import { KycChaseList } from '@/components/verification/KycChaseList';
import { CancellationDesk } from '@/components/protection/CancellationDesk';
import { ReportsCentre } from '@/components/admin/ReportsCentre';
import { ExpenseLedger } from '@/components/admin/ExpenseLedger';
import { ComplaintsPanel } from '@/components/admin/ComplaintsPanel';
import { LiveOpsBoard } from '@/components/liveops/LiveOpsBoard';
import { LiveOpsMap } from '@/components/liveops/LiveOpsMap';
import { ArtistIncidentsPanel } from '@/components/liveops/ArtistIncidentsPanel';
import { SecurityCentre, useStaffSecurityGate } from '@/components/admin/SecurityCentre';
import { Department, DEPARTMENTS, DEPARTMENT_LABEL, DEPARTMENT_TABS, unitOf } from '@/lib/departments';
import {
  ArtistStanding, STANDING_LABEL, STANDING_ORDER, STANDING_TONE, INCIDENT_LABEL, IncidentKind, blocksWork,
} from '@/lib/artist-standing';
import { TrainingManager } from '@/components/admin/TrainingManager';
import { TeamBuilder } from '@/components/liveops/TeamBuilder';
import { ContactInbox } from '@/components/admin/ContactInbox';
import { PaymentReleaseQueue } from '@/components/admin/PaymentReleaseQueue';

type Tab =
  | 'orders' | 'rentals' | 'bookings' | 'artist_apps' | 'products'
  | 'pincodes' | 'suppliers' | 'academy' | 'careers' | 'users' | 'settings' | 'verification' | 'protection' | 'analytics' | 'liveops' | 'training' | 'messages' | 'payouts' | 'expenses' | 'complaints' | 'security';

const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'liveops', label: 'Live Ops', icon: Siren },
  { id: 'analytics', label: 'Reports', icon: TrendingUp },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'rentals', label: 'Rentals', icon: CalendarRange },
  { id: 'bookings', label: 'Artist Bookings', icon: Calendar },
  { id: 'artist_apps', label: 'Artist Applications', icon: Crown },
  { id: 'complaints', label: 'Complaints', icon: MessageSquareWarning },
  { id: 'verification', label: 'Verification', icon: ShieldCheck },
  { id: 'protection', label: 'Cancellations', icon: ShieldAlert },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'pincodes', label: 'Pincodes', icon: MapPin },
  { id: 'suppliers', label: 'Suppliers', icon: Briefcase },
  { id: 'academy', label: 'Academy Leads', icon: GraduationCap },
  { id: 'training', label: 'Training & Certificates', icon: GraduationCap },
  { id: 'careers', label: 'Job Applications', icon: Users },
  { id: 'payouts', label: 'Payment Release', icon: Wallet },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'messages', label: 'Messages', icon: Mail },
  { id: 'users', label: 'Users & Roles', icon: Users },
  { id: 'settings', label: 'Pricing Settings', icon: SlidersHorizontal },
  { id: 'security', label: 'Security', icon: KeyRound },
];

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
const APPLICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
const ENROLLMENT_STATUSES = ['pending', 'contacted', 'enrolled'] as const;
const JOB_STATUSES = ['pending', 'shortlisted', 'hired', 'rejected'] as const;
const RENTAL_STATUSES = [
  'pending', 'confirmed', 'dispatched', 'active', 'returned', 'completed', 'cancelled',
] as const;
const BOOKING_STATUSES = ['pending', 'offered', 'assigned', 'declined', 'completed', 'cancelled'] as const;
// 'manager' was built into the database and the panel but left out of this
// list, so nobody could actually be made a manager from the screen.
const ROLES: UserRole[] = ['customer', 'artist', 'manager', 'admin'];

/** Roles that get a staff photo and designation. */
const STAFF_ROLES_UI: UserRole[] = ['admin', 'manager'];

const DESIGNATIONS = [
  'Owner', 'Manager', 'Operations Coordinator', 'Accountant',
  'Sales Executive', 'Delivery Staff', 'Trainer',
];

interface ArtistDispatchProfile {
  id: string;
  display_name: string;
  base_city: string | null;
  service_pincodes: string[];
  verified: boolean;
  active: boolean;
  blacklisted: boolean;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected' | null;
  rating: number | null;
  total_events: number;
  /** Warning -> restriction -> review -> suspension (supabase/036). */
  standing?: ArtistStanding | null;
  restricted_until?: string | null;
}

/**
 * Traffic-light for an artist's rating: red when it's consistently poor,
 * orange when it's slipping, green otherwise. Only meaningful once they've
 * actually done events — a brand-new artist shows neutral.
 */
function ratingTone(rating: number | null, totalEvents: number): { cls: string; label: string } {
  if (!totalEvents || rating == null) return { cls: 'bg-gray-100 text-gray-500', label: 'New' };
  if (rating < 3) return { cls: 'bg-rose-100 text-rose-800', label: `${rating.toFixed(1)} ★ Poor` };
  if (rating < 4) return { cls: 'bg-orange-100 text-orange-800', label: `${rating.toFixed(1)} ★ Watch` };
  return { cls: 'bg-emerald-100 text-emerald-800', label: `${rating.toFixed(1)} ★` };
}

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
    case 'declined':
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
      className="px-3 py-1.5 rounded-xl border border-amber-200/70 bg-white font-bold text-[11px] capitalize focus:ring-2 focus:ring-maroon-950/20"
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
  title, subtitle, toolbar, children,
}: {
  title: string;
  subtitle?: string;
  /** Optional filter/search row, rendered between the title and the table. */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-amber-200/60 shadow-md shadow-amber-900/5 overflow-hidden">
      <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display font-bold text-lg text-maroon-950">{title}</h3>
        {subtitle && <span className="text-xs text-gray-400 font-medium">{subtitle}</span>}
      </div>
      {toolbar && <div className="px-6 pt-5">{toolbar}</div>}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

/**
 * Search + status-filter row shared by every list tab (Orders, Rentals,
 * Artist Bookings, Applications, Products, Suppliers, Academy, Careers,
 * Users). Pass `statusOptions` to include the status dropdown; omit it for
 * tabs with no editable/filterable status (e.g. Pincodes).
 */
function FilterBar({
  search, onSearchChange, searchPlaceholder,
  status, onStatusChange, statusOptions,
}: {
  search: string;
  onSearchChange: (next: string) => void;
  searchPlaceholder: string;
  status?: string;
  onStatusChange?: (next: string) => void;
  statusOptions?: readonly string[];
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-5">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-amber-200/70 bg-amber-50/30 text-xs font-medium focus:ring-2 focus:ring-maroon-950/20 focus:outline-none placeholder:text-gray-400"
        />
      </div>
      {statusOptions && onStatusChange && (
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-amber-200/70 bg-white font-bold text-[11px] capitalize focus:ring-2 focus:ring-maroon-950/20 shrink-0"
        >
          <option value="">All Statuses</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** True if `row` matches the current search text (across `searchFields`) and status filter. */
function matchesFilter<T extends object>(
  row: T,
  search: string,
  searchFields: (keyof T)[],
  status?: string,
  statusField?: keyof T
): boolean {
  const asRecord = row as Record<string, unknown>;
  if (status && statusField && String(asRecord[statusField as string] ?? '') !== status) return false;
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  return searchFields.some((field) => String(asRecord[field as string] ?? '').toLowerCase().includes(q));
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
  'bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-maroon-800/60 border-b border-amber-100';

export default function AdminPanelPage() {
  const { profile, logout, refreshProfile } = useAuth();
  // A manager gets the operational half of this panel; the admin gets all of
  // it, plus the say-so on anything a manager did.
  const isManager = profile?.role === 'manager';
  // Each manager sees their own department's part of the panel; the
  // database holds the same line (staff_can() in supabase/037).
  const staffUnit = unitOf(profile?.role, profile?.department);
  const managerTabs = useMemo(
    () => (staffUnit && staffUnit !== 'owner' ? (DEPARTMENT_TABS[staffUnit] as Tab[]) : []),
    [staffUnit]
  );
  const visibleTabs = isManager ? TABS.filter((t) => managerTabs.includes(t.id)) : TABS;
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const securityGate = useStaffSecurityGate(!!staffUnit);
  const [ackSaving, setAckSaving] = useState(false);
  const [ackSkipped, setAckSkipped] = useState(false);

  // A department without Orders opens on its own first tab, not a locked one.
  useEffect(() => {
    if (isManager && managerTabs.length && !managerTabs.includes(activeTab)) setActiveTab(managerTabs[0]);
  }, [isManager, managerTabs, activeTab]);

  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [bookings, setBookings] = useState<DBArtistBooking[]>([]);
  const [artistApps, setArtistApps] = useState<DBArtistApplication[]>([]);
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [pincodes, setPincodes] = useState<DBDeliverablePincode[]>(STATIC_PINCODES);
  const [suppliers, setSuppliers] = useState<DBSupplierApplication[]>([]);
  const [enrollments, setEnrollments] = useState<DBAcademyEnrollment[]>([]);
  const [jobApps, setJobApps] = useState<DBJobApplication[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [artistProfiles, setArtistProfiles] = useState<ArtistDispatchProfile[]>([]);
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
  // The application photo is the only look an admin gets at the person they
  // are about to let into people's weddings — a 80px thumbnail is not enough
  // to judge it, so it opens full size.
  const [zoomedPhoto, setZoomedPhoto] = useState<{ url: string; name: string } | null>(null);
  /** Latest check-in stage per job — 'assigned' says nothing about today. */
  const [jobStage, setJobStage] = useState<Record<string, { stage: string; at: string }>>({});
  /** Application waiting to be attached to an account (applied signed out). */
  const [linkingApp, setLinkingApp] = useState<DBArtistApplication | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  /** Staff member whose photo and designation are being edited. */
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  // Standing: the system suggests a level, a person decides it, with a note.
  const [standingFor, setStandingFor] = useState<{ profile: ArtistDispatchProfile; name: string } | null>(null);
  const [standingLevel, setStandingLevel] = useState<ArtistStanding>('good');
  const [standingUntil, setStandingUntil] = useState('');
  const [standingNote, setStandingNote] = useState('');
  const [standingInfo, setStandingInfo] = useState<{
    rec: { points: number; incidents: number; recommended: ArtistStanding } | null;
    incidents: { id: string; kind: IncidentKind; reason: string; points: number; created_at: string }[];
  }>({ rec: null, incidents: [] });
  const [standingSaving, setStandingSaving] = useState(false);
  const [standingError, setStandingError] = useState<string | null>(null);
  const [staffDesignation, setStaffDesignation] = useState('');
  const [staffPhoto, setStaffPhoto] = useState<File | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);
  const staffPhotoPreview = useMemo(
    () => (staffPhoto ? URL.createObjectURL(staffPhoto) : null),
    [staffPhoto]
  );
  useEffect(() => () => {
    if (staffPhotoPreview) URL.revokeObjectURL(staffPhotoPreview);
  }, [staffPhotoPreview]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const artists = useMemo(() => users.filter((u) => u.role === 'artist'), [users]);

  // Filter/search state — one {status, search} pair per list tab, applied via
  // matchesFilter() below. Status is empty string = "All Statuses".
  const [ordersFilter, setOrdersFilter] = useState({ status: '', search: '' });
  const [rentalsFilter, setRentalsFilter] = useState({ status: '', search: '' });
  const [bookingsFilter, setBookingsFilter] = useState({ status: '', search: '' });
  const [artistAppsFilter, setArtistAppsFilter] = useState({ status: '', search: '' });
  const [productsFilter, setProductsFilter] = useState({ status: '', search: '' });
  const [suppliersFilter, setSuppliersFilter] = useState({ status: '', search: '' });
  const [enrollmentsFilter, setEnrollmentsFilter] = useState({ status: '', search: '' });
  const [jobAppsFilter, setJobAppsFilter] = useState({ status: '', search: '' });
  const [usersFilter, setUsersFilter] = useState({ status: '', search: '' });
  const [pincodesSearch, setPincodesSearch] = useState('');

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesFilter(o, ordersFilter.search, ['customer_name', 'customer_phone', 'shipping_address'], ordersFilter.status, 'status')),
    [orders, ordersFilter]
  );
  const filteredRentals = useMemo(
    () => rentals.filter((r) => matchesFilter(r, rentalsFilter.search, ['customer_name', 'customer_phone', 'venue_address', 'pincode', 'city'], rentalsFilter.status, 'status')),
    [rentals, rentalsFilter]
  );
  const filteredBookings = useMemo(
    () => bookings.filter((b) => matchesFilter(b, bookingsFilter.search, ['customer_name', 'customer_phone', 'city_venue', 'artist_name'], bookingsFilter.status, 'status')),
    [bookings, bookingsFilter]
  );
  const filteredArtistApps = useMemo(
    () => artistApps.filter((a) => matchesFilter(a, artistAppsFilter.search, ['full_name', 'phone', 'city'], artistAppsFilter.status, 'status')),
    [artistApps, artistAppsFilter]
  );
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (productsFilter.status === 'active' && !p.active) return false;
      if (productsFilter.status === 'inactive' && p.active) return false;
      if (productsFilter.status === 'pending_sync' && !p.pending_sync) return false;
      return matchesFilter(p, productsFilter.search, ['name', 'code', 'category']);
    });
  }, [products, productsFilter]);
  const filteredSuppliers = useMemo(
    () => suppliers.filter((s) => matchesFilter(s, suppliersFilter.search, ['business_name', 'contact_name', 'phone', 'city'], suppliersFilter.status, 'status')),
    [suppliers, suppliersFilter]
  );
  const filteredEnrollments = useMemo(
    () => enrollments.filter((e) => matchesFilter(e, enrollmentsFilter.search, ['full_name', 'phone', 'city'], enrollmentsFilter.status, 'status')),
    [enrollments, enrollmentsFilter]
  );
  const filteredJobApps = useMemo(
    () => jobApps.filter((j) => matchesFilter(j, jobAppsFilter.search, ['full_name', 'city', 'job_title'], jobAppsFilter.status, 'status')),
    [jobApps, jobAppsFilter]
  );
  const filteredUsers = useMemo(
    () => users.filter((u) =>
      // The Artist Manager works with artists, not every customer's account.
      (staffUnit !== 'artist_ops' || u.role === 'artist')
      && matchesFilter(u, usersFilter.search, ['full_name', 'email', 'phone'], usersFilter.status, 'role')),
    [users, usersFilter, staffUnit]
  );
  const filteredPincodes = useMemo(
    () => pincodes.filter((p) => matchesFilter(p, pincodesSearch, ['pincode', 'city_state'])),
    [pincodes, pincodesSearch]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [o, b, aa, p, pin, s, e, j, u, r, cfg, ap, ck] = await Promise.all([
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
      supabase.from('artist_profiles').select('id, display_name, base_city, service_pincodes, verified, active, blacklisted, verification_status, rating, total_events, standing, restricted_until'),
      supabase.from('booking_checkins').select('rental_id, booking_id, stage, created_at').order('created_at', { ascending: false }),
    ]);

    // Filter out missing table errors (PGRST205/42P01) for optional auxiliary tables so missing secondary tables don't block the UI
    const isMissingTable = (err: { code?: string } | null) =>
      err?.code === 'PGRST205' || err?.code === '42P01';
    const coreError = [o, b, p].find((r) => r.error && !isMissingTable(r.error))?.error;
    const secondaryError = [aa, pin, s, e, j, u, r, cfg, ap, ck].find((x) => x.error && !isMissingTable(x.error))?.error;

    const stages: Record<string, { stage: string; at: string }> = {};
    for (const row of (ck.data ?? []) as { rental_id: string | null; booking_id: string | null; stage: string; created_at: string }[]) {
      const key = row.rental_id ?? row.booking_id;
      if (key && !stages[key]) stages[key] = { stage: row.stage, at: row.created_at };
    }
    setJobStage(stages);

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
    setArtistProfiles((ap.data as ArtistDispatchProfile[]) ?? []);
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

    // Rejections and un-approvals write straight through; an approval has to
    // earn the status first (below), because marking it approved and then
    // failing to build the profile leaves an artist who looks approved on
    // this screen, cannot be assigned, and never appears on /artists — which
    // is exactly the state one live application is in right now.
    if (status !== 'approved') {
      await patchRow<DBArtistApplication>('artist_applications', application.id, { status }, setArtistApps);
      return;
    }

    if (application.user_id) {
      // Profile row first, role second. The role flip is what unlocks the
      // portal — doing it before the artist_profiles upsert meant a failed
      // upsert left an artist with portal access but no profile row (no
      // public listing, portfolio inserts failing on the FK, blank ID card).

      // Mirrors on_artist_application_approved() in supabase/016_client_update.sql —
      // done here too (not just relying on that DB trigger) so approval works
      // correctly even on a project where that migration was never applied.
      // This is exactly what left an already-approved artist (Nakul Joshi)
      // invisible on /artists: the trigger never ran, so no artist_profiles
      // row existed for the public listing to show.
      const { data: newProfile, error: profileErr } = await supabase.from('artist_profiles').upsert(
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
      ).select('id, display_name, base_city, service_pincodes, verified, active, blacklisted, verification_status, rating, total_events, standing, restricted_until').single();
      if (profileErr) {
        setError(
          `Could not create ${application.full_name}'s artist profile, so the application has NOT ` +
            `been approved: ${friendlyError(profileErr)}`
        );
        return;
      }

      // Keep the loaded roster in step with what was just created. Without
      // this the row keeps showing "no profile — fix now" against a profile
      // that exists, and the assignment dropdown still refuses the artist,
      // until somebody reloads the page.
      if (newProfile) {
        const created = newProfile as ArtistDispatchProfile;
        setArtistProfiles((prev) =>
          prev.some((ap) => ap.id === created.id)
            ? prev.map((ap) => (ap.id === created.id ? created : ap))
            : [...prev, created]
        );
      }

      // The profile exists — only now is this application truly approved.
      await patchRow<DBArtistApplication>('artist_applications', application.id, { status }, setArtistApps);
      // Through a database function, so the Artist Manager can approve too (037).
      const { error: roleErr } = await supabase.rpc('grant_artist_role', { p_user: application.user_id });
      if (roleErr) {
        setError(
          `${application.full_name}'s application is approved, but their account could not be switched to ` +
            `an artist account: ${friendlyError(roleErr)}`
        );
      } else {
        setUsers((prev) => prev.map((u) => (u.id === application.user_id ? { ...u, role: 'artist' } : u)));
      }

      // Best-effort — the approval itself is already saved above, so a failed
      // email (e.g. RESEND_API_KEY not yet configured) shouldn't block it.
      const applicantEmail = users.find((u) => u.id === application.user_id)?.email;
      if (applicantEmail) {
        fetch('/api/notify-artist-approved', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: applicantEmail, name: application.full_name }),
        }).catch(() => {});
      }
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

  /**
   * KYC is a hard gate, not a badge: an artist can only be given work once
   * their documents are approved and the account is live. Enforced in the DB
   * too (supabase/025_kyc_assignment_gate.sql) — this is just so the admin
   * sees why, instead of getting a rejected update.
   */
  const isAssignable = useCallback(
    (profile: ArtistDispatchProfile | undefined) =>
      !!profile && profile.verification_status === 'verified' && profile.active && !profile.blacklisted
        && !blocksWork(profile.standing, profile.restricted_until),
    []
  );

  /** Why an artist can't be assigned, for the dropdown label. */
  const blockedReason = useCallback((profile: ArtistDispatchProfile | undefined) => {
    if (!profile) return 'no artist profile';
    if (blocksWork(profile.standing, profile.restricted_until)) return STANDING_LABEL[profile.standing ?? 'good'].toLowerCase();
    if (profile.blacklisted) return 'blacklisted';
    if (!profile.active) return 'inactive';
    if (profile.verification_status !== 'verified') {
      return profile.verification_status === 'rejected'
        ? 'KYC rejected'
        : profile.verification_status === 'pending'
          ? 'KYC awaiting review'
          : 'KYC not uploaded';
    }
    return null;
  }, []);

  /**
   * Ranks artists for a booking by location match — exact serviced pincode
   * first, then same base city, then everyone else — so the dropdown below
   * surfaces the best-placed artist instead of a blind alphabetical list.
   * Done client-side against already-loaded artist_profiles rather than a
   * match_artists() RPC call, since service_pincodes is rarely populated
   * (nothing in the application form collects it) and city is the more
   * reliable signal actually present in the data today.
   */
  const rankArtistsForBooking = useCallback(
    (booking: DBArtistBooking) => {
      const pincodeMatch = booking.city_venue.match(/\b(\d{6})\b/);
      const pincode = pincodeMatch?.[1];
      const venueLower = booking.city_venue.toLowerCase();

      return artists
        .map((user) => {
          const profile = artistProfiles.find((ap) => ap.id === user.id);
          const cityMatch = !!profile?.base_city && venueLower.includes(profile.base_city.toLowerCase());
          const pinMatch = !!pincode && !!profile?.service_pincodes?.includes(pincode);
          const tier = pinMatch ? 0 : cityMatch ? 1 : 2;
          return { user, profile, tier, assignable: isAssignable(profile) };
        })
        // Never offer work to a deactivated or blacklisted artist — the
        // dropdown used to list everyone with role='artist' regardless.
        .filter(({ profile }) => !profile || (profile.active && !profile.blacklisted))
        // Assignable first, then by location tier: a KYC-blocked artist stays
        // visible (so it's obvious why they can't be picked) but sinks.
        .sort((a, b) => Number(b.assignable) - Number(a.assignable) || a.tier - b.tier);
    },
    [artists, artistProfiles, isAssignable]
  );

  const TIER_LABEL = ['📍 Exact pincode', '🏙️ Same city', ''];

  /** Active / blacklist controls on the artist roster (Users & Roles tab). */
  const setArtistFlags = async (
    artistId: string,
    patch: Partial<Pick<ArtistDispatchProfile, 'active' | 'blacklisted'>>
  ) => {
    const { error: flagErr } = await supabase.from('artist_profiles').update(patch).eq('id', artistId);
    if (flagErr) {
      setError(friendlyError(flagErr));
      return;
    }
    setArtistProfiles((prev) => prev.map((p) => (p.id === artistId ? { ...p, ...patch } : p)));
  };

  const openStanding = async (ap: ArtistDispatchProfile, name: string) => {
    setStandingFor({ profile: ap, name });
    setStandingLevel(ap.standing ?? 'good');
    setStandingUntil(
      ap.restricted_until ? new Date(ap.restricted_until).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : ''
    );
    setStandingNote('');
    setStandingError(null);
    setStandingInfo({ rec: null, incidents: [] });
    const [rec, inc] = await Promise.all([
      supabase.rpc('artist_standing_recommendation', { p_artist_id: ap.id }),
      supabase
        .from('artist_incidents')
        .select('id, kind, reason, points, created_at')
        .eq('artist_id', ap.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    setStandingInfo({ rec: rec.data ?? null, incidents: inc.data ?? [] });
  };

  const acceptSecurityPolicy = async () => {
    if (!profile) return;
    setAckSaving(true);
    const { error: ackErr } = await supabase
      .from('profiles')
      .update({ security_ack_at: new Date().toISOString() })
      .eq('id', profile.id);
    setAckSaving(false);
    if (ackErr) {
      setError(friendlyError(ackErr));
      setAckSkipped(true);
      return;
    }
    await refreshProfile();
  };

  const saveStanding = async () => {
    if (!standingFor) return;
    if (!standingNote.trim()) {
      setStandingError('Write down why. The artist sees this, and it goes in the audit log.');
      return;
    }
    if (standingLevel === 'restricted' && !standingUntil) {
      setStandingError('Pick the date the restriction ends.');
      return;
    }
    setStandingSaving(true);
    setStandingError(null);
    const patch = {
      standing: standingLevel,
      restricted_until: standingLevel === 'restricted' ? `${standingUntil}T23:59:59+05:30` : null,
      standing_note: standingNote.trim(),
    };
    const artistId = standingFor.profile.id;
    const { error: standingErr } = await supabase.from('artist_profiles').update(patch).eq('id', artistId);
    setStandingSaving(false);
    if (standingErr) {
      setStandingError(friendlyError(standingErr));
      return;
    }
    setArtistProfiles((prev) =>
      prev.map((p) => (p.id === artistId ? { ...p, standing: patch.standing, restricted_until: patch.restricted_until } : p))
    );
    setStandingFor(null);
  };

  const assignArtist = async (bookingId: string, artistId: string) => {
    if (!artistId) return;
    const artist = artists.find((a) => a.id === artistId);
    const booking = bookings.find((b) => b.id === bookingId);

    const profile = artistProfiles.find((ap) => ap.id === artistId);
    if (!isAssignable(profile)) {
      setError(
        `${artist?.full_name || 'This artist'} cannot be assigned — ${blockedReason(profile)}. Approve their documents under the Verification tab first.`
      );
      return;
    }
    setError(null);

    await patchRow<DBArtistBooking>(
      'artist_bookings',
      bookingId,
      {
        artist_id: artistId,
        artist_name: artist?.full_name ?? null,
        status: 'offered',
        assigned_by: profile?.id ?? null,
        // A manager's pick waits for the owner; an admin assigning IS the
        // approval. The database refuses to let a manager set this itself.
        ...(isManager
          ? {}
          : { assignment_approved_at: new Date().toISOString(), assignment_approved_by: profile?.id ?? null }),
      },
      setBookings
    );

    // Best-effort — the offer itself is already saved above. Skip the email
    // if the write was rejected (patchRow rolls back and sets the error).
    if (artist?.email && booking) {
      fetch('/api/notify-artist-offer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: artist.email,
          name: artist.full_name,
          eventDate: booking.event_date,
          cityVenue: booking.city_venue,
          safaStyle: booking.safa_style,
        }),
      }).catch(() => {});
    }
  };

  const STAGE_LABEL: Record<string, string> = {
    en_route: 'On the way', arrived: 'Arrived', started: 'Tying',
    completed: 'Finished', no_show: 'NO SHOW',
  };

  /** What the artist is actually doing on this job, from their own check-ins. */
  const LiveStage = ({ jobId }: { jobId: string }) => {
    const entry = jobStage[jobId];
    if (!entry) {
      return <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Not started</span>;
    }
    const tone =
      entry.stage === 'no_show' ? 'bg-rose-100 text-rose-800'
      : entry.stage === 'completed' ? 'bg-emerald-100 text-emerald-800'
      : entry.stage === 'started' ? 'bg-royal-100 text-royal-800'
      : entry.stage === 'arrived' ? 'bg-amber-100 text-amber-800'
      : 'bg-blue-100 text-blue-800';
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${tone}`}>
        {STAGE_LABEL[entry.stage] ?? entry.stage}
        <span className="block font-normal normal-case text-[9px] opacity-70">
          {new Date(entry.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
        </span>
      </span>
    );
  };

  const openStaffEditor = (account: UserProfile) => {
    setEditingStaff(account);
    setStaffDesignation(account.designation ?? '');
    setStaffPhoto(null);
  };

  const saveStaffProfile = async () => {
    if (!editingStaff || !profile) return;
    setSavingStaff(true);
    setError(null);
    let avatarUrl = editingStaff.avatar_url ?? null;

    if (staffPhoto) {
      if (staffPhoto.size > 5 * 1024 * 1024) {
        setError('The photo must be under 5 MB.');
        setSavingStaff(false);
        return;
      }
      const ext = staffPhoto.name.split('.').pop()?.toLowerCase() || 'jpg';
      // Storage only lets someone write inside their own folder, so the
      // uploader's id leads the path and the staff member's id names the file.
      const path = `${profile.id}/staff/${editingStaff.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('portfolio')
        .upload(path, staffPhoto, { contentType: staffPhoto.type });
      if (uploadErr) {
        setError(`Could not upload the photo: ${uploadErr.message}`);
        setSavingStaff(false);
        return;
      }
      avatarUrl = supabase.storage.from('portfolio').getPublicUrl(path).data.publicUrl;
    }

    await patchRow<UserProfile>(
      'profiles',
      editingStaff.id,
      { designation: staffDesignation.trim() || null, avatar_url: avatarUrl },
      setUsers
    );
    setSavingStaff(false);
    setEditingStaff(null);
  };

  /**
   * Attaches an application that was submitted signed-out to a real account.
   *
   * Approval hangs an artist profile off an account, so an application with
   * no account can never be approved — and telling a ten-year artist who
   * already filled the form to fill it again is not a fix.
   */
  const linkApplication = async (application: DBArtistApplication, userId: string) => {
    const { error: linkErr } = await supabase.rpc('link_artist_application', {
      p_application_id: application.id,
      p_user_id: userId,
    });

    if (linkErr) {
      setError(friendlyError(linkErr));
      return;
    }

    setArtistApps((prev) =>
      prev.map((a) => (a.id === application.id ? { ...a, user_id: userId } : a))
    );
    setLinkingApp(null);
    setLinkSearch('');
    setError(null);
  };

  /**
   * Builds the artist profile for an application that says approved but never
   * got one — the status used to be written before the profile was created,
   * so a failure left exactly this shape behind.
   */
  const repairApproval = async (application: DBArtistApplication) => {
    if (!application.user_id) return;
    await updateArtistApplicationStatus({ ...application, status: 'pending' }, 'approved');
  };

  /**
   * A cancellation without a reason is a number nobody can act on — the
   * Cancellation Report can say what was lost but not why, which is the half
   * that changes a decision. Asked once, here, at the moment it happens.
   */
  const askCancelReason = (name: string) =>
    window.prompt(`Why is ${name}'s booking being cancelled? This shows in the Cancellation Report.`, '');

  /** Fixed values, so the Collection Report can actually split cash from UPI. */
  const PaymentModeSelect = ({ value, onChange }: {
    value: string | null | undefined;
    onChange: (mode: string) => void;
  }) => (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      title="How did the money reach us?"
      className="mt-1 w-full px-2 py-1 rounded-lg border border-amber-200/70 bg-white text-[10px] font-bold text-maroon-950"
    >
      <option value="">Paid by…</option>
      {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
    </select>
  );

  /** Admin sign-off on an artist — the last word on who goes to a wedding. */
  const approveAssignment = async (booking: DBArtistBooking) => {
    await patchRow<DBArtistBooking>(
      'artist_bookings',
      booking.id,
      {
        assignment_approved_at: new Date().toISOString(),
        assignment_approved_by: profile?.id ?? null,
      },
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
    if (artistId) {
      const profile = artistProfiles.find((ap) => ap.id === artistId);
      if (!isAssignable(profile)) {
        setError(
          `${artist?.full_name || 'This artist'} cannot be assigned — ${blockedReason(profile)}. Approve their documents under the Verification tab first.`
        );
        return;
      }
      setError(null);
    }
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
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg shadow-maroon-900/20 border-b border-royal-400/20 relative overflow-hidden">
        <div className="absolute inset-0 pattern-diamond opacity-[0.05] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <Link href="/" className="w-10 h-10 shrink-0">
                <motion.div whileHover={{ rotate: 8, scale: 1.05 }} className="w-full h-full">
                  <Image src="/logo.png" alt="SafaKing" width={40} height={40} className="w-full h-full object-contain" />
                </motion.div>
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
            { label: 'Total Sales Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: TrendingUp },
            { label: 'Orders', value: orders.length, icon: ShoppingBag },
            { label: 'Artist Bookings', value: bookings.length, icon: Calendar },
            { label: 'Suppliers Pending', value: pendingSuppliers, icon: Package },
          ].map((metric) => (
            <div
              key={metric.label}
              className="p-6 rounded-3xl bg-white border border-amber-200/60 shadow-md shadow-amber-900/5 flex items-center gap-5 hover:shadow-lg hover:shadow-amber-900/10 transition-shadow"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-maroon-950 text-royal-300 shrink-0">
                <metric.icon size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  {metric.label}
                </p>
                <p className="text-2xl font-display font-black text-gradient-gold mt-0.5">
                  {loading ? '—' : metric.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-amber-200/70 mb-8 overflow-x-auto gap-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'border-royal-500 text-maroon-950 bg-white rounded-t-2xl shadow-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'text-royal-600' : ''} />
              {tab.label}
            </button>
          ))}
        </div>

        {securityGate.blocked ? (
          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-rose-50 border-2 border-rose-300 text-rose-900">
              <p className="font-display font-black text-base">Two-step verification is required</p>
              <p className="text-xs mt-1 leading-relaxed">
                The owner requires every staff account to use an authenticator app. Set it up below. If you already
                have, sign out and sign in again with your code.
              </p>
            </div>
            <SecurityCentre isOwner={false} onSecured={securityGate.reload} />
          </div>
        ) : isManager && !managerTabs.includes(activeTab) ? (
          <div className="p-16 text-center bg-white rounded-3xl border border-amber-200/60">
            <ShieldAlert size={28} className="text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700">This section is admin-only.</p>
            <p className="text-xs text-gray-500 mt-1">Ask the owner if you need something from here.</p>
          </div>
        ) : loading ? (
          <div className="p-16 text-center bg-white rounded-3xl border border-amber-200/60">
            <Loader2 size={30} className="text-amber-500 mx-auto mb-3 animate-spin" />
            <p className="text-sm font-bold text-gray-600">Loading control data…</p>
          </div>
        ) : (
          <>
            {/* ---- ORDERS ---- */}
            {activeTab === 'orders' && (
              <Panel
                title="Fulfilment & Orders"
                subtitle="Change a status to update it live"
                toolbar={
                  <FilterBar
                    search={ordersFilter.search}
                    onSearchChange={(search) => setOrdersFilter((f) => ({ ...f, search }))}
                    searchPlaceholder="Search by customer name, phone or address…"
                    status={ordersFilter.status}
                    onStatusChange={(status) => setOrdersFilter((f) => ({ ...f, status }))}
                    statusOptions={ORDER_STATUSES}
                  />
                }
              >
                {orders.length === 0 ? (
                  <Empty label="No orders yet." />
                ) : filteredOrders.length === 0 ? (
                  <Empty label="No orders match this filter." />
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
                      {filteredOrders.map((order) => {
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
                                <PaymentModeSelect
                                  value={order.payment_mode}
                                  onChange={(payment_mode) =>
                                    patchRow<DBOrder>(
                                      'orders', order.id, { payment_mode: payment_mode || null }, setOrders
                                    )
                                  }
                                />
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
                                    className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider text-center transition-colors"
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
                toolbar={
                  <FilterBar
                    search={bookingsFilter.search}
                    onSearchChange={(search) => setBookingsFilter((f) => ({ ...f, search }))}
                    searchPlaceholder="Search by customer, phone, venue or artist…"
                    status={bookingsFilter.status}
                    onStatusChange={(status) => setBookingsFilter((f) => ({ ...f, status }))}
                    statusOptions={BOOKING_STATUSES}
                  />
                }
              >
                {bookings.length === 0 ? (
                  <Empty label="No bookings yet." />
                ) : filteredBookings.length === 0 ? (
                  <Empty label="No bookings match this filter." />
                ) : (
                  <table className="w-full text-left">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Client</th>
                        <th className={TH}>Event Date</th>
                        <th className={TH}>City / Venue</th>
                        <th className={TH}>Safa Style</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Live Status</th>
                        <th className={TH}>Assign Artist</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-xs">
                      {filteredBookings.map((booking) => (
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
                            <StatusSelect
                              value={booking.status}
                              options={BOOKING_STATUSES}
                              onChange={(status) => {
                                if (status === 'cancelled') {
                                  const reason = askCancelReason(booking.customer_name);
                                  if (reason === null) return;
                                  patchRow<DBArtistBooking>(
                                    'artist_bookings', booking.id,
                                    { status, cancellation_reason: reason.trim() || null },
                                    setBookings
                                  );
                                  return;
                                }
                                patchRow<DBArtistBooking>('artist_bookings', booking.id, { status }, setBookings);
                              }}
                            />
                            {booking.artist_id && (
                              <span className={`block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-center ${
                                booking.assignment_approved_at
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}>
                                {booking.assignment_approved_at ? 'Artist approved' : 'Needs approval'}
                              </span>
                            )}
                            <PaymentModeSelect
                              value={booking.payment_mode}
                              onChange={(payment_mode) =>
                                patchRow<DBArtistBooking>(
                                  'artist_bookings', booking.id, { payment_mode: payment_mode || null }, setBookings
                                )
                              }
                            />
                            {booking.cancellation_reason && (
                              <span className="block text-[10px] text-rose-700 font-bold mt-1 max-w-[11rem]">
                                Reason: {booking.cancellation_reason}
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <LiveStage jobId={booking.id} />
                          </td>
                          <td className="p-4">
                            <select
                              value={booking.artist_id ?? ''}
                              onChange={(e) => assignArtist(booking.id, e.target.value)}
                              disabled={artists.length === 0}
                              className="px-3 py-1.5 rounded-xl border border-amber-200/70 bg-white font-bold text-[11px] focus:ring-2 focus:ring-maroon-950/20 disabled:opacity-50"
                            >
                              <option value="">Unassigned</option>
                              {rankArtistsForBooking(booking).map(({ user, profile, tier, assignable }) => (
                                <option key={user.id} value={user.id} disabled={!assignable}>
                                  {user.full_name || user.email}
                                  {profile ? ` — ${profile.base_city ?? 'no city set'}` : ''}
                                  {TIER_LABEL[tier] ? ` (${TIER_LABEL[tier]})` : ''}
                                  {assignable ? '' : ` 🔒 ${blockedReason(profile)}`}
                                  {profile && profile.total_events > 0 && profile.rating != null && profile.rating < 3 ? ' ⚠ low rating' : ''}
                                </option>
                              ))}
                            </select>
                            {booking.artist_id && !booking.assignment_approved_at && (
                              isManager ? (
                                <p className="mt-1.5 text-[10px] font-bold text-amber-800 leading-tight max-w-[10rem]">
                                  Waiting for the owner to approve this artist.
                                </p>
                              ) : (
                                <button
                                  onClick={() => approveAssignment(booking)}
                                  className="mt-1.5 w-full px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider"
                                >
                                  Approve artist
                                </button>
                              )
                            )}
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
              <Panel
                title="Safa Artist Applications"
                subtitle="Review artist credentials & approve for wedding dispatches"
                toolbar={
                  <FilterBar
                    search={artistAppsFilter.search}
                    onSearchChange={(search) => setArtistAppsFilter((f) => ({ ...f, search }))}
                    searchPlaceholder="Search by name, phone or city…"
                    status={artistAppsFilter.status}
                    onStatusChange={(status) => setArtistAppsFilter((f) => ({ ...f, status }))}
                    statusOptions={APPLICATION_STATUSES}
                  />
                }
              >
                {artistApps.length === 0 ? (
                  <Empty label="No artist applications received yet." />
                ) : filteredArtistApps.length === 0 ? (
                  <Empty label="No applications match this filter." />
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
                      {filteredArtistApps.map((artist) => (
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
                            {artist.status === 'approved' &&
                              artist.user_id &&
                              !artistProfiles.some((ap) => ap.id === artist.user_id) && (
                                <button
                                  onClick={() => repairApproval(artist)}
                                  className="block mt-1.5 w-full px-2 py-1 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-[9px] font-black uppercase tracking-wider"
                                  title="Marked approved but no artist profile exists — click to build it now."
                                >
                                  No profile — fix now
                                </button>
                              )}
                            {!artist.user_id && (
                              <button
                                onClick={() => { setLinkingApp(artist); setLinkSearch(artist.phone); }}
                                className="block mt-1.5 w-full px-2 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[9px] font-black uppercase tracking-wider"
                                title="Applied while signed out — attach this application to their account so it can be approved."
                              >
                                No account — link it
                              </button>
                            )}
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
                      className="px-4 py-2.5 rounded-xl border border-amber-200/70 text-xs font-bold focus:ring-2 focus:ring-maroon-800/20 outline-none"
                    />
                    <input
                      required
                      type="text"
                      placeholder="City / Region (e.g. Jaipur, Rajasthan)"
                      value={newPinCity}
                      onChange={(e) => setNewPinCity(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-amber-200/70 text-xs font-bold focus:ring-2 focus:ring-maroon-800/20 outline-none"
                    />
                    <input
                      required
                      type="number"
                      min={1}
                      max={14}
                      placeholder="Est. Delivery Days (e.g. 2)"
                      value={newPinDays}
                      onChange={(e) => setNewPinDays(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-amber-200/70 text-xs font-bold focus:ring-2 focus:ring-maroon-800/20 outline-none"
                    />
                    <button
                      type="submit"
                      className="py-2.5 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus size={14} /> Add Pincode
                    </button>
                  </form>
                </Panel>

                <Panel
                  title="Deliverable Service Areas"
                  subtitle={`${pincodes.length} deliverable pincodes configured`}
                  toolbar={
                    <FilterBar
                      search={pincodesSearch}
                      onSearchChange={setPincodesSearch}
                      searchPlaceholder="Search by pincode or city…"
                    />
                  }
                >
                  {pincodes.length === 0 ? (
                    <Empty label="No deliverable pincodes added yet." />
                  ) : filteredPincodes.length === 0 ? (
                    <Empty label="No pincodes match this search." />
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
                        {filteredPincodes.map((pin) => (
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
                  toolbar={
                    <FilterBar
                      search={productsFilter.search}
                      onSearchChange={(search) => setProductsFilter((f) => ({ ...f, search }))}
                      searchPlaceholder="Search by name, code or category…"
                      status={productsFilter.status}
                      onStatusChange={(status) => setProductsFilter((f) => ({ ...f, status }))}
                      statusOptions={['active', 'inactive', 'pending_sync']}
                    />
                  }
                >
                  {products.length === 0 ? (
                    <Empty label="No products yet — add one, or run supabase/seed.sql." />
                  ) : filteredProducts.length === 0 ? (
                    <Empty label="No products match this filter." />
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
                        {filteredProducts.map((product) => (
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
                                  className="p-2 rounded-xl bg-royal-100 text-royal-800 hover:bg-royal-200 transition-colors"
                                  aria-label={`Edit ${product.name}`}
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  onClick={() => deleteProduct(product.id, product.name)}
                                  className="p-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors"
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
              <Panel
                title="Supplier Network Submissions"
                toolbar={
                  <FilterBar
                    search={suppliersFilter.search}
                    onSearchChange={(search) => setSuppliersFilter((f) => ({ ...f, search }))}
                    searchPlaceholder="Search by business, contact, phone or city…"
                    status={suppliersFilter.status}
                    onStatusChange={(status) => setSuppliersFilter((f) => ({ ...f, status }))}
                    statusOptions={APPLICATION_STATUSES}
                  />
                }
              >
                {suppliers.length === 0 ? (
                  <Empty label="No supplier applications yet." />
                ) : filteredSuppliers.length === 0 ? (
                  <Empty label="No suppliers match this filter." />
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
                      {filteredSuppliers.map((supplier) => (
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
              <Panel
                title="Academy Enrollment Requests"
                toolbar={
                  <FilterBar
                    search={enrollmentsFilter.search}
                    onSearchChange={(search) => setEnrollmentsFilter((f) => ({ ...f, search }))}
                    searchPlaceholder="Search by name, phone or city…"
                    status={enrollmentsFilter.status}
                    onStatusChange={(status) => setEnrollmentsFilter((f) => ({ ...f, status }))}
                    statusOptions={ENROLLMENT_STATUSES}
                  />
                }
              >
                {enrollments.length === 0 ? (
                  <Empty label="No enrollment requests yet." />
                ) : filteredEnrollments.length === 0 ? (
                  <Empty label="No enrollments match this filter." />
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
                      {filteredEnrollments.map((enrollment) => (
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
              <Panel
                title="Job Applications"
                toolbar={
                  <FilterBar
                    search={jobAppsFilter.search}
                    onSearchChange={(search) => setJobAppsFilter((f) => ({ ...f, search }))}
                    searchPlaceholder="Search by name, city or role…"
                    status={jobAppsFilter.status}
                    onStatusChange={(status) => setJobAppsFilter((f) => ({ ...f, status }))}
                    statusOptions={JOB_STATUSES}
                  />
                }
              >
                {jobApps.length === 0 ? (
                  <Empty label="No job applications yet." />
                ) : filteredJobApps.length === 0 ? (
                  <Empty label="No applications match this filter." />
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
                      {filteredJobApps.map((application) => (
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
                toolbar={
                  <FilterBar
                    search={rentalsFilter.search}
                    onSearchChange={(search) => setRentalsFilter((f) => ({ ...f, search }))}
                    searchPlaceholder="Search by customer, phone, venue or pincode…"
                    status={rentalsFilter.status}
                    onStatusChange={(status) => setRentalsFilter((f) => ({ ...f, status }))}
                    statusOptions={RENTAL_STATUSES}
                  />
                }
              >
                {rentals.length === 0 ? (
                  <Empty label="No rentals yet." />
                ) : filteredRentals.length === 0 ? (
                  <Empty label="No rentals match this filter." />
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
                      {filteredRentals.map((rental) => (
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
                                  className="px-2.5 py-1.5 rounded-xl border border-amber-200/70 bg-white font-bold text-[11px] disabled:opacity-50"
                                >
                                  <option value="">Unassigned</option>
                                  {artists.map((artist) => {
                                    const profile = artistProfiles.find((ap) => ap.id === artist.id);
                                    const ok = isAssignable(profile);
                                    return (
                                      <option key={artist.id} value={artist.id} disabled={!ok}>
                                        {artist.full_name || artist.email}
                                        {ok ? '' : ` 🔒 ${blockedReason(profile)}`}
                                      </option>
                                    );
                                  })}
                                </select>
                                <button
                                  onClick={() => setTeamFor(rental.id)}
                                  className="block mt-1.5 px-2.5 py-1 rounded-xl bg-maroon-950 text-royal-300 text-[10px] font-bold uppercase tracking-wider"
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
                              onChange={(status) => {
                                if (status === 'cancelled') {
                                  const reason = askCancelReason(rental.customer_name);
                                  if (reason === null) return;
                                  patchRow<DBRentalBooking>(
                                    'rental_bookings', rental.id,
                                    { status, cancellation_reason: reason.trim() || null },
                                    setRentals
                                  );
                                  return;
                                }
                                patchRow<DBRentalBooking>('rental_bookings', rental.id, { status }, setRentals);
                              }}
                            />
                            <PaymentModeSelect
                              value={rental.payment_mode}
                              onChange={(payment_mode) =>
                                patchRow<DBRentalBooking>(
                                  'rental_bookings', rental.id, { payment_mode: payment_mode || null }, setRentals
                                )
                              }
                            />
                            {rental.cancellation_reason && (
                              <span className="block text-[10px] text-rose-700 font-bold mt-1 max-w-[12rem]">
                                Reason: {rental.cancellation_reason}
                              </span>
                            )}
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
                            className="w-32 px-3 py-2 rounded-xl border border-amber-200/70 text-sm font-bold focus:ring-2 focus:ring-maroon-950/20"
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
            {activeTab === 'verification' && (
              <div className="space-y-6">
                <KycChaseList />
                <VerificationQueue />
              </div>
            )}

            {/* ---- BOOKING PROTECTION ---- */}
            {activeTab === 'protection' && <CancellationDesk />}

            {/* ---- ANALYTICS ---- */}
            {activeTab === 'expenses' && <ExpenseLedger />}

            {activeTab === 'complaints' && profile && (
              <ComplaintsPanel
                role={profile.role}
                userId={profile.id}
                userName={profile.full_name || profile.email || 'Staff'}
              />
            )}

            {activeTab === 'analytics' && (
              <ReportsCentre
                adminName={profile?.full_name || profile?.email || 'admin'}
                role={profile?.role ?? 'admin'}
              />
            )}

            {/* ---- SECURITY ---- */}
            {activeTab === 'security' && <SecurityCentre isOwner={!isManager} onSecured={securityGate.reload} />}

            {/* ---- LIVE OPS ---- */}
            {activeTab === 'liveops' && (
              <div className="space-y-6">
                <LiveOpsMap />
                <ArtistIncidentsPanel />
                <LiveOpsBoard />
              </div>
            )}

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
                toolbar={
                  <FilterBar
                    search={usersFilter.search}
                    onSearchChange={(search) => setUsersFilter((f) => ({ ...f, search }))}
                    searchPlaceholder="Search by name, email or phone…"
                    status={usersFilter.status}
                    onStatusChange={(status) => setUsersFilter((f) => ({ ...f, status }))}
                    statusOptions={ROLES}
                  />
                }
              >
                {users.length === 0 ? (
                  <Empty label="No registered users yet." />
                ) : filteredUsers.length === 0 ? (
                  <Empty label="No users match this filter." />
                ) : (
                  <table className="w-full text-left">
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Name</th>
                        <th className={TH}>Email</th>
                        <th className={TH}>Phone</th>
                        <th className={TH}>City</th>
                        <th className={TH}>Role</th>
                        <th className={TH}>Artist Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-xs">
                      {filteredUsers.map((account) => (
                        <tr key={account.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {account.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={account.avatar_url}
                                  alt={account.full_name || 'Staff photo'}
                                  className="w-9 h-9 rounded-full object-cover border border-amber-200 shrink-0"
                                />
                              ) : (
                                <span className="w-9 h-9 rounded-full bg-royal-100 text-maroon-900 font-black text-xs flex items-center justify-center shrink-0">
                                  {(account.full_name || account.email || '?').trim().charAt(0).toUpperCase()}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-maroon-950 truncate">{account.full_name || '—'}</p>
                                {account.designation && (
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-royal-700 truncate">
                                    {account.designation}
                                  </p>
                                )}
                                {STAFF_ROLES_UI.includes(account.role) && (!isManager || account.id === profile?.id) && (
                                  <button
                                    onClick={() => openStaffEditor(account)}
                                    className="mt-0.5 text-[10px] font-bold text-maroon-800 hover:underline flex items-center gap-1"
                                  >
                                    <Camera size={10} />
                                    {account.avatar_url || account.designation ? 'Edit photo & designation' : 'Add photo & designation'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-gray-600">{account.email}</td>
                          <td className="p-4 text-gray-600">{account.phone || '—'}</td>
                          <td className="p-4 text-gray-600">{account.city || '—'}</td>
                          <td className="p-4">
                            {account.id === profile?.id || isManager ? (
                              <span className="text-[11px] font-bold text-gray-500">
                                {account.role === 'manager'
                                  ? DEPARTMENT_LABEL[unitOf(account.role, account.department) ?? 'operations']
                                  : account.role}
                                {account.id === profile?.id ? ' (you)' : ''}
                              </span>
                            ) : (
                              <div className="flex flex-col items-start gap-1.5">
                                <StatusSelect
                                  value={account.role}
                                  options={ROLES}
                                  onChange={(role) =>
                                    patchRow<UserProfile>('profiles', account.id, { role }, setUsers)
                                  }
                                />
                                {account.role === 'manager' && (
                                  <select
                                    value={account.department ?? 'operations'}
                                    onChange={(e) =>
                                      patchRow<UserProfile>(
                                        'profiles',
                                        account.id,
                                        { department: e.target.value as Department },
                                        setUsers
                                      )
                                    }
                                    title="Department: decides which parts of this panel they can see and use"
                                    className="px-2 py-1 rounded-lg border border-amber-200/80 text-[10px] font-bold text-maroon-900 bg-white"
                                  >
                                    {DEPARTMENTS.map((d) => (
                                      <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            {(() => {
                              if (account.role !== 'artist') return <span className="text-gray-300">—</span>;
                              const ap = artistProfiles.find((p) => p.id === account.id);
                              if (!ap) {
                                return (
                                  <span className="text-[10px] font-bold text-rose-700">
                                    No artist profile — re-approve their application
                                  </span>
                                );
                              }
                              const tone = ratingTone(ap.rating, ap.total_events);
                              return (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${tone.cls}`}
                                    title={`${ap.total_events} event${ap.total_events === 1 ? '' : 's'}`}
                                  >
                                    {tone.label}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                      ap.verification_status === 'verified'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                    title={
                                      ap.verification_status === 'verified'
                                        ? 'Documents approved — can be assigned work'
                                        : 'KYC must be approved (Verification tab) before this artist can be assigned any booking'
                                    }
                                  >
                                    {ap.verification_status === 'verified' ? 'KYC ✓' : 'KYC — cannot be assigned'}
                                  </span>
                                  <button
                                    onClick={() => openStanding(ap, account.full_name || 'This artist')}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${STANDING_TONE[ap.standing ?? 'good']}`}
                                    title="Standing: click to see incidents or change it"
                                  >
                                    {STANDING_LABEL[ap.standing ?? 'good']}
                                  </button>
                                  {ap.blacklisted ? (
                                    <button
                                      onClick={() => setArtistFlags(ap.id, { blacklisted: false })}
                                      className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase tracking-wider"
                                      title="Remove from blacklist"
                                    >
                                      Blacklisted · Undo
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => setArtistFlags(ap.id, { active: !ap.active })}
                                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                          ap.active
                                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                        title={ap.active ? 'Click to deactivate (hidden from listing & assignment)' : 'Click to reactivate'}
                                      >
                                        {ap.active ? 'Active' : 'Inactive'}
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm(`Blacklist ${account.full_name || 'this artist'}? They will be removed from listings, matching and assignment until undone.`)) {
                                            setArtistFlags(ap.id, { blacklisted: true, active: false });
                                          }
                                        }}
                                        className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        Blacklist
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
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
            <div className="sticky top-0 bg-maroon-950 px-7 py-5 flex items-center justify-between relative overflow-hidden">
              <div className="absolute inset-0 pattern-diamond opacity-10 pointer-events-none" />
              <h3 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest relative">
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
                      className="w-full px-4 py-2.5 rounded-xl border border-amber-200/70 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
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
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-200/70 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
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
            <div className="sticky top-0 bg-maroon-950 px-7 py-5 flex items-center justify-between relative overflow-hidden">
              <div className="absolute inset-0 pattern-diamond opacity-10 pointer-events-none" />
              <h3 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest relative">
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
                {viewingApplication.photo_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      setZoomedPhoto({
                        url: viewingApplication.photo_url!,
                        name: viewingApplication.full_name,
                      })
                    }
                    title="Click to enlarge"
                    className="group relative w-20 h-20 rounded-2xl border-2 border-amber-200/70 overflow-hidden shrink-0 bg-amber-50/50 cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={viewingApplication.photo_url}
                      alt={viewingApplication.full_name}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute inset-0 bg-maroon-950/0 group-hover:bg-maroon-950/45 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all">
                      <ZoomIn size={20} />
                    </span>
                  </button>
                ) : (
                  <div className="w-20 h-20 rounded-2xl border-2 border-amber-200/70 overflow-hidden shrink-0 bg-amber-50/50 flex items-center justify-center">
                    <User size={28} className="text-gray-300" />
                  </div>
                )}
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

      {/* Staff photo and designation */}
      {/* Undefined until supabase/037 adds the column, so this never traps anyone before then. */}
      {staffUnit && profile?.security_ack_at === null && !ackSkipped && (
        <div className="fixed inset-0 z-[70] bg-maroon-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="bg-maroon-950 px-7 py-5">
              <h3 className="font-display font-black text-base text-royal-100 uppercase tracking-widest">Your personal login</h3>
              <p className="text-[11px] text-royal-200/60 mt-0.5">{DEPARTMENT_LABEL[staffUnit]} · please read before you continue</p>
            </div>
            <div className="p-7 space-y-4">
              <ul className="space-y-2.5 text-[13px] text-gray-700 leading-relaxed list-disc pl-5">
                <li>This login is yours alone. Sharing your password with anyone, colleagues included, is not allowed.</li>
                <li>Everything you do here is recorded under your name: what changed, what it was before, and when.</li>
                <li>Every sign-in is recorded with the device and place. The owner is told when your account is used on a new device.</li>
                <li>Use a strong password, and turn on two-step verification in the Security tab.</li>
              </ul>
              <button
                type="button"
                onClick={acceptSecurityPolicy}
                disabled={ackSaving}
                className="w-full py-3 rounded-2xl bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-xs font-bold uppercase tracking-widest"
              >
                {ackSaving ? 'Saving…' : 'I understand and agree'}
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="w-full text-[11px] font-bold text-gray-500 hover:text-maroon-900"
              >
                Sign out
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {standingFor && (
        <div className="fixed inset-0 z-[60] bg-maroon-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            <div className="bg-maroon-950 px-7 py-5 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h3 className="font-display font-black text-base text-royal-100 uppercase tracking-widest">
                  Artist standing
                </h3>
                <p className="text-[11px] text-royal-200/60 mt-0.5 truncate">
                  {standingFor.name} · now {STANDING_LABEL[standingFor.profile.standing ?? 'good']}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStandingFor(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-7 space-y-5 overflow-y-auto">
              {standingInfo.rec ? (
                <div
                  className={`rounded-2xl border p-4 ${
                    standingInfo.rec.recommended === (standingFor.profile.standing ?? 'good')
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-rose-200 bg-rose-50'
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">System suggestion</p>
                  <p className="font-bold text-sm text-maroon-950 mt-1">{STANDING_LABEL[standingInfo.rec.recommended]}</p>
                  <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                    {standingInfo.rec.points} point{standingInfo.rec.points === 1 ? '' : 's'} from{' '}
                    {standingInfo.rec.incidents} incident{standingInfo.rec.incidents === 1 ? '' : 's'} in the last 90 days.
                    No-show 3 · pulled out after accepting 2 · complaint upheld 2 · late 1.
                    1+ warning, 3+ restriction, 5+ review, 7+ suspension.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Loading their record…</p>
              )}

              {standingInfo.incidents.length > 0 && (
                <ul className="space-y-1.5">
                  {standingInfo.incidents.map((i) => (
                    <li key={i.id} className="text-[11px] text-gray-700 border-l-2 border-rose-200 pl-2.5">
                      <span className="font-bold">{INCIDENT_LABEL[i.kind]}</span> (+{i.points}) ·{' '}
                      {new Date(i.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {i.reason}
                    </li>
                  ))}
                </ul>
              )}

              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Set standing</span>
                <select
                  value={standingLevel}
                  onChange={(e) => setStandingLevel(e.target.value as ArtistStanding)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200/80 text-sm font-bold text-maroon-950 bg-white"
                >
                  {STANDING_ORDER.map((s) => {
                    const ownerOnly = s === 'suspended' && profile?.role !== 'admin' && standingFor.profile.standing !== 'suspended';
                    return (
                      <option key={s} value={s} disabled={ownerOnly}>
                        {STANDING_LABEL[s]}{ownerOnly ? ' (owner only)' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>

              {standingLevel === 'restricted' && (
                <label className="block">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                    Restricted until
                  </span>
                  <input
                    type="date"
                    value={standingUntil}
                    onChange={(e) => setStandingUntil(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200/80 text-sm font-bold text-maroon-950"
                  />
                </label>
              )}

              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Why (the artist sees this)
                </span>
                <textarea
                  rows={3}
                  value={standingNote}
                  onChange={(e) => setStandingNote(e.target.value)}
                  placeholder="e.g. Two pull-outs after accepting in August"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200/80 text-sm text-maroon-950 resize-none"
                />
              </label>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                Restriction, review and suspension stop this artist from being assigned or sending quotes. A
                warning goes on their record but does not block work.
              </p>

              {standingError && (
                <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">{standingError}</p>
              )}

              <button
                type="button"
                onClick={saveStanding}
                disabled={standingSaving}
                className="w-full py-3 rounded-2xl bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-xs font-bold uppercase tracking-widest"
              >
                {standingSaving ? 'Saving…' : 'Save standing'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {editingStaff && (
        <div className="fixed inset-0 z-[60] bg-maroon-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="bg-maroon-950 px-7 py-5 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="font-display font-black text-base text-royal-100 uppercase tracking-widest">
                  Staff profile
                </h3>
                <p className="text-[11px] text-royal-200/60 mt-0.5 truncate">
                  {editingStaff.full_name || editingStaff.email} · {editingStaff.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-7 space-y-5">
              <div className="flex items-center gap-4">
                {staffPhotoPreview || editingStaff.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={staffPhotoPreview || editingStaff.avatar_url || ''}
                    alt="Staff photo preview"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-200 shrink-0"
                  />
                ) : (
                  <span className="w-20 h-20 rounded-2xl bg-royal-100 text-maroon-900 font-display font-black text-2xl flex items-center justify-center shrink-0">
                    {(editingStaff.full_name || editingStaff.email || '?').trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <label className="cursor-pointer px-4 py-2.5 rounded-xl border border-amber-200/70 hover:bg-amber-50 text-[11px] font-bold text-maroon-900 flex items-center gap-2">
                  <Camera size={14} />
                  {staffPhoto ? 'Choose a different photo' : 'Choose photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setStaffPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Designation
                </span>
                <input
                  list="staff-designations"
                  value={staffDesignation}
                  onChange={(e) => setStaffDesignation(e.target.value)}
                  placeholder="e.g. Operations Coordinator"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200/80 text-sm font-medium text-maroon-950 outline-none focus:ring-2 focus:ring-maroon-800/15"
                />
                <datalist id="staff-designations">
                  {DESIGNATIONS.map((d) => <option key={d} value={d} />)}
                </datalist>
              </label>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                Shown beside their name in the admin panel, so everyone can see who is working the
                screen and in what role.
              </p>

              <button
                onClick={saveStaffProfile}
                disabled={savingStaff}
                className="w-full py-3 rounded-xl bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {savingStaff ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Attach a signed-out application to a real account */}
      {linkingApp && (() => {
        const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');
        const appTail = digits(linkingApp.phone).slice(-10);
        const q = linkSearch.trim().toLowerCase();

        const candidates = users
          .filter((u) =>
            !q ||
            (u.full_name ?? '').toLowerCase().includes(q) ||
            (u.email ?? '').toLowerCase().includes(q) ||
            digits(u.phone).includes(digits(q))
          )
          // The same phone number is a near-certain match; float it to the top.
          .sort((a, b) => {
            const am = digits(a.phone).slice(-10) === appTail ? 0 : 1;
            const bm = digits(b.phone).slice(-10) === appTail ? 0 : 1;
            return am - bm;
          })
          .slice(0, 12);

        return (
          <div className="fixed inset-0 z-[60] bg-maroon-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[88vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-maroon-950 px-7 py-5 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-black text-base text-royal-100 uppercase tracking-widest">
                    Link to an account
                  </h3>
                  <p className="text-[11px] text-royal-200/60 mt-0.5">
                    {linkingApp.full_name} · {linkingApp.phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setLinkingApp(null); setLinkSearch(''); }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-7 space-y-4">
                <p className="text-xs text-gray-600 leading-relaxed">
                  This application was submitted without signing in, so there is no account to
                  attach the artist profile to. Pick their account below — linking does not approve
                  them, it only makes approval possible.
                </p>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    placeholder="Search by name, phone or email…"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-amber-200/70 text-sm font-medium text-maroon-950 outline-none focus:ring-2 focus:ring-maroon-800/15"
                  />
                </div>

                {candidates.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                    <p className="text-xs leading-relaxed">
                      No account matches that. Ask {linkingApp.full_name} to sign up at{' '}
                      <span className="font-black">safaking.in/artist-portal/login?tab=join</span>{' '}
                      using <span className="font-black">{linkingApp.phone}</span> — an account with
                      that number claims this application automatically, and you can approve it
                      straight away.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {candidates.map((u) => {
                      const same = digits(u.phone).slice(-10) === appTail;
                      return (
                        <button
                          key={u.id}
                          onClick={() => linkApplication(linkingApp, u.id)}
                          className={`w-full text-left p-3.5 rounded-2xl border transition-colors ${
                            same
                              ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-white border-amber-200/70 hover:bg-amber-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-maroon-950 truncate">
                                {u.full_name || u.email}
                              </p>
                              <p className="text-[11px] text-gray-500 truncate">
                                {u.email}{u.phone ? ` · ${u.phone}` : ''} · {u.role}
                              </p>
                            </div>
                            {same && (
                              <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider">
                                Same number
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* Full-size photo viewer — sits above the application modal */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-[70] bg-maroon-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomedPhoto(null)}
        >
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={zoomedPhoto.url}
            alt={zoomedPhoto.name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] max-h-[80vh] object-contain rounded-2xl shadow-2xl cursor-default"
          />
          <div
            className="mt-4 flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display font-black text-royal-100 text-sm">{zoomedPhoto.name}</p>
            <a
              href={zoomedPhoto.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-royal-100 text-[11px] font-bold uppercase tracking-wider"
            >
              Open original ↗
            </a>
            <button
              type="button"
              onClick={() => setZoomedPhoto(null)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-royal-100 text-[11px] font-bold uppercase tracking-wider"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
