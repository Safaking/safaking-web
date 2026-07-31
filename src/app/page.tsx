'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TopBanner } from '@/components/landing/TopBanner';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { TrustBar } from '@/components/landing/TrustBar';
import { ArtistsSection } from '@/components/landing/ArtistsSection';
import { FeaturedCollection, SafaProduct } from '@/components/landing/FeaturedCollection';
import { TrainingSection } from '@/components/landing/TrainingSection';
import { SupplierSection } from '@/components/landing/SupplierSection';
import { Footer } from '@/components/landing/Footer';
import { Preloader } from '@/components/landing/Preloader';
import { AuthModal } from '@/components/auth/AuthModal';
import { CartDrawer } from '@/components/cart/CartDrawer';

export default function SafaKingLanding() {
  const [isLoading, setIsLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<SafaProduct[]>([]);

  useEffect(() => {
    // Hide loading screen after 2.2 seconds (matching the loading bar duration)
    const timer = setTimeout(() => setIsLoading(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  const toggleWishlist = (id: string) => {
    setWishlist((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const addToCart = (product: SafaProduct) => {
    setCart((prev) => [...prev, product]);
    setCartOpen(true);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && <Preloader key="loader" />}
      </AnimatePresence>

      <div className="min-h-screen bg-royal-50 text-maroon-950">
        <TopBanner />
        <Header
          wishlistCount={wishlist.length}
          cartCount={cart.length}
          onOpenAuth={() => setAuthOpen(true)}
          onOpenCart={() => setCartOpen(true)}
        />
        <Hero />
        <TrustBar />
        <ArtistsSection />
        <FeaturedCollection
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          onAddToCart={addToCart}
        />
        <TrainingSection />
        <SupplierSection />
        <Footer />
      </div>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onRemoveItem={removeFromCart}
        onClearCart={() => setCart([])}
      />
    </>
  );
}

