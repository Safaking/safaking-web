'use client';

import Link from 'next/link';
import { Crown, Search, Heart, ShoppingBag, Menu, X, User, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  wishlistCount: number;
  cartCount: number;
  onOpenAuth: () => void;
  onOpenCart: () => void;
}

const NAV_LINKS = [
  { href: '#home', label: 'Home' },
  { href: '#artists', label: 'Safa Artists' },
  { href: '#training', label: 'Training' },
  { href: '#suppliers', label: 'Suppliers' },
  { href: '/shop', label: 'Shop' },
  { href: '/careers', label: 'Careers' },
];

export function Header({ wishlistCount, cartCount, onOpenAuth, onOpenCart }: HeaderProps) {
  const { user, profile, role } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-lg shadow-maroon-900/5 border-b border-royal-200/50'
          : 'bg-maroon-950/20 backdrop-blur-sm border-b border-royal-400/10'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ rotate: 12, scale: 1.05 }}
              className="w-11 h-11 rounded-full bg-royal-gradient flex items-center justify-center shadow-lg shadow-maroon-800/30"
            >
              <Crown size={22} className="text-royal-300" />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-2xl font-display font-black text-maroon-800 tracking-widest uppercase">
                SafaKing
              </span>
              <span className="text-[10px] font-bold tracking-[0.35em] text-royal-600 uppercase -mt-0.5">
                Royal Turban House
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-maroon-900/70 hover:text-maroon-700 hover:bg-royal-100/60 rounded-full transition-all duration-300"
              >
                {link.label}
              </Link>
            ))}

            {/* Role Links */}
            {role === 'artist' && (
              <Link
                href="/artist-portal"
                className="px-3.5 py-1.5 ml-2 text-[11px] font-black uppercase tracking-wider bg-royal-500 text-maroon-950 rounded-full shadow-md hover:bg-royal-400 transition-colors"
              >
                Artist Portal ➔
              </Link>
            )}
            {role === 'admin' && (
              <Link
                href="/admin"
                className="px-3.5 py-1.5 ml-2 text-[11px] font-black uppercase tracking-wider bg-maroon-950 text-royal-300 rounded-full shadow-md hover:bg-maroon-900 transition-colors flex items-center gap-1"
              >
                <ShieldCheck size={13} /> Admin Panel ➔
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/shop"
              className="hidden sm:flex text-maroon-800/70 hover:text-maroon-700 transition-colors"
            >
              <Search size={20} />
            </Link>

            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1 text-maroon-800/70 hover:text-maroon-700 transition-colors"
              title="Account Login / Portal"
            >
              <User size={20} />
              {user && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-maroon-900 hidden md:inline">
                  {profile?.full_name?.split(' ')[0]}
                </span>
              )}
            </button>

            <button className="relative text-maroon-800/70 hover:text-maroon-700 transition-colors">
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-maroon-700 text-royal-100 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenCart}
              className="relative text-maroon-800/70 hover:text-maroon-700 transition-colors"
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
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white/95 backdrop-blur-xl border-t border-royal-200/50 overflow-hidden"
          >
            <nav className="flex flex-col p-4 gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 text-sm font-bold tracking-wider uppercase text-maroon-800 hover:bg-royal-50 rounded-xl transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
