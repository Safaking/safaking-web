'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, LogOut, Loader2, ShieldAlert, Truck, Package, Wallet, MapPin, ShieldCheck,
  PackageCheck, Clock, IndianRupee, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, friendlyError } from '@/lib/supabase';
import {
  DEFAULT_SUPPLIER_RATES, SupplierOrder, SupplierProfile, SupplierRates, deliverySetupMissing, loadSupplierRates, rupees,
} from '@/lib/supplier';
import { VerificationPanel } from '@/components/verification/VerificationPanel';
import { SupplierOrders } from '@/components/supplier/SupplierOrders';
import { SupplierProducts } from '@/components/supplier/SupplierProducts';
import { SupplierPayouts } from '@/components/supplier/SupplierPayouts';
import { SupplierProfileForm } from '@/components/supplier/SupplierProfileForm';

/** The rule a supplier is most tempted to break, on every visit. */
const PLATFORM_RULE =
  'SafaKing से आए ग्राहक को सीधे माल बेचना, या SafaKing के बाहर भुगतान लेना मना है — हर ऑर्डर और भुगतान केवल SafaKing के ज़रिए।' +
  '   ·   Never sell directly to a SafaKing customer or take payment outside SafaKing. Every order and payment goes through SafaKing.';

type Tab = 'orders' | 'products' | 'payments' | 'delivery' | 'documents';

const TABS: { id: Tab; label: string; icon: typeof Package }[] = [
  { id: 'orders', label: 'Orders', icon: Truck },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'payments', label: 'Payments', icon: Wallet },
  { id: 'delivery', label: 'Delivery & Profile', icon: MapPin },
  { id: 'documents', label: 'Documents', icon: ShieldCheck },
];

