'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingBag, Star, Eye, X, ArrowRight, Crown } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

export interface SafaProduct {
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
  imagePosition?: string;
  description: string;
}

export const FEATURED_SAFAS: SafaProduct[] = [
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
    imagePosition: 'object-center',
    description:
      'Exquisite pearl pink Chanderi silk safa adorned with rich floral gold zari borders and handcrafted jewel plume brooch holder.',
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
    imagePosition: 'object-top',
    description:
      'Deep crimson maroon brocade safa featuring opulent metallic gold weave pattern and traditional flared kalgi tail.',
  },
  {
    id: 'safa-03',
    name: 'Royal Jodhpuri Navy Velvet Safa',
    code: 'SFA-NVY-803',
    price: 4799,
    originalPrice: 6499,
    rating: 4.9,
    reviewsCount: 56,
    color: 'Navy Blue',
    fabric: 'Velvet Brocade',
    style: 'Jodhpuri Royal',
    occasion: 'Baraat / Wedding',
    inStock: true,
    isBestseller: true,
    image: '/artist-jodhpuri-blue.jpg',
    imagePosition: 'object-top',
    description:
      'Majestic navy blue velvet safa with gold zari embroidery and sapphire-studded kalgi — the ultimate royal statement.',
  },
  {
    id: 'safa-04',
    name: 'Grand Maroon Groom Shahi Safa',
    code: 'SFA-GRM-804',
    price: 5299,
    originalPrice: 7499,
    rating: 5.0,
    reviewsCount: 29,
    color: 'Maroon & Gold',
    fabric: 'Heavy Silk Brocade',
    style: 'Rajputi Pagdi',
    occasion: 'Wedding Baraat',
    inStock: true,
    image: '/hero-groom-maroon.jpg',
    imagePosition: 'object-top',
    description:
      'The ultimate groom safa — rich maroon velvet with gold zari, emerald-studded kalgi, and triple-strand pearl chains.',
  },
];

interface FeaturedCollectionProps {
  wishlist: string[];
  onToggleWishlist: (id: string) => void;
  onAddToCart: (product: SafaProduct) => void;
}

