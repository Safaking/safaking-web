'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Crown, Search, Heart, ShoppingBag, Menu, X, User, ShieldCheck, LogOut,
  ChevronDown, CalendarRange, Sparkles, MessageSquare, Users, GraduationCap,
  Briefcase, Info, Store, Phone, ScrollText,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

interface HeaderProps {
  wishlistCount: number;
  onOpenAuth: () => void;
}

interface NavItem {
  href: string;
  label: string;
  hint?: string;
  icon?: typeof Crown;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Ten flat links had outgrown the bar. Grouping them keeps the top level to six
 * and gives each destination a one-line description, which matters here because
 * "Plan Event", "Get Quotes" and "Rent Safa" are not self-explanatory names.
 */
const DIRECT_LINKS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/#suppliers', label: 'Suppliers' },
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Services',
    items: [
      { href: '/rent', label: 'Rent a Safa', hint: 'Safas for your event dates', icon: CalendarRange },
      { href: '/plan', label: 'Plan My Event', hint: 'Guests in, full quotation out', icon: Sparkles },
      { href: '/enquiry', label: 'Get Quotes', hint: 'Let artists bid for your wedding', icon: MessageSquare },
      { href: '/#artists', label: 'Book a Safa Artist', hint: 'Tying at your venue', icon: Crown },
    ],
  },
  {
    label: 'Artists',
    items: [
      { href: '/artists', label: 'Browse Artists', hint: 'Portfolios, ratings and rates', icon: Users },
      { href: '/#artists', label: 'Join as an Artist', hint: 'Get paid wedding work', icon: Crown },
    ],
  },
  {
    label: 'Academy',
    items: [
      { href: '/#training', label: 'Training Courses', hint: 'Learn safa tying', icon: GraduationCap },
      { href: '/academy', label: 'My Training', hint: 'Your batch and certificate', icon: ShieldCheck },
      { href: '/knowledge', label: 'Knowledge Center', hint: 'History, colours & technique', icon: ScrollText },
    ],
  },
  {
    label: 'More',
    items: [
      { href: '/about', label: 'About', hint: 'Who we are', icon: Info },
      { href: '/careers', label: 'Careers', hint: 'Work with SafaKing', icon: Briefcase },
      { href: '/contact', label: 'Contact Us', hint: 'Talk to our team', icon: Phone },
    ],
  },
];

