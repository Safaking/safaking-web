'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Search, ShoppingCart, Home, ShoppingBag, CalendarRange, LayoutGrid, Truck, Package, Wallet, Store,
  CalendarCheck, BellRing, MapPin, User, Crown, Sparkles, MessageSquare, GraduationCap, ScrollText, Info, Phone,
  Briefcase, LogOut, ShieldCheck, RefreshCw, FileText, BookOpen,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { hasOpenOverlay, runBackHandler, useBackHandler, useNativeApp } from '@/lib/native-app';

interface TabItem {
  label: string;
  icon: typeof Home;
  href?: string;
  action?: 'cart' | 'more';
  active: boolean;
  onSelect?: () => void;
}

interface SheetLink {
  href: string;
  label: string;
  icon: typeof Home;
}

/** Most specific first. */
const TITLES: [string, string][] = [
  ['/supplier-portal/login', 'Supplier Login'],
  ['/supplier-portal/status', 'Supplier Application'],
  ['/artist-portal/login', 'Artist Login'],
  ['/artist-portal/status', 'Artist Application'],
  ['/shop', 'Shop'],
  ['/rent', 'Rent a Safa'],
  ['/plan', 'Plan My Event'],
  ['/enquiry', 'Get Quotes'],
  ['/my-bookings', 'My Bookings & Orders'],
  ['/artists', 'Safa Artists'],
  ['/academy', 'My Training'],
  ['/knowledge', 'Safa Knowledge'],
  ['/about', 'About SafaKing'],
  ['/contact', 'Contact Us'],
  ['/careers', 'Careers'],
  ['/policies', 'Policies'],
  ['/documents', 'Document'],
  ['/reset-password', 'Reset Password'],
];

const titleFor = (pathname: string) =>
  TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? 'SafaKing';

/** Pages where pulling down reloads. Not the forms, where a reload would lose what was typed. */
const PULL_TO_REFRESH = ['/', '/shop', '/my-bookings', '/supplier-portal', '/artist-portal', '/knowledge', '/academy'];

/** Pages that already render the bag drawer. Elsewhere the bag opens on the shop. */
const PAGES_WITH_BAG = ['/', '/shop'];

/**
 * The app's own chrome inside the Android app: an app bar instead of the
 * site's header and hamburger menu, bottom tabs that change inside the
 * supplier and artist portals, a More sheet, the back button, and pull to
 * refresh. Renders nothing on the website.
 */
export function AppShell() {
  const native = useNativeApp();
  if (!native) return null;
  return (
    <Suspense fallback={null}>
      <NativeAppShell />
    </Suspense>
  );
}