export function FeaturedCollection({ wishlist, onToggleWishlist, onAddToCart }: FeaturedCollectionProps) {
  const [quickViewProduct, setQuickViewProduct] = useState<SafaProduct | null>(null);
  const [addedToCart, setAddedToCart] = useState<string | null>(null);

  const handleAddToCart = (product: SafaProduct) => {
    onAddToCart(product);
    setAddedToCart(product.id);
    setTimeout(() => setAddedToCart(null), 1500);
  };

  const discount = (p: SafaProduct) =>
    Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);

  return (
    <section className="py-28 px-4 sm:px-6 lg:px-8 bg-cream-gradient overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-14 gap-4">
            <div>
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="text-xs font-bold uppercase tracking-widest text-royal-600 mb-2 block flex items-center gap-2"
              >
                <Crown size={12} /> Curated For You
              </motion.span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-black text-maroon-900">
                Featured Royal Collection
              </h2>
              <p className="text-sm text-maroon-800/50 mt-2">
                Our most sought-after groom safas for wedding ceremonies
              </p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/shop"
                className="text-xs font-bold text-maroon-700 hover:text-maroon-900 flex items-center gap-1.5 group bg-white px-6 py-3 rounded-full border border-royal-200 shadow-sm hover:shadow-md transition-all"
              >
                View All Collection
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURED_SAFAS.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                whileHover={{ y: -10 }}
                className="bg-white rounded-3xl border border-royal-200/60 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-maroon-900/15 transition-shadow duration-500 group flex flex-col"
              >
                {/* Image */}
                <div className="relative aspect-[3/4] bg-royal-50 overflow-hidden">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className={`object-cover ${product.imagePosition || 'object-center'} group-hover:scale-110 transition-transform duration-700`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-maroon-950/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Discount badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-3 left-3 bg-maroon-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full"
                  >
                    -{discount(product)}%
                  </motion.div>

                  {product.isBestseller && (
                    <span className="absolute top-9 left-3 bg-royal-500 text-maroon-950 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                      Bestseller
                    </span>
                  )}
                  {product.isNew && (
                    <span className="absolute top-9 left-3 bg-maroon-700 text-royal-100 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                      New
                    </span>
                  )}

                  {/* Wishlist */}
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onToggleWishlist(product.id)}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full glass-card flex items-center justify-center shadow-sm"
                  >
                    <Heart
                      size={15}
                      className={wishlist.includes(product.id) ? 'fill-maroon-700 text-maroon-700' : 'text-maroon-800'}
                    />
                  </motion.button>

                  {/* Quick View */}
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    whileHover={{ opacity: 1, y: 0 }}
                    onClick={() => setQuickViewProduct(product)}
                    className="absolute bottom-3 left-3 right-3 bg-white/95 text-maroon-900 text-xs font-bold py-2.5 rounded-xl backdrop-blur-sm flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md"
                  >
                    <Eye size={14} /> Quick View
                  </motion.button>
                </div>

                {/* Info */}
                <div className="p-5 flex flex-col flex-1 justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-royal-700 uppercase tracking-wider mb-1.5">
                      <span>{product.fabric}</span>
                      <span className="flex items-center text-royal-600 gap-1">
                        <Star size={11} className="fill-royal-500 text-royal-500" /> {product.rating}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-maroon-900 text-sm leading-snug line-clamp-2 mb-3 group-hover:text-maroon-700 transition-colors">
                      {product.name}
                    </h3>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-xl font-display font-bold text-maroon-900">
                        ₹{product.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-maroon-800/30 line-through">
                        ₹{product.originalPrice.toLocaleString()}
                      </span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleAddToCart(product)}
                      className={`w-full text-xs font-bold uppercase tracking-wider py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 ${
                        addedToCart === product.id
                          ? 'bg-green-600 text-white'
                          : 'bg-maroon-700 hover:bg-maroon-800 text-white'
                      }`}
                    >
                      {addedToCart === product.id ? (
                        <>
                          <CheckCircleIcon /> Added!
                        </>
                      ) : (
                        <>
                          <ShoppingBag size={14} /> Add to Bag
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick View Modal */}
      <AnimatePresence>
        {quickViewProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-maroon-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setQuickViewProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setQuickViewProduct(null)}
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-royal-100 flex items-center justify-center text-maroon-700 hover:bg-royal-200 transition-colors shadow-md"
              >
                <X size={18} />
              </motion.button>
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="relative aspect-[3/4] md:aspect-auto min-h-[300px] bg-royal-50">
                  <Image
                    src={quickViewProduct.image}
                    alt={quickViewProduct.name}
                    fill
                    className={`object-cover ${quickViewProduct.imagePosition || 'object-center'}`}
                  />
                </div>
                <div className="p-7 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-royal-700 bg-royal-100 px-3 py-1 rounded-full border border-royal-200">
                      {quickViewProduct.style}
                    </span>
                    <h2 className="font-display font-bold text-xl text-maroon-900 mt-4 mb-1">
                      {quickViewProduct.name}
                    </h2>
                    <p className="text-xs font-mono text-maroon-800/30 mb-4">{quickViewProduct.code}</p>
                    <p className="text-sm text-maroon-800/60 leading-relaxed mb-4">
                      {quickViewProduct.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        { label: 'Color', value: quickViewProduct.color },
                        { label: 'Fabric', value: quickViewProduct.fabric },
                        { label: 'Occasion', value: quickViewProduct.occasion },
                        { label: 'Rating', value: `${quickViewProduct.rating} ★` },
                      ].map((d) => (
                        <div key={d.label} className="bg-royal-50 rounded-xl p-2.5">
                          <p className="text-[10px] text-royal-700 font-bold uppercase tracking-wider">{d.label}</p>
                          <p className="text-xs text-maroon-900 font-semibold mt-0.5">{d.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-2xl font-display font-bold text-maroon-900">
                        ₹{quickViewProduct.price.toLocaleString()}
                      </span>
                      <span className="text-sm text-maroon-800/30 line-through">
                        ₹{quickViewProduct.originalPrice.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-maroon-700 bg-maroon-100 px-2 py-0.5 rounded-full">
                        -{discount(quickViewProduct)}% OFF
                      </span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        handleAddToCart(quickViewProduct);
                        setTimeout(() => setQuickViewProduct(null), 600);
                      }}
                      className="w-full bg-maroon-700 hover:bg-maroon-800 text-white text-xs font-bold uppercase tracking-wider py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <ShoppingBag size={16} /> Add to Shopping Bag
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
