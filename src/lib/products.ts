import { supabase, DBProductWithAvailability } from '@/lib/supabase';

/** The shape every product-rendering component in the app consumes. */
export interface StoreProduct {
  id: string;
  /** Real products.id uuid when the row came from the DB, null for the static fallback. */
  productId: string | null;
  code: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  category: string;
  color: string;
  fabric: string;
  style: string;
  occasion: string;
  image: string;
  imagePosition?: string;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  isNew: boolean;
  isBestseller: boolean;
  featured: boolean;
}

/**
 * Rendered before the DB responds, and whenever the products table is empty or
 * unreachable, so the storefront is never a blank grid.
 */
export const STATIC_PRODUCTS: StoreProduct[] = [
  {
    id: 'SFA-PRL-801', productId: null, code: 'SFA-PRL-801',
    name: 'Imperial Pearl Pink Chanderi Silk Safa',
    description:
      'Exquisite pearl pink Chanderi silk safa adorned with rich floral gold zari borders and handcrafted jewel plume brooch holder. Designed for royal wedding grooms.',
    price: 3499, originalPrice: 4999, category: 'Groom', color: 'Pink',
    fabric: 'Chanderi Silk', style: 'Royal Groom', occasion: 'Wedding / Groom',
    image: '/product-pink-chanderi.jpg', imagePosition: 'object-center',
    rating: 4.9, reviewsCount: 42, inStock: true, isNew: false, isBestseller: true, featured: true,
  },
  {
    id: 'SFA-MRN-802', productId: null, code: 'SFA-MRN-802',
    name: 'Heritage Maroon Zari Brocade Royal Safa',
    description:
      'Deep crimson maroon brocade safa featuring opulent metallic gold weave pattern and traditional flared kalgi tail. Ideal for grand ceremonial wear.',
    price: 4199, originalPrice: 5999, category: 'Jodhpuri', color: 'Maroon',
    fabric: 'Brocade Silk', style: 'Jodhpuri Royal', occasion: 'Wedding / Reception',
    image: '/product-maroon-brocade.jpg', imagePosition: 'object-top',
    rating: 4.8, reviewsCount: 38, inStock: true, isNew: true, isBestseller: false, featured: true,
  },
  {
    id: 'SFA-NVY-803', productId: null, code: 'SFA-NVY-803',
    name: 'Royal Jodhpuri Navy Velvet Safa',
    description:
      'Majestic navy blue velvet safa with gold zari embroidery and sapphire-studded kalgi — the ultimate royal statement.',
    price: 4799, originalPrice: 6499, category: 'Jodhpuri', color: 'Navy Blue',
    fabric: 'Velvet Brocade', style: 'Jodhpuri Royal', occasion: 'Baraat / Wedding',
    image: '/artist-jodhpuri-blue.jpg', imagePosition: 'object-top',
    rating: 4.9, reviewsCount: 56, inStock: true, isNew: false, isBestseller: true, featured: true,
  },
  {
    id: 'SFA-GRM-804', productId: null, code: 'SFA-GRM-804',
    name: 'Grand Maroon Groom Shahi Safa',
    description:
      'The ultimate groom safa — rich maroon velvet with gold zari, emerald-studded kalgi, and triple-strand pearl chains.',
    price: 5299, originalPrice: 7499, category: 'Groom', color: 'Maroon & Gold',
    fabric: 'Heavy Silk Brocade', style: 'Rajputi Pagdi', occasion: 'Wedding Baraat',
    image: '/hero-groom-maroon.jpg', imagePosition: 'object-top',
    rating: 5.0, reviewsCount: 29, inStock: true, isNew: false, isBestseller: false, featured: true,
  },
  {
    id: 'SFA-BGE-805', productId: null, code: 'SFA-BGE-805',
    name: 'Royal Beige & Champagne Zardosi Safa',
    description:
      'Regal champagne beige raw silk turban tailored with traditional pleating, subtle gold highlights, and delicate pearl detailing.',
    price: 2999, originalPrice: 3999, category: 'Groom', color: 'Beige',
    fabric: 'Banarasi Raw Silk', style: 'Classic Elegance', occasion: 'Baraat / Sangeet',
    image: '/artist-jodhpuri-blue.jpg',
    rating: 4.7, reviewsCount: 29, inStock: true, isNew: false, isBestseller: true, featured: false,
  },
  {
    id: 'SFA-LHR-806', productId: null, code: 'SFA-LHR-806',
    name: 'Traditional Rajasthani Bandhani Leheriya Safa',
    description:
      'Vibrant dual-tone hand-dyed Jaipur Bandhani leheriya safa in auspicious crimson and yellow with zari border finish.',
    price: 2299, originalPrice: 3199, category: 'Bandhani', color: 'Red & Yellow',
    fabric: 'Georgette Silk', style: 'Bandhani Leheriya', occasion: 'Festive / Haldi / Mehendi',
    image: '/product-maroon-brocade.jpg',
    rating: 4.9, reviewsCount: 65, inStock: true, isNew: false, isBestseller: false, featured: false,
  },
  {
    id: 'SFA-EMR-807', productId: null, code: 'SFA-EMR-807',
    name: 'Emerald Velvet Embroidered Royal Safa',
    description:
      'Heavy emerald green velvet safa with ornate zardosi handwork along the pleats and crowned with pearl motif brooch detailing.',
    price: 4899, originalPrice: 6499, category: 'Groom', color: 'Green',
    fabric: 'Micro Velvet', style: 'Groom Luxury', occasion: 'Royal Reception',
    image: '/artist-jodhpuri-blue.jpg',
    rating: 5.0, reviewsCount: 19, inStock: true, isNew: true, isBestseller: false, featured: false,
  },
  {
    id: 'SFA-PCH-808', productId: null, code: 'SFA-PCH-808',
    name: 'Peach Pastel Chanderi Floral Safa',
    description:
      'Soft peach pastel safa ideal for contemporary destination weddings and sunlit day ceremonies. Features gold lace trim.',
    price: 2699, originalPrice: 3499, category: 'Groom', color: 'Peach',
    fabric: 'Chanderi Silk', style: 'Modern Pastel', occasion: 'Day Wedding / Destination',
    image: '/product-pink-chanderi.jpg',
    rating: 4.6, reviewsCount: 22, inStock: true, isNew: false, isBestseller: false, featured: false,
  },
  {
    id: 'SFA-GLD-809', productId: null, code: 'SFA-GLD-809',
    name: 'Sun Gold Kanjeevaram Silk Safa',
    description:
      'Lustrous golden yellow silk safa with temple zari borders, creating a grand traditional aesthetic for groom and groomsmen.',
    price: 3799, originalPrice: 4999, category: 'Groom', color: 'Gold',
    fabric: 'Kanjeevaram Silk', style: 'South Royal', occasion: 'Wedding Ceremony',
    image: '/product-maroon-brocade.jpg',
    rating: 4.8, reviewsCount: 31, inStock: true, isNew: false, isBestseller: false, featured: false,
  },
  {
    id: 'SFA-BLU-810', productId: null, code: 'SFA-BLU-810',
    name: 'Midnight Blue Velvet Zari Safa',
    description:
      'Sophisticated dark navy blue safa with subtle silver-gold zari embroidery along the tail and crown fold.',
    price: 4399, originalPrice: 5799, category: 'Jodhpuri', color: 'Blue',
    fabric: 'Velvet Silk Blend', style: 'Imperial Night', occasion: 'Sangeet / Evening Gala',
    image: '/artist-jodhpuri-blue.jpg',
    rating: 4.9, reviewsCount: 27, inStock: true, isNew: false, isBestseller: false, featured: false,
  },
];

