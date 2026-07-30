'use client';

import { useState } from 'react';
import { TopBanner } from '@/components/landing/TopBanner';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { TrustBar } from '@/components/landing/TrustBar';
import { ArtistsSection } from '@/components/landing/ArtistsSection';
import { FeaturedCollection, SafaProduct } from '@/components/landing/FeaturedCollection';
import { TrainingSection } from '@/components/landing/TrainingSection';
import { SupplierSection } from '@/components/landing/SupplierSection';
import { Footer } from '@/components/landing/Footer';

export default function SafaKingLanding() {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<SafaProduct[]>([]);

  const toggleWishlist = (id: string) => {
    setWishlist((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const addToCart = (product: SafaProduct) => {
    setCart((prev) => [...prev, product]);
  };

  return (
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
  );
}
