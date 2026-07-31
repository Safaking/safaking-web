-- ============================================================================
-- SafaKing — product catalogue seed
-- Run AFTER schema.sql, in: Supabase Dashboard -> SQL Editor
-- Safe to re-run: upserts on the unique product code.
-- ============================================================================

insert into public.products
  (code, name, description, price, original_price, category, color, fabric, style, occasion,
   image, rating, reviews_count, stock, is_new, is_bestseller, featured, active, sort_order)
values
  -- ---- Featured on the landing page ---------------------------------------
  ('SFA-PRL-801', 'Imperial Pearl Pink Chanderi Silk Safa',
   'Exquisite pearl pink Chanderi silk safa adorned with rich floral gold zari borders and handcrafted jewel plume brooch holder. Designed for royal wedding grooms.',
   3499, 4999, 'Groom', 'Pink', 'Chanderi Silk', 'Royal Groom', 'Wedding / Groom',
   '/product-pink-chanderi.jpg', 4.9, 42, 25, false, true, true, true, 1),

  ('SFA-MRN-802', 'Heritage Maroon Zari Brocade Royal Safa',
   'Deep crimson maroon brocade safa featuring opulent metallic gold weave pattern and traditional flared kalgi tail. Ideal for grand ceremonial wear.',
   4199, 5999, 'Jodhpuri', 'Maroon', 'Brocade Silk', 'Jodhpuri Royal', 'Wedding / Reception',
   '/product-maroon-brocade.jpg', 4.8, 38, 18, true, false, true, true, 2),

  ('SFA-NVY-803', 'Royal Jodhpuri Navy Velvet Safa',
   'Majestic navy blue velvet safa with gold zari embroidery and sapphire-studded kalgi — the ultimate royal statement.',
   4799, 6499, 'Jodhpuri', 'Navy Blue', 'Velvet Brocade', 'Jodhpuri Royal', 'Baraat / Wedding',
   '/artist-jodhpuri-blue.jpg', 4.9, 56, 16, false, true, true, true, 3),

  ('SFA-GRM-804', 'Grand Maroon Groom Shahi Safa',
   'The ultimate groom safa — rich maroon velvet with gold zari, emerald-studded kalgi, and triple-strand pearl chains.',
   5299, 7499, 'Groom', 'Maroon & Gold', 'Heavy Silk Brocade', 'Rajputi Pagdi', 'Wedding Baraat',
   '/hero-groom-maroon.jpg', 5.0, 29, 10, false, false, true, true, 4),

  -- ---- Rest of the shop catalogue -----------------------------------------
  ('SFA-BGE-805', 'Royal Beige & Champagne Zardosi Safa',
   'Regal champagne beige raw silk turban tailored with traditional pleating, subtle gold highlights, and delicate pearl detailing.',
   2999, 3999, 'Groom', 'Beige', 'Banarasi Raw Silk', 'Classic Elegance', 'Baraat / Sangeet',
   '/artist-jodhpuri-blue.jpg', 4.7, 29, 30, false, true, false, true, 5),

  ('SFA-LHR-806', 'Traditional Rajasthani Bandhani Leheriya Safa',
   'Vibrant dual-tone hand-dyed Jaipur Bandhani leheriya safa in auspicious crimson and yellow with zari border finish.',
   2299, 3199, 'Bandhani', 'Red & Yellow', 'Georgette Silk', 'Bandhani Leheriya', 'Festive / Haldi / Mehendi',
   '/product-maroon-brocade.jpg', 4.9, 65, 40, false, false, false, true, 6),

  ('SFA-EMR-807', 'Emerald Velvet Embroidered Royal Safa',
   'Heavy emerald green velvet safa with ornate zardosi handwork along the pleats and crowned with pearl motif brooch detailing.',
   4899, 6499, 'Groom', 'Green', 'Micro Velvet', 'Groom Luxury', 'Royal Reception',
   '/artist-jodhpuri-blue.jpg', 5.0, 19, 12, true, false, false, true, 7),

  ('SFA-PCH-808', 'Peach Pastel Chanderi Floral Safa',
   'Soft peach pastel safa ideal for contemporary destination weddings and sunlit day ceremonies. Features gold lace trim.',
   2699, 3499, 'Groom', 'Peach', 'Chanderi Silk', 'Modern Pastel', 'Day Wedding / Destination',
   '/product-pink-chanderi.jpg', 4.6, 22, 22, false, false, false, true, 8),

  ('SFA-GLD-809', 'Sun Gold Kanjeevaram Silk Safa',
   'Lustrous golden yellow silk safa with temple zari borders, creating a grand traditional aesthetic for groom and groomsmen.',
   3799, 4999, 'Groom', 'Gold', 'Kanjeevaram Silk', 'South Royal', 'Wedding Ceremony',
   '/product-maroon-brocade.jpg', 4.8, 31, 20, false, false, false, true, 9),

  ('SFA-BLU-810', 'Midnight Blue Velvet Zari Safa',
   'Sophisticated dark navy blue safa with subtle silver-gold zari embroidery along the tail and crown fold.',
   4399, 5799, 'Jodhpuri', 'Blue', 'Velvet Silk Blend', 'Imperial Night', 'Sangeet / Evening Gala',
   '/artist-jodhpuri-blue.jpg', 4.9, 27, 15, false, false, false, true, 10)

on conflict (code) do update set
  name           = excluded.name,
  description    = excluded.description,
  price          = excluded.price,
  original_price = excluded.original_price,
  category       = excluded.category,
  color          = excluded.color,
  fabric         = excluded.fabric,
  style          = excluded.style,
  occasion       = excluded.occasion,
  image          = excluded.image,
  rating         = excluded.rating,
  reviews_count  = excluded.reviews_count,
  is_new         = excluded.is_new,
  is_bestseller  = excluded.is_bestseller,
  featured       = excluded.featured,
  sort_order     = excluded.sort_order;
