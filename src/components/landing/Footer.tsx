'use client';

import Link from 'next/link';
import { Crown, Share2, MessageCircle, Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-maroon-950 text-royal-200/60 border-t border-royal-400/10">
      {/* Marquee strip */}
      <div className="overflow-hidden py-3 border-b border-royal-400/10 bg-maroon-900/50">
        <div className="animate-marquee whitespace-nowrap flex">
          {[...Array(2)].map((_, setIdx) => (
            <span key={setIdx} className="inline-flex items-center gap-8 px-4 text-[11px] font-bold uppercase tracking-[0.3em] text-royal-400/50">
              <span>Royal Safas</span>
              <Crown size={12} />
              <span>Master Artists</span>
              <Crown size={12} />
              <span>Training Academy</span>
              <Crown size={12} />
              <span>Supplier Network</span>
              <Crown size={12} />
              <span>Free Pan-India Shipping</span>
              <Crown size={12} />
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-royal-gradient flex items-center justify-center">
                <Crown size={20} className="text-royal-300" />
              </div>
              <div>
                <p className="font-display font-black text-royal-100 text-lg tracking-widest uppercase">SafaKing</p>
                <p className="text-[10px] tracking-[0.3em] text-royal-400/60 uppercase">Royal Turban House</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed max-w-xs">
              India&apos;s premier destination for royal safas, master safa artists, artisan training, and supplier partnerships.
            </p>
            <div className="flex gap-3">
              {[Share2, MessageCircle].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-full border border-royal-400/20 flex items-center justify-center text-royal-400/60 hover:text-royal-300 hover:border-royal-400/40 transition-colors"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-royal-100 text-sm mb-4 uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-2.5 text-xs">
              {[
                { href: '/shop', label: 'Shop All Safas' },
                { href: '#artists', label: 'Book Safa Artist' },
                { href: '#training', label: 'Training Academy' },
                { href: '#suppliers', label: 'Supplier Registration' },
                { href: '/careers', label: 'Careers' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-royal-300 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-royal-100 text-sm mb-4 uppercase tracking-wider">Collections</h4>
            <ul className="space-y-2.5 text-xs">
              {['Groom Collection', 'Jodhpuri Silk', 'Bandhani & Leheriya', 'Brooch & Kalgi'].map((item) => (
                <li key={item}>
                  <Link href="/shop" className="hover:text-royal-300 transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-royal-100 text-sm mb-4 uppercase tracking-wider">Contact</h4>
            <ul className="space-y-3 text-xs">
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-royal-400 shrink-0" />
                +91 98765 43210
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-royal-400 shrink-0" />
                hello@safaking.com
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="text-royal-400 shrink-0 mt-0.5" />
                MI Road, Jaipur, Rajasthan 302001
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-royal-400/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-royal-400/40">
          <p>
            © 2026 SafaKing Royal Turban House. All Rights Reserved. | Designed & Developed by{' '}
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="text-royal-400/60 hover:text-royal-300 font-bold underline transition-colors"
            >
              patidarmk
            </a>
          </p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-royal-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-royal-300 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
