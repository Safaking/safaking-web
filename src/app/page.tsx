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

export default function SafaKingLanding() {
  const [isLoading, setIsLoading] = useState(true);
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
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && <Preloader key="loader" />}
      </AnimatePresence>

      <div className="min-h-screen bg-royal-50 text-maroon-950">
        <TopBanner />
        <Header wishlistCount={wishlist.length} cartCount={cart.length} />
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
    </>
  );
}