function NativeAppShell() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile, role, logout } = useAuth();
  const { count: cartCount, openCart } = useCart();

  const [moreOpen, setMoreOpen] = useState(false);
  const [hash, setHash] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isSupplier, setIsSupplier] = useState(false);
  const [typing, setTyping] = useState(false);
  const pullRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The admin panel is a desktop tool with its own navigation.
  const bare = pathname.startsWith('/admin');
  const inSupplierPortal = pathname === '/supplier-portal';
  const inArtistPortal = pathname === '/artist-portal';
  const supplierTab = searchParams.get('tab') ?? 'orders';

  useEffect(() => {
    document.documentElement.classList.toggle('sk-app-bare', bare);
  }, [bare]);

  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [pathname]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!user) {
      setIsSupplier(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('supplier_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsSupplier(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const closeMore = useCallback(() => setMoreOpen(false), []);
  useBackHandler(moreOpen, closeMore);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  // While the keyboard is up the tab bar would ride on top of it and eat a
  // row of the little space left, which no native app does. Hide it while a
  // field has focus and the screen has shrunk for the keyboard.
  useEffect(() => {
    let tallest = window.innerHeight;
    const editing = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
      return el.tagName === 'INPUT'
        && !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes((el as HTMLInputElement).type);
    };
    const update = () => {
      tallest = Math.max(tallest, window.innerHeight);
      setTyping(editing() && window.innerHeight < tallest * 0.8);
    };
    const later = () => setTimeout(update, 250);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', later);
    document.addEventListener('focusout', later);
    return () => {
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', later);
      document.removeEventListener('focusout', later);
    };
  }, []);

  // The Android back button: close what is open, go back, and on Home ask
  // for a second press before leaving the app.
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    let cancelled = false;
    let lastPress = 0;
    import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('backButton', ({ canGoBack }) => {
          if (runBackHandler()) return;
          if (window.location.pathname === '/') {
            const now = Date.now();
            if (now - lastPress < 2000) {
              App.exitApp();
              return;
            }
            lastPress = now;
            showToast('Press back again to exit');
            return;
          }
          // Capacitor's canGoBack asks the native WebView, which does not count
          // the site's own page changes (history.pushState) — so back from
          // Home → Shop → Contact landed on Home. The page's Navigation API
          // counts them; history.length is the fallback for older WebViews.
          const nav = (window as unknown as { navigation?: { canGoBack?: boolean } }).navigation;
          const pageCanGoBack = typeof nav?.canGoBack === 'boolean' ? nav.canGoBack : window.history.length > 1;
          if (canGoBack || pageCanGoBack) window.history.back();
          else router.replace('/');
        })
      )
      .then((listener) => {
        if (cancelled) listener.remove();
        else handle = listener;
      })
      .catch(() => {
        /* no back button outside the app */
      });
    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, [router, showToast]);

  // Pull down at the top of the page to reload it.
  const pullAllowed = PULL_TO_REFRESH.includes(pathname);
  useEffect(() => {
    if (!pullAllowed) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const reset = () => {
      if (pullRef.current !== 0) {
        pullRef.current = 0;
        setPull(0);
      }
    };
    const onStart = (event: TouchEvent) => {
      tracking = event.touches.length === 1 && window.scrollY <= 0 && !hasOpenOverlay();
      if (!tracking) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    };
    const onMove = (event: TouchEvent) => {
      if (!tracking) return;
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
        reset();
        return;
      }
      pullRef.current = Math.min(dy * 0.5, 90);
      setPull(pullRef.current);
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (pullRef.current >= 70) {
        setRefreshing(true);
        window.location.reload();
      }
      reset();
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [pullAllowed]);

  if (bare) return null;

  const openBag = () => {
    openCart();
    if (!PAGES_WITH_BAG.includes(pathname)) router.push('/shop');
  };

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.replace('/');
  };

  const more: TabItem = { label: 'More', icon: LayoutGrid, action: 'more', active: moreOpen };

  const tabs: TabItem[] = inSupplierPortal
    ? [
        { label: 'Orders', icon: Truck, href: '/supplier-portal?tab=orders', active: supplierTab === 'orders' },
        { label: 'Products', icon: Package, href: '/supplier-portal?tab=products', active: supplierTab === 'products' },
        { label: 'Payments', icon: Wallet, href: '/supplier-portal?tab=payments', active: supplierTab === 'payments' },
        {
          label: 'Profile',
          icon: Store,
          href: '/supplier-portal?tab=delivery',
          active: supplierTab === 'delivery' || supplierTab === 'documents',
        },
        more,
      ]
    : inArtistPortal
      ? [
          { label: 'Bookings', icon: CalendarCheck, hash: '#artist-bookings' },
          { label: 'Leads', icon: BellRing, hash: '#artist-leads' },
          { label: 'Check-in', icon: MapPin, hash: '#artist-checkin' },
          { label: 'Profile', icon: User, hash: '#artist-profile' },
        ]
          .map(
            (tab, index): TabItem => ({
              label: tab.label,
              icon: tab.icon,
              href: `/artist-portal${tab.hash}`,
              active: hash === tab.hash || (index === 0 && hash === ''),
              onSelect: () => setHash(tab.hash),
            })
          )
          .concat(more)
      : [
          { label: 'Home', icon: Home, href: '/', active: pathname === '/' },
          { label: 'Shop', icon: ShoppingBag, href: '/shop', active: pathname.startsWith('/shop') },
          { label: 'Rent', icon: CalendarRange, href: '/rent', active: pathname.startsWith('/rent') },
          { label: 'Bag', icon: ShoppingCart, action: 'cart', active: false },
          more,
        ];

  const portalRoot = pathname === '/' || inSupplierPortal || inArtistPortal;
  const title = inSupplierPortal ? 'Supplier Portal' : inArtistPortal ? 'Artist Portal' : titleFor(pathname);
  const showShopActions = !inSupplierPortal && !inArtistPortal;

  const accountSection: SheetLink[] = inSupplierPortal
    ? [
        { href: '/supplier-portal?tab=documents', label: 'Documents', icon: FileText },
        { href: '/supplier-portal?tab=delivery', label: 'Delivery Charges', icon: Truck },
        { href: '/', label: 'SafaKing Shop', icon: ShoppingBag },
      ]
    : inArtistPortal
      ? [
          { href: '/artist-portal#artist-profile', label: 'Documents', icon: FileText },
          { href: '/artist-portal#artist-bookings', label: 'My Bookings', icon: CalendarCheck },
          { href: '/', label: 'SafaKing Shop', icon: ShoppingBag },
        ]
      : [];

  const sections: { title: string; links: SheetLink[] }[] = [
    ...(accountSection.length ? [{ title: 'Your account', links: accountSection }] : []),
    {
      title: 'Book & plan',
      links: [
        { href: '/#artist-booking-form', label: 'Book an Artist', icon: Crown },
        { href: '/plan', label: 'Plan My Event', icon: Sparkles },
        { href: '/enquiry', label: 'Get Quotes', icon: MessageSquare },
      ],
    },
    {
      title: 'Learn',
      links: [
        { href: '/#training', label: 'Safa Academy', icon: GraduationCap },
        { href: '/academy', label: 'My Training', icon: BookOpen },
        { href: '/knowledge', label: 'Safa Knowledge', icon: ScrollText },
      ],
    },
    {
      title: 'Work with SafaKing',
      links: [
        role === 'artist'
          ? { href: '/artist-portal', label: 'Artist Portal', icon: Crown }
          : { href: '/artist-portal/login?tab=join', label: 'Join as Artist', icon: Crown },
        isSupplier
          ? { href: '/supplier-portal', label: 'Supplier Portal', icon: Store }
          : { href: '/supplier-portal/login?tab=join', label: 'Sell on SafaKing', icon: Store },
        { href: '/careers', label: 'Careers', icon: Briefcase },
      ],
    },
    {
      title: 'SafaKing',
      links: [
        { href: '/about', label: 'About Us', icon: Info },
        { href: '/contact', label: 'Contact', icon: Phone },
        { href: '/policies', label: 'Policies', icon: FileText },
      ],
    },
  ];

  const displayName = profile?.full_name || user?.email?.split('@')[0] || '';
  const roleLabel =
    role === 'admin' ? 'Owner' : role === 'manager' ? 'SafaKing staff' : role === 'artist' ? 'Safa artist' : isSupplier ? 'Supplier' : 'Customer';

  return (
    <>
      <header
        className="fixed top-0 inset-x-0 z-40 bg-maroon-950 text-white shadow-lg shadow-maroon-950/20"
        style={{ paddingTop: 'var(--sk-safe-top, 0px)' }}
      >
        <div className="h-14 flex items-center gap-1 px-2">
          {portalRoot ? (
            <Link href={pathname} className="flex items-center gap-2 pl-1.5 min-w-0">
              <Image src="/logo.png" alt="SafaKing" width={34} height={34} className="w-[34px] h-[34px] object-contain shrink-0" priority />
              {pathname === '/' ? (
                <span className="font-display font-black text-lg tracking-[0.2em] uppercase text-royal-100">SafaKing</span>
              ) : (
                <span className="font-display font-bold text-[17px] text-royal-100 truncate">{title}</span>
              )}
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={goBack}
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:bg-white/10"
                aria-label="Back"
              >
                <ArrowLeft size={22} />
              </button>
              <h1 className="font-display font-bold text-[17px] text-royal-100 truncate">{title}</h1>
            </>
          )}
          {showShopActions && (
            <div className="ml-auto flex items-center shrink-0">
              <Link href="/shop" className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/10" aria-label="Search safas">
                <Search size={21} />
              </Link>
              <button
                type="button"
                onClick={openBag}
                className="relative w-11 h-11 rounded-full flex items-center justify-center active:bg-white/10"
                aria-label="Open bag"
              >
                <ShoppingCart size={21} />
                {cartCount > 0 && (
                  <span className="absolute top-1.5 right-1 min-w-4 h-4 px-1 rounded-full bg-royal-500 text-maroon-950 text-[10px] font-black flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </header>

      {(pull > 0 || refreshing) && (
        <div
          className="fixed inset-x-0 z-30 flex justify-center pointer-events-none"
          style={{ top: 'calc(3.5rem + var(--sk-safe-top, 0px))', transform: `translateY(${refreshing ? 20 : pull * 0.6}px)` }}
        >
          <span className="w-9 h-9 rounded-full bg-white shadow-lg border border-royal-200 flex items-center justify-center">
            <RefreshCw
              size={17}
              className={`text-maroon-800 ${refreshing ? 'animate-spin' : ''}`}
              style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)`, opacity: Math.min(1, pull / 70) }}
            />
          </span>
        </div>
      )}

      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-royal-200/70 shadow-[0_-6px_24px_rgba(74,14,26,0.08)]"
        style={{ paddingBottom: 'var(--sk-safe-bottom, 0px)' }}
        hidden={typing}
      >
        <div className="grid grid-cols-5 h-16">
          {tabs.map((tab) => {
            const inner = (
              <>
                <span
                  className={`relative flex items-center justify-center w-14 h-8 rounded-full transition-colors ${
                    tab.active ? 'bg-royal-100' : ''
                  }`}
                >
                  <tab.icon
                    size={21}
                    strokeWidth={tab.active ? 2.4 : 1.8}
                    className={tab.active ? 'text-maroon-800' : 'text-maroon-900/55'}
                  />
                  {tab.action === 'cart' && cartCount > 0 && (
                    <span className="absolute -top-0.5 right-2 min-w-4 h-4 px-1 rounded-full bg-maroon-700 text-white text-[10px] font-black flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </span>
                <span className={`text-[10px] font-bold tracking-wide ${tab.active ? 'text-maroon-800' : 'text-maroon-900/55'}`}>
                  {tab.label}
                </span>
              </>
            );
            const className = 'flex flex-col items-center justify-center gap-0.5 touch-manipulation';
            return tab.href ? (
              <Link
                key={tab.label}
                href={tab.href}
                replace={inSupplierPortal || inArtistPortal}
                scroll={!inSupplierPortal}
                onClick={tab.onSelect}
                className={className}
              >
                {inner}
              </Link>
            ) : (
              <button
                key={tab.label}
                type="button"
                onClick={() => (tab.action === 'cart' ? openBag() : setMoreOpen((open) => !open))}
                className={className}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              key="more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMore}
              className="fixed inset-0 z-[45] bg-maroon-950/50"
            />
            <motion.div
              key="more-sheet"
              role="dialog"
              aria-label="More"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) closeMore();
              }}
              className="fixed inset-x-0 bottom-0 z-[46] bg-[#FDF6EC] rounded-t-3xl max-h-[85vh] overflow-y-auto pb-[calc(1.25rem+var(--sk-safe-bottom,0px))] shadow-2xl"
            >
              <div className="sticky top-0 z-10 bg-[#FDF6EC] pt-3 pb-3 flex justify-center">
                <span className="w-10 h-1.5 rounded-full bg-maroon-900/15" />
              </div>

              <div className="mx-4 p-4 rounded-2xl bg-maroon-950 text-white flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-royal-500 text-maroon-950 flex items-center justify-center font-display font-black text-lg shrink-0">
                  {user ? (displayName[0] ?? 'S').toUpperCase() : <User size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{user ? displayName : 'Welcome to SafaKing'}</p>
                  <p className="text-[11px] text-royal-200/70 truncate">
                    {user ? roleLabel : 'Sign in for your bookings and orders'}
                  </p>
                </div>
                {user ? (
                  <Link href="/my-bookings" className="px-3 py-2 rounded-xl bg-royal-500 text-maroon-950 text-[11px] font-bold shrink-0">
                    My Bookings
                  </Link>
                ) : (
                  <Link href="/?auth=login" className="px-4 py-2 rounded-xl bg-royal-500 text-maroon-950 text-[11px] font-bold shrink-0">
                    Login
                  </Link>
                )}
              </div>

              {(role === 'admin' || role === 'manager') && (
                <Link
                  href="/admin"
                  className="mx-4 mt-3 p-3 rounded-2xl bg-white border border-royal-200 flex items-center gap-3 text-sm font-bold text-maroon-950"
                >
                  <ShieldCheck size={18} className="text-maroon-700" /> Admin Panel
                </Link>
              )}

              {sections.map((section) => (
                <div key={section.title} className="px-4 mt-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-maroon-900/50 mb-2 px-1">{section.title}</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {section.links.map((link) => (
                      <Link
                        key={`${section.title}-${link.label}`}
                        href={link.href}
                        className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white border border-royal-200/70 active:bg-royal-50 text-center min-h-[5.25rem]"
                      >
                        <span className="w-10 h-10 rounded-xl bg-royal-100 text-maroon-800 flex items-center justify-center">
                          <link.icon size={19} />
                        </span>
                        <span className="text-[11px] font-bold text-maroon-950 leading-tight">{link.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {user && (
                <button
                  type="button"
                  onClick={() => {
                    closeMore();
                    logout().then(() => router.replace('/'));
                  }}
                  className="mx-4 mt-6 w-[calc(100%-2rem)] py-3 rounded-2xl border-2 border-maroon-900/15 text-maroon-800 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <LogOut size={15} /> Log out
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed inset-x-0 bottom-[calc(5rem+var(--sk-safe-bottom,0px))] z-50 flex justify-center pointer-events-none"
          >
            <span className="px-4 py-2.5 rounded-full bg-maroon-950 text-white text-xs font-bold shadow-xl">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