function DesktopDropdown({
  group, open, onOpen, onClose,
}: {
  group: NavGroup;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A small delay stops the menu flickering shut when the pointer crosses the
  // gap between the trigger and the panel.
  const scheduleClose = () => {
    closeTimer.current = setTimeout(onClose, 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  useEffect(() => () => cancelClose(), []);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        onOpen();
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => (open ? onClose() : onOpen())}
        className={`flex items-center gap-1 px-3.5 py-2 text-xs font-bold tracking-widest uppercase rounded-full transition-all duration-300 ${
          open
            ? 'text-maroon-700 bg-royal-100/60'
            : 'text-maroon-900/70 hover:text-maroon-700 hover:bg-royal-100/60'
        }`}
      >
        {group.label}
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            // AnimatePresence tracks children by key; giving the panel an
            // explicit one keeps its exit animation attached to this group.
            key={`${group.label}-panel`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.14 }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="absolute left-0 top-full pt-2 w-64 z-50"
          >
            <div className="bg-white rounded-2xl shadow-xl shadow-maroon-900/10 border border-royal-200/70 p-2">
              {group.items.map((item) => (
                <Link
                  key={`${group.label}-${item.href}-${item.label}`}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-royal-50 transition-colors group"
                >
                  {item.icon && (
                    <span className="w-8 h-8 rounded-lg bg-royal-100 text-royal-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-maroon-950 group-hover:text-royal-300 transition-colors">
                      <item.icon size={15} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-maroon-950">{item.label}</span>
                    {item.hint && (
                      <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">
                        {item.hint}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Header({ wishlistCount, onOpenAuth }: HeaderProps) {
  const { user, profile, role, logout } = useAuth();
  const { count: cartCount, openCart } = useCart();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<string | null>(null);

  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeAll = useCallback(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, []);

  // Escape closes any open menu; a click outside closes the desktop dropdown.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll();
    };
    const onClick = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [closeAll]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-lg shadow-maroon-900/5 border-b border-royal-200/50'
          : 'bg-maroon-950/20 backdrop-blur-sm border-b border-royal-400/10'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <motion.div
              whileHover={{ rotate: 8, scale: 1.05 }}
              className="w-12 h-12 shrink-0"
            >
              <Image src="/logo.png" alt="SafaKing" width={48} height={48} className="w-full h-full object-contain" priority />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-xl xl:text-2xl font-display font-black text-maroon-800 tracking-widest uppercase leading-none">
                SafaKing
              </span>
              <span className="text-[9px] font-bold tracking-[0.3em] text-royal-600 uppercase mt-0.5">
                Royal Turban House
              </span>
            </div>
          </Link>

          <nav ref={navRef} className="hidden lg:flex items-center gap-0.5">
            {DIRECT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3.5 py-2 text-xs font-bold tracking-widest uppercase text-maroon-900/70 hover:text-maroon-700 hover:bg-royal-100/60 rounded-full transition-all duration-300"
              >
                {link.label}
              </Link>
            ))}

            {NAV_GROUPS.map((group) => (
              <DesktopDropdown
                key={group.label}
                group={group}
                open={openGroup === group.label}
                onOpen={() => setOpenGroup(group.label)}
                onClose={() => setOpenGroup(null)}
              />
            ))}

            {role === 'artist' && (
              <Link
                href="/artist-portal"
                className="px-3 py-1.5 ml-1 text-[10px] font-black uppercase tracking-wider bg-royal-500 text-maroon-950 rounded-full shadow-md hover:bg-royal-400 transition-colors whitespace-nowrap"
              >
                Artist Portal
              </Link>
            )}
            {role !== 'artist' && role !== 'admin' && (
              <Link
                href="/artist-portal"
                className="px-3 py-1.5 ml-1 text-[10px] font-black uppercase tracking-wider text-maroon-900/70 border border-maroon-900/20 rounded-full hover:bg-maroon-900/5 transition-colors whitespace-nowrap"
              >
                Are You a Safa Artist?
              </Link>
            )}
            {role === 'admin' && (
              <Link
                href="/admin"
                className="px-3 py-1.5 ml-1 text-[10px] font-black uppercase tracking-wider bg-maroon-950 text-royal-300 rounded-full shadow-md hover:bg-maroon-900 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <ShieldCheck size={12} /> Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link
              href="/shop"
              className="hidden sm:flex text-maroon-800/70 hover:text-maroon-700 transition-colors"
              aria-label="Search the shop"
            >
              <Search size={20} />
            </Link>

            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-maroon-900 hidden xl:inline">
                  {profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                </span>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 text-maroon-800/70 hover:text-maroon-700 transition-colors"
                  title="Sign out"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1 text-maroon-800/70 hover:text-maroon-700 transition-colors"
                title="Account Login / Register"
              >
                <User size={20} />
              </button>
            )}

            <Link
              href="/shop"
              className="relative text-maroon-800/70 hover:text-maroon-700 transition-colors"
              aria-label="Wishlist"
            >
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-maroon-700 text-royal-100 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <button
              onClick={openCart}
              className="relative text-maroon-800/70 hover:text-maroon-700 transition-colors"
              aria-label="Open shopping bag"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-royal-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden text-maroon-800"
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* ---- Mobile: the same grouping as an accordion ---- */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white/97 backdrop-blur-xl border-t border-royal-200/50 overflow-hidden max-h-[75vh] overflow-y-auto custom-scrollbar"
          >
            <nav className="flex flex-col p-4 gap-1">
              {DIRECT_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeAll}
                  className="px-4 py-3 text-sm font-bold tracking-wider uppercase text-maroon-800 hover:bg-royal-50 rounded-xl transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              {NAV_GROUPS.map((group) => {
                const open = mobileSection === group.label;
                return (
                  <div key={group.label}>
                    <button
                      type="button"
                      onClick={() => setMobileSection(open ? null : group.label)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold tracking-wider uppercase text-maroon-800 hover:bg-royal-50 rounded-xl transition-colors"
                    >
                      {group.label}
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                      />
                    </button>

                    <AnimatePresence>
                      {open && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-3 py-1 space-y-0.5">
                            {group.items.map((item) => (
                              <Link
                                key={`${group.label}-${item.href}-${item.label}`}
                                href={item.href}
                                onClick={closeAll}
                                className="flex items-start gap-3 px-4 py-2.5 rounded-xl hover:bg-royal-50 transition-colors"
                              >
                                {item.icon && (
                                  <span className="w-7 h-7 rounded-lg bg-royal-100 text-royal-800 flex items-center justify-center shrink-0 mt-0.5">
                                    <item.icon size={14} />
                                  </span>
                                )}
                                <span className="min-w-0">
                                  <span className="block text-xs font-bold text-maroon-950">
                                    {item.label}
                                  </span>
                                  {item.hint && (
                                    <span className="block text-[11px] text-gray-500 leading-snug">
                                      {item.hint}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              <div className="border-t border-royal-100 mt-2 pt-2 space-y-1">
                {user && (
                  <Link
                    href="/my-bookings"
                    onClick={closeAll}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold tracking-wider uppercase text-maroon-800 hover:bg-royal-50 rounded-xl"
                  >
                    <Store size={15} /> My Bookings
                  </Link>
                )}

                {role === 'artist' && (
                  <Link
                    href="/artist-portal"
                    onClick={closeAll}
                    className="px-4 py-3 text-sm font-black tracking-wider uppercase bg-royal-500 text-maroon-950 rounded-xl block"
                  >
                    Artist Portal ➔
                  </Link>
                )}
                {role !== 'artist' && role !== 'admin' && (
                  <Link
                    href="/artist-portal"
                    onClick={closeAll}
                    className="px-4 py-3 text-sm font-bold tracking-wider uppercase text-maroon-800 border border-maroon-900/20 rounded-xl block"
                  >
                    Are You a Safa Artist? ➔
                  </Link>
                )}
                {role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={closeAll}
                    className="px-4 py-3 text-sm font-black tracking-wider uppercase bg-maroon-950 text-royal-300 rounded-xl flex items-center gap-1.5"
                  >
                    <ShieldCheck size={15} /> Admin Panel ➔
                  </Link>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