export function mapDBProduct(row: DBProductWithAvailability): StoreProduct {
  return {
    id: row.id,
    productId: row.id,
    code: row.code ?? '',
    name: row.name,
    description: row.description ?? '',
    price: row.price,
    originalPrice: row.original_price ?? row.price,
    category: row.category ?? '',
    color: row.color ?? '',
    fabric: row.fabric ?? '',
    style: row.style ?? '',
    occasion: row.occasion ?? '',
    image: row.image ?? '/product-maroon-brocade.jpg',
    rating: Number(row.rating ?? 4.8),
    reviewsCount: row.reviews_count ?? 0,
    // Own stock minus what the desktop POS has committed against this SKU —
    // see public.products_with_availability.
    inStock: (row.available_quantity ?? row.stock ?? 0) > 0,
    isNew: !!row.is_new,
    isBestseller: !!row.is_bestseller,
    featured: !!(row as DBProductWithAvailability & { featured?: boolean }).featured,
  };
}

export interface ProductsResult {
  products: StoreProduct[];
  /** True when the DB answered with rows; false means we fell back to STATIC_PRODUCTS. */
  fromDatabase: boolean;
  error: string | null;
}

/**
 * Loads the live catalogue.
 *
 * The database is the single source of truth. An EMPTY products table now
 * returns an empty list rather than the demo catalogue — previously an admin
 * could delete every product and still see ten items on the storefront, i.e.
 * the shop and the admin panel were showing two different catalogues.
 *
 * STATIC_PRODUCTS is kept only for a hard connection/permission failure, so a
 * transient outage doesn't render a blank shop. `fromDatabase` tells the caller
 * which one it got.
 */
export async function fetchProducts(): Promise<ProductsResult> {
  const { data, error } = await supabase
    .from('products_with_availability')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(
      '[products] Falling back to the demo catalogue — the storefront is NOT showing your database. ' +
        'Apply supabase/002_production_hardening.sql and supabase/017_desktop_inventory_sync.sql. Cause:',
      error.message
    );
    return { products: STATIC_PRODUCTS, fromDatabase: false, error: error.message };
  }

  return {
    products: (data as DBProductWithAvailability[]).map(mapDBProduct),
    fromDatabase: true,
    error: null,
  };
}
