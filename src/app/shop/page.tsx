'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { 
  Search, 
  Heart, 
  ShoppingBag, 
  Filter, 
  SlidersHorizontal, 
  Star, 
  Truck, 
  RotateCcw, 
  Shield, 
  X, 
  Eye, 
  Sparkles, 
  Crown 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SafaProduct {
  id: string;
  name: string;
  code: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviewsCount: number;
  color: string;
  fabric: string;
  style: string;
  occasion: string;
  inStock: boolean;
  isNew?: boolean;
  isBestseller?: boolean;
  image: string;
  description: string;
}

const SAFA_PRODUCTS: SafaProduct[] = [
  {
    id: 'safa-01',
    name: 'Imperial Pearl Pink Chanderi Silk Safa',
    code: 'SFA-PRL-801',
    price: 3499,
    originalPrice: 4999,
    rating: 4.9,
    reviewsCount: 42,
    color: 'Pink',
    fabric: 'Chanderi Silk',
    style: 'Royal Groom',
    occasion: 'Wedding / Groom',
    inStock: true,
    isBestseller: true,
    image: '/product-pink-chanderi.jpg',
    description: 'Exquisite pearl pink Chanderi silk safa adorned with rich floral gold zari borders and handcrafted jewel plume brooch holder. Designed for royal wedding grooms.'
  },
  {
    id: 'safa-02',
    name: 'Heritage Maroon Zari Brocade Royal Safa',
    code: 'SFA-MRN-802',
    price: 4199,
    originalPrice: 5999,
    rating: 4.8,
    reviewsCount: 38,
    color: 'Maroon',
    fabric: 'Brocade Silk',
    style: 'Jodhpuri Royal',
    occasion: 'Wedding / Reception',
    inStock: true,
    isNew: true,
    image: '/product-maroon-brocade.jpg',
    description: 'Deep crimson maroon brocade safa featuring opulent metallic gold weave pattern and traditional flared kalgi tail. Ideal for grand ceremonial wear.'
  },
  {
    id: 'safa-03',
    name: 'Royal Beige & Champagne Zardosi Safa',
    code: 'SFA-BGE-803',
    price: 2999,
    originalPrice: 3999,
    rating: 4.7,
    reviewsCount: 29,
    color: 'Beige',
    fabric: 'Banarasi Raw Silk',
    style: 'Classic Elegance',
    occasion: 'Baraat / Sangeet',
    inStock: true,
    isBestseller: true,
    image: '/artist-jodhpuri-blue.jpg',
    description: 'Regal champagne beige raw silk turban tailored with traditional pleating, subtle gold highlights, and delicate pearl detailing.'
  },
  {
    id: 'safa-04',
    name: 'Traditional Rajasthani Bandhani Leheriya Safa',
    code: 'SFA-LHR-804',
    price: 2299,
    originalPrice: 3199,
    rating: 4.9,
    reviewsCount: 65,
    color: 'Red & Yellow',
    fabric: 'Georgette Silk',
    style: 'Bandhani Leheriya',
    occasion: 'Festive / Haldi / Mehendi',
    inStock: true,
    image: '/product-maroon-brocade.jpg',
    description: 'Vibrant dual-tone hand-dyed Jaipur Bandhani leheriya safa in auspicious crimson and yellow with zari border finish.'
  },
  {
    id: 'safa-05',
    name: 'Emerald Velvet Embroidered Royal Safa',
    code: 'SFA-EMR-805',
    price: 4899,
    originalPrice: 6499,
    rating: 5.0,
    reviewsCount: 19,
    color: 'Green',
    fabric: 'Micro Velvet',
    style: 'Groom Luxury',
    occasion: 'Royal Reception',
    inStock: true,
    isNew: true,
    image: '/artist-jodhpuri-blue.jpg',
    description: 'Heavy emerald green velvet safa with ornate zardosi handwork along the pleats and crowned with pearl motif brooch detailing.'
  },
  {
    id: 'safa-06',
    name: 'Peach Pastel Chanderi Floral Safa',
    code: 'SFA-PCH-806',
    price: 2699,
    originalPrice: 3499,
    rating: 4.6,
    reviewsCount: 22,
    color: 'Peach',
    fabric: 'Chanderi Silk',
    style: 'Modern Pastel',
    occasion: 'Day Wedding / Destination',
    inStock: true,
    image: '/product-pink-chanderi.jpg',
    description: 'Soft peach pastel safa ideal for contemporary destination weddings and sunlit day ceremonies. Features gold lace trim.'
  },
  {
    id: 'safa-07',
    name: 'Sun Gold Kanjeevaram Silk Safa',
    code: 'SFA-GLD-807',
    price: 3799,
    originalPrice: 4999,
    rating: 4.8,
    reviewsCount: 31,
    color: 'Gold',
    fabric: 'Kanjeevaram Silk',
    style: 'South Royal',
    occasion: 'Wedding Ceremony',
    inStock: true,
    image: '/product-maroon-brocade.jpg',
    description: 'Lustrous golden yellow silk safa with temple zari borders, creating a grand traditional aesthetic for groom and groomsmen.'
  },
  {
    id: 'safa-08',
    name: 'Midnight Blue Velvet Zari Safa',
    code: 'SFA-NVY-808',
    price: 4399,
    originalPrice: 5799,
    rating: 4.9,
    reviewsCount: 27,
    color: 'Blue',
    fabric: 'Velvet Silk Blend',
    style: 'Imperial Night',
    occasion: 'Sangeet / Evening Gala',
    inStock: true,
    image: '/artist-jodhpuri-blue.jpg',
    description: 'Sophisticated dark navy blue safa with subtle silver-gold zari embroidery along the tail and crown fold.'
  }
];

function ShopContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedColor, setSelectedColor] = useState<string>('All');
  const [selectedFabric, setSelectedFabric] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<SafaProduct[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<SafaProduct | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('category')) {
      setSelectedCategory(searchParams.get('category')!);
    }
  }, [searchParams]);

  const filteredProducts = SAFA_PRODUCTS.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.fabric.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesColor = selectedColor === 'All' || product.color === selectedColor;
    const matchesFabric = selectedFabric === 'All' || product.fabric === selectedFabric;
    const matchesCategory = selectedCategory === 'All' || product.style.includes(selectedCategory);

    return matchesSearch && matchesColor && matchesFabric && matchesCategory;
  }).sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    if (sortBy === 'rating') return b.rating - a.rating;
    return 0;
  });

  const toggleWishlist = (id: string) => {
    setWishlist(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const addToCart = (product: SafaProduct) => {
    setCart(prev => [...prev, product]);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 font-sans selection:bg-[#8B1E2F] selection:text-white">
      {/* Top Banner */}
      <div className="bg-[#8B1E2F] text-amber-200 text-xs font-semibold tracking-widest text-center py-2.5 px-4 flex justify-center items-center gap-2">
        <Sparkles size={14} className="animate-pulse text-amber-300" />
        <span>SAFAKING • FULL COLLECTION STORE • FREE ALL-INDIA EXPRESS SHIPPING</span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-950/10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#8B1E2F] text-amber-300 flex items-center justify-center shadow-md">
                <Crown size={22} />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl sm:text-3xl font-serif font-black text-[#8B1E2F] tracking-widest uppercase">
                  SAFAKING
                </span>
                <span className="text-[10px] font-sans font-bold tracking-[0.35em] text-amber-800 uppercase -mt-1">
                  ROYAL TURBAN HOUSE
                </span>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center space-x-8 text-xs font-bold tracking-widest text-slate-700 uppercase">
              <Link href="/" className="hover:text-[#8B1E2F] transition-colors">Home</Link>
              <button onClick={() => setSelectedCategory('All')} className={`hover:text-[#8B1E2F] transition-colors ${selectedCategory === 'All' ? 'text-[#8B1E2F] border-b-2 border-[#8B1E2F] pb-1' : ''}`}>Shop All</button>
              <button onClick={() => setSelectedCategory('Groom')} className={`hover:text-[#8B1E2F] transition-colors ${selectedCategory === 'Groom' ? 'text-[#8B1E2F] border-b-2 border-[#8B1E2F] pb-1' : ''}`}>Groom Collection</button>
              <button onClick={() => setSelectedCategory('Jodhpuri')} className={`hover:text-[#8B1E2F] transition-colors ${selectedCategory === 'Jodhpuri' ? 'text-[#8B1E2F] border-b-2 border-[#8B1E2F] pb-1' : ''}`}>Jodhpuri Silk</button>
              <button onClick={() => setSelectedCategory('Bandhani')} className={`hover:text-[#8B1E2F] transition-colors ${selectedCategory === 'Bandhani' ? 'text-[#8B1E2F] border-b-2 border-[#8B1E2F] pb-1' : ''}`}>Bandhani & Leheriya</button>
            </nav>

            <div className="flex items-center space-x-5">
              <div className="relative hidden md:block w-64">
                <input 
                  type="text" 
                  placeholder="Search Safas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:border-[#8B1E2F] transition-all"
                />
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              </div>

              <button className="relative text-slate-700 hover:text-[#8B1E2F] transition-colors">
                <Heart size={22} />
                {wishlist.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#8B1E2F] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {wishlist.length}
                  </span>
                )}
              </button>

              <button className="relative text-slate-700 hover:text-[#8B1E2F] transition-colors">
                <ShoppingBag size={22} />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Shop Catalog */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold text-slate-900">Royal Safa Shop & Collection</h1>
          <p className="text-xs text-slate-500 mt-1">Explore our complete catalog of handcrafted groom and wedding safas</p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
              className="lg:hidden flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-xs font-bold text-slate-700"
            >
              <SlidersHorizontal size={14} /> Filters
            </button>
            <p className="text-xs font-semibold text-slate-500">
              Showing <span className="text-slate-900 font-bold">{filteredProducts.length}</span> handcrafted safas
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Sort By:</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#8B1E2F]"
            >
              <option value="featured">Featured / Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Customer Rating</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <aside className={`lg:block ${isMobileFilterOpen ? 'block' : 'hidden'} bg-white p-6 rounded-2xl border border-slate-200 shadow-xs h-fit space-y-8`}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-serif font-bold text-slate-900 text-lg flex items-center gap-2">
                <Filter size={18} className="text-[#8B1E2F]" /> Filter Safas
              </h3>
              {(selectedColor !== 'All' || selectedFabric !== 'All' || selectedCategory !== 'All') && (
                <button 
                  onClick={() => { setSelectedColor('All'); setSelectedFabric('All'); setSelectedCategory('All'); }}
                  className="text-[11px] font-bold text-[#8B1E2F] hover:underline"
                >
                  Reset All
                </button>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Color</h4>
              <div className="space-y-2">
                {['All', 'Pink', 'Maroon', 'Beige', 'Red & Yellow', 'Green', 'Peach', 'Gold', 'Blue'].map(color => (
                  <label key={color} className="flex items-center gap-2.5 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="colorFilter" 
                      checked={selectedColor === color}
                      onChange={() => setSelectedColor(color)}
                      className="text-[#8B1E2F] focus:ring-[#8B1E2F]"
                    />
                    <span className={`text-xs font-medium ${selectedColor === color ? 'text-[#8B1E2F] font-bold' : 'text-slate-600 group-hover:text-slate-900'}`}>
                      {color}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Fabric Material</h4>
              <div className="space-y-2">
                {['All', 'Chanderi Silk', 'Brocade Silk', 'Banarasi Raw Silk', 'Georgette Silk', 'Micro Velvet', 'Kanjeevaram Silk'].map(fabric => (
                  <label key={fabric} className="flex items-center gap-2.5 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="fabricFilter" 
                      checked={selectedFabric === fabric}
                      onChange={() => setSelectedFabric(fabric)}
                      className="text-[#8B1E2F] focus:ring-[#8B1E2F]"
                    />
                    <span className={`text-xs font-medium ${selectedFabric === fabric ? 'text-[#8B1E2F] font-bold' : 'text-slate-600 group-hover:text-slate-900'}`}>
                      {fabric}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-3 text-slate-600 text-xs">
                <Truck size={18} className="text-[#8B1E2F] shrink-0" />
                <span>Ready to Wear & Custom Tied</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 text-xs">
                <RotateCcw size={18} className="text-[#8B1E2F] shrink-0" />
                <span>7-Day Easy Returns</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 text-xs">
                <Shield size={18} className="text-[#8B1E2F] shrink-0" />
                <span>100% Authentic Quality</span>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <main className="lg:col-span-3">
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredProducts.map(product => (
                  <motion.div 
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 group flex flex-col justify-between"
                  >
                    <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
                      <Image 
                        src={product.image} 
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {product.isBestseller && (
                        <span className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                          Bestseller
                        </span>
                      )}
                      <button 
                        onClick={() => toggleWishlist(product.id)}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-700 hover:text-[#8B1E2F] transition-all shadow-sm"
                      >
                        <Heart size={16} className={wishlist.includes(product.id) ? 'fill-[#8B1E2F] text-[#8B1E2F]' : ''} />
                      </button>
                      <button 
                        onClick={() => setQuickViewProduct(product)}
                        className="absolute bottom-3 left-3 right-3 bg-white/95 text-slate-800 text-xs font-bold py-2 rounded-xl backdrop-blur-xs flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-md"
                      >
                        <Eye size={14} /> Quick View
                      </button>
                    </div>

                    <div className="p-5 flex flex-col flex-1 justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                          <span>{product.fabric}</span>
                          <span className="flex items-center text-amber-600 gap-1">
                            <Star size={12} className="fill-amber-500 text-amber-500" /> {product.rating}
                          </span>
                        </div>

                        <h3 className="font-serif font-bold text-slate-900 text-sm leading-snug line-clamp-2 mb-2 group-hover:text-[#8B1E2F] transition-colors">
                          {product.name}
                        </h3>
                      </div>

                      <div>
                        <div className="flex items-baseline gap-2 mb-4">
                          <span className="text-lg font-bold font-serif text-slate-900">
                            ₹{product.price.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-400 line-through">
                            ₹{product.originalPrice.toLocaleString()}
                          </span>
                        </div>

                        <button 
                          onClick={() => addToCart(product)}
                          className="w-full bg-[#8B1E2F] hover:bg-[#59111E] text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
                        >
                          <ShoppingBag size={14} /> Add to Bag
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </main>
        </div>
      </main>

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="relative aspect-[3/4] min-h-[280px] bg-slate-100">
                <Image
                  src={quickViewProduct.image}
                  alt={quickViewProduct.name}
                  fill
                  className="object-cover object-top"
                />
              </div>

              <div className="p-6 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    {quickViewProduct.style}
                  </span>

                  <h2 className="font-serif font-bold text-xl text-slate-900 mt-3 mb-1">
                    {quickViewProduct.name}
                  </h2>
                  <p className="text-xs font-mono text-slate-400 mb-4">{quickViewProduct.code}</p>

                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {quickViewProduct.description}
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-2xl font-bold font-serif text-slate-900">
                      ₹{quickViewProduct.price.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 line-through">
                      ₹{quickViewProduct.originalPrice.toLocaleString()}
                    </span>
                  </div>

                  <button 
                    onClick={() => { addToCart(quickViewProduct); setQuickViewProduct(null); }}
                    className="w-full bg-[#8B1E2F] hover:bg-[#59111E] text-white text-xs font-bold uppercase tracking-wider py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <ShoppingBag size={16} /> Add to Shopping Bag
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#3D0A13] text-amber-100/70 py-12 border-t border-amber-900/30 text-xs text-center space-y-3">
        <p className="font-serif text-xl font-bold text-amber-200 uppercase tracking-widest">SAFAKING TURBAN HOUSE</p>
        <p className="max-w-md mx-auto text-amber-200/60 font-light">Standalone E-Commerce Safa Store integrated with Supabase.</p>
        <p className="text-[11px] text-amber-200/40">© 2026 SafaKing Web. All Rights Reserved.</p>
      </footer>
    </div>
  );
}

export default function SafaKingShop() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-xs font-bold text-slate-500">Loading Safa Shop...</div>}>
      <ShopContent />
    </Suspense>
  );
}
