'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Home, ShoppingBag, CalendarRange, User, ShieldCheck, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

/**
 * Fixed bottom tab bar, mobile only — the single highest-leverage change for
 * making the site read as an app rather than a page: a persistent nav rail
 * instead of a hamburger menu the visitor has to remember exists.
 *
 * Every route already renders through this root layout, so this bar is
 * available everywhere even though most pages (shop/rent/plan/etc.) hand-roll
 * their own header rather than reusing <Header>.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role } = useAuth();
  const { count: cartCount, openCart } = useCart();

  const accountHref = !user
    ? '/?auth=login'
    : role === 'admin'
      ? '/admin'
      : role === 'artist'
        ? '/artist-portal'
        : '/my-bookings';

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const tabs = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/shop', label: 'Shop', icon: ShoppingBag },
    { href: '/rent', label: 'Rent', icon: CalendarRange },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-royal-200/60 shadow-[0_-4px_20px_rgba(139,30,47,0.08)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 h-16">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 touch-manipulation"
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} className={active ? 'text-maroon-700' : 'text-maroon-900/50'} />
              <span className={`text-[10px] font-bold tracking-wide uppercase ${active ? 'text-maroon-700' : 'text-maroon-900/50'}`}>
                {label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => {
            openCart();
            if (pathname !== '/shop') router.push('/shop');
          }}
          className="relative flex flex-col items-center justify-center gap-1 touch-manipulation"
        >
          <span className="relative">
            <ShoppingCart size={22} strokeWidth={1.8} className="text-maroon-900/50" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-royal-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </span>
          <span className="text-[10px] font-bold tracking-wide uppercase text-maroon-900/50">Bag</span>
        </button>

        <Link
          href={accountHref}
          className="flex flex-col items-center justify-center gap-1 touch-manipulation"
        >
          {role === 'admin' ? (
            <ShieldCheck size={22} strokeWidth={1.8} className={isActive('/admin') ? 'text-maroon-700' : 'text-maroon-900/50'} />
          ) : (
            <User size={22} strokeWidth={1.8} className={isActive('/my-bookings') || isActive('/artist-portal') ? 'text-maroon-700' : 'text-maroon-900/50'} />
          )}
          <span className="text-[10px] font-bold tracking-wide uppercase text-maroon-900/50">
            {user ? 'Account' : 'Login'}
          </span>
        </Link>
      </div>
    </nav>
  );
}
