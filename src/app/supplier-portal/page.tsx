'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, friendlyError } from '@/lib/supabase';
import {
  DEFAULT_SUPPLIER_RATES, SupplierOrder, SupplierProfile, SupplierRates, loadSupplierRates,
} from '@/lib/supplier';
import { SupplierDashboard, SupplierTab, isSupplierTab } from '@/components/supplier/SupplierDashboard';

function SupplierPortalContent() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The tab lives in the address, so the Android app's bottom tabs (and a
  // shared link) can open the right one.
  const tabParam = searchParams.get('tab');
  const tab: SupplierTab = isSupplierTab(tabParam) ? tabParam : 'orders';

  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [rates, setRates] = useState<SupplierRates>(DEFAULT_SUPPLIER_RATES);

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

  if (authLoading || loading || !supplier || !user) {
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

  return (
    <SupplierDashboard
      supplier={supplier}
      userId={user.id}
      orders={orders}
      ordersLoading={ordersLoading}
      rates={rates}
      error={error}
      tab={tab}
      onTabChange={(next) => router.replace(`/supplier-portal?tab=${next}`, { scroll: false })}
      onOrdersChanged={loadOrders}
      onSupplierSaved={setSupplier}
      onLogout={() => logout().then(() => router.replace('/'))}
    />
  );
}

export default function SupplierPortalPage() {
  return (
    <Suspense fallback={null}>
      <SupplierPortalContent />
    </Suspense>
  );
}
