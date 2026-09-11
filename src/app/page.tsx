'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TopBanner } from '@/components/landing/TopBanner';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { TrustBar } from '@/components/landing/TrustBar';
import { IntroVideo } from '@/components/landing/IntroVideo';
import { ArtistsSection } from '@/components/landing/ArtistsSection';
import { FeaturedCollection } from '@/components/landing/FeaturedCollection';
import { TrainingSection } from '@/components/landing/TrainingSection';
import { SupplierSection } from '@/components/landing/SupplierSection';
import { Footer } from '@/components/landing/Footer';
import { AuthModal } from '@/components/auth/AuthModal';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { fetchProducts, StoreProduct } from '@/lib/products';
import { useWishlist } from '@/hooks/useWishlist';

function LandingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [authOpen, setAuthOpen] = useState(false);
  // Starts empty rather than STATIC_PRODUCTS — showing demo products while
  // the real catalogue is still loading, with nothing to say so, read as
  // "the site is broken" the moment the fetch took longer than the
  // preloader's fixed 2200ms. productsLoading drives a real skeleton instead.
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [denied, setDenied] = useState<string | null>(null);
  const { wishlist, toggle: toggleWishlist } = useWishlist();

  // The page used to sit behind a full-screen loader for a fixed 2.2 seconds
  // on every visit, whatever the connection. It is gone: the page shows as
  // soon as it arrives, and the product grid has its own skeleton.

  // The browser's native #hash scroll fires before the sections below the
  // fold have their final height, so it lands short. Re-scroll once the
  // layout has settled.
  useEffect(() => {
    if (!window.location.hash) return;
    const id = window.location.hash.slice(1);
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetchProducts().then((result) => {
      if (active) {
        setProducts(result.products);
        setProductsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Middleware bounces unauthorised portal visits back here with a hint.
  useEffect(() => {
    if (searchParams.get('auth') === 'login') setAuthOpen(true);

    const deniedFor = searchParams.get('denied');
    if (!deniedFor) return;

    setDenied(deniedFor);
    const timer = setTimeout(() => setDenied(null), 6000);
    return () => clearTimeout(timer);
  }, [searchParams]);

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    if (searchParams.get('auth')) router.replace('/');
  }, [searchParams, router]);

  const featured = products.filter((p) => p.featured).slice(0, 4);

  return (
    <>
      {denied && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl bg-rose-600 text-white text-xs font-bold shadow-2xl">
          You don&apos;t have access to the {denied === 'admin' ? 'admin panel' : 'artist portal'}.
        </div>
      )}

      <div className="min-h-screen bg-royal-50 text-maroon-950">
        <TopBanner />
        <Header onOpenAuth={() => setAuthOpen(true)} wishlistCount={wishlist.length} />
        <Hero />
        <TrustBar />
        <IntroVideo />
        <ArtistsSection onRequireSignIn={() => setAuthOpen(true)} />
        <FeaturedCollection
          products={featured.length > 0 ? featured : products.slice(0, 4)}
          loading={productsLoading}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
        />
        <TrainingSection />
        <SupplierSection />
        <Footer />
      </div>

      <AuthModal isOpen={authOpen} onClose={closeAuth} redirectTo={searchParams.get('next')} />
      <CartDrawer />
    </>
  );
}

export default function SafaKingLanding() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-royal-50" />}>
      <LandingContent />
    </Suspense>
  );
}