export default function SupplierPortalPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [rates, setRates] = useState<SupplierRates>(DEFAULT_SUPPLIER_RATES);
  const [tab, setTab] = useState<Tab>('orders');

  useEffect(() => {
    loadSupplierRates().then(setRates);
  }, []);

  const loadSupplier = useCallback(async () => {
    if (!user) return;
    const { data, error: loadErr } = await supabase
      .from('supplier_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (loadErr) {
      setError(friendlyError(loadErr));
      setLoading(false);
      return;
    }
    if (!data) {
      router.replace('/supplier-portal/status');
      return;
    }
    setSupplier(data as SupplierProfile);
    setLoading(false);
  }, [user, router]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    const { data, error: loadErr } = await supabase.rpc('supplier_orders');
    if (loadErr) setError(friendlyError(loadErr));
    else setOrders((data as SupplierOrder[]) ?? []);
    setOrdersLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/supplier-portal/login');
      return;
    }
    loadSupplier();
    loadOrders();
  }, [authLoading, user, router, loadSupplier, loadOrders]);

  const stats = useMemo(() => {
    const open = orders.filter((o) => (o.status === 'new' || o.status === 'ready') && !o.order_cancelled);
    return {
      toPack: open.filter((o) => o.status === 'new').length,
      readyToSend: open.filter((o) => o.paid_in_full).length,
      awaitingBalance: open.filter((o) => !o.paid_in_full).length,
      paidToYou: orders
        .filter((o) => o.payout_status === 'paid')
        .reduce((sum, o) => sum + Number(o.payout_amount), 0),
    };
  }, [orders]);

  if (authLoading || loading || !supplier) {
    return (
      <div className="min-h-screen bg-[#FDF6EC] flex items-center justify-center">
        {error ? (
          <p className="text-sm text-rose-700 max-w-sm text-center">{error}</p>
        ) : (
          <Loader2 size={28} className="animate-spin text-maroon-700" />
        )}
      </div>
    );
  }

  const setupMissing = deliverySetupMissing(supplier);
  const kyc = supplier.verification_status;

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg border-b border-royal-400/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4 min-w-0">
              <Link href="/" className="w-10 h-10 shrink-0">
                <Image src="/logo.png" alt="SafaKing" width={40} height={40} className="w-full h-full object-contain" />
              </Link>
              <div className="min-w-0">
                <h1 className="font-display font-black text-xl text-royal-100 uppercase tracking-widest leading-none">
                  Supplier Portal
                </h1>
                <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1 truncate">
                  {supplier.business_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="hidden sm:flex items-center gap-1.5 text-xs text-royal-200/70 hover:text-royal-300 font-bold uppercase tracking-wider"
              >
                <ArrowLeft size={14} /> Back to Site
              </Link>
              <button
                onClick={() => logout().then(() => router.replace('/'))}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-royal-100 font-bold uppercase tracking-wider transition-colors"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div
          role="note"
          aria-label={PLATFORM_RULE}
          className="sk-ticker mb-6 flex items-center gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 py-2.5 pl-3 pr-2 overflow-hidden"
        >
          <span className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest">
            नियम
          </span>
          <div className="sk-ticker-track min-w-0 flex-1">
            <p className="sk-ticker-text text-[13px] font-bold text-rose-900">{PLATFORM_RULE}</p>
            <p className="sk-ticker-text text-[13px] font-bold text-rose-900" aria-hidden="true">{PLATFORM_RULE}</p>
          </div>
        </div>

        {!supplier.active && (
          <Banner tone="rose" title="Your supplier account is paused">
            Your products are hidden from customers and you cannot add new ones. Call SafaKing to find out why.
          </Banner>
        )}
        {kyc !== 'verified' && (
          <Banner
            tone="amber"
            title={
              kyc === 'pending'
                ? 'Your documents are being checked'
                : kyc === 'rejected'
                  ? 'A document was rejected. Please upload it again'
                  : 'One step to go live: upload your documents'
            }
            action={{ label: 'Open Documents', onClick: () => setTab('documents') }}
          >
            Your products cannot go live until your shop photo and bank proof are approved.
          </Banner>
        )}
        {setupMissing && (
          <Banner
            tone="amber"
            title="Set your pincode and delivery charges"
            action={{ label: 'Set delivery charges', onClick: () => setTab('delivery') }}
          >
            Customers pay these on top of your price. Your products cannot be approved until they are set.
          </Banner>
        )}
        {error && (
          <div className="flex items-start gap-2 p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Stat icon={PackageCheck} tone="amber" label="New orders to pack" value={String(stats.toPack)} />
          <Stat icon={Truck} tone="emerald" label="Paid, ready to send" value={String(stats.readyToSend)} />
          <Stat icon={Clock} tone="royal" label="Waiting for balance" value={String(stats.awaitingBalance)} />
          <Stat icon={IndianRupee} tone="emerald" label="Paid to you" value={rupees(stats.paidToYou)} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 custom-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all ${
                tab === id
                  ? 'bg-maroon-950 text-royal-300 shadow-md'
                  : 'bg-white text-gray-600 border border-amber-200/60 hover:text-maroon-900'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === 'orders' && (
          <SupplierOrders orders={orders} loading={ordersLoading} holdDays={rates.holdDays} onChanged={loadOrders} />
        )}
        {tab === 'products' && <SupplierProducts supplier={supplier} rates={rates} />}
        {tab === 'payments' && <SupplierPayouts supplier={supplier} orders={orders} rates={rates} />}
        {tab === 'delivery' && <SupplierProfileForm supplier={supplier} onSaved={setSupplier} />}
        {tab === 'documents' && user && <VerificationPanel ownerId={user.id} subjectType="supplier" />}
      </main>
    </div>
  );
}

function Banner({
  tone, title, children, action,
}: {
  tone: 'amber' | 'rose';
  title: string;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  const colours = tone === 'rose' ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-amber-50 border-amber-300 text-amber-900';
  return (
    <div className={`flex flex-wrap items-start gap-3 p-5 mb-6 rounded-3xl border-2 shadow-sm ${colours}`}>
      <ShieldAlert size={22} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-[200px]">
        <p className="font-display font-black text-base">{title}</p>
        <p className="text-xs leading-relaxed mt-1">{children}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-xl bg-maroon-950 hover:bg-maroon-900 text-royal-300 text-[11px] font-bold uppercase tracking-wider"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function Stat({
  icon: Icon, tone, label, value,
}: {
  icon: typeof Package;
  tone: 'amber' | 'emerald' | 'royal';
  label: string;
  value: string;
}) {
  const colours = {
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    royal: 'bg-royal-100 text-royal-800',
  }[tone];
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="p-5 rounded-3xl bg-white border border-amber-200/60 shadow-sm flex items-center gap-4"
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${colours}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-tight">{label}</p>
        <p className="text-2xl font-display font-black text-maroon-950 mt-0.5 truncate">{value}</p>
      </div>
    </motion.div>
  );
}
