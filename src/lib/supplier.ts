import { supabase } from '@/lib/supabase';

/**
 * Suppliers selling through SafaKing. The database is the authority on every
 * rule here — see supabase/040_supplier_marketplace.sql.
 */

export const SUPPLIER_CATEGORIES = [
  'Silk Safa Supplier / Manufacturer',
  'Cotton Safa Supplier',
  'Ready-Made Safa Manufacturers',
  'Jodhpuri & Rajputi Safa Specialists',
  'Pacharangi & Multi-Colour Safa Makers',
  'Bandhani & Leheriya Artisans',
  'Silk & Brocade Weavers',
  'Handloom & Khadi Weavers',
  'Zari & Embroidery Houses',
  'Gota Patti & Lace Makers',
  'Safa Cloth & Fabric Wholesalers',
  'Dyeing & Printing Units',
  'Safa Stitching & Finishing Units',
  'Brooch & Kalgi Accessory Makers',
  'Sarpech, Sehra & Mukut Makers',
  'Groom Dupatta & Stole Makers',
  'Mojari & Groom Footwear Makers',
  'Baraat & Wedding Accessory Suppliers',
  'Something else — tell us in your message',
] as const;

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

export type VerificationState = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface SupplierProfile {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  category: string | null;
  shop_address: string | null;
  gst_number: string | null;
  upi_id: string | null;
  bank_holder_name: string | null;
  bank_ifsc: string | null;
  bank_account_last4: string | null;
  verification_status: VerificationState;
  verified: boolean;
  active: boolean;
  also_artist: boolean;
  ship_same_city: number | null;
  ship_same_state: number | null;
  ship_rest_india: number | null;
  dispatch_days: number;
  approved_at: string | null;
}

export type ListingStatus = 'pending' | 'approved' | 'rejected';

export interface SupplierProduct {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  category: string | null;
  color: string | null;
  fabric: string | null;
  style: string | null;
  occasion: string | null;
  image: string | null;
  stock: number;
  active: boolean;
  gst_percent: number | null;
  listing_status: ListingStatus;
  listing_note: string | null;
  supplier_id: string;
  created_at: string;
}

export const SUPPLIER_PRODUCT_COLUMNS =
  'id, code, name, description, price, original_price, category, color, fabric, style, occasion, image, ' +
  'stock, active, gst_percent, listing_status, listing_note, supplier_id, created_at';

export type DeliveryZone = 'same_city' | 'same_state' | 'rest_of_india';

export const ZONE_LABEL: Record<DeliveryZone, string> = {
  same_city: 'Your city',
  same_state: 'Your state',
  rest_of_india: 'Rest of India',
};

export type ShipmentStatus = 'new' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';

export const SHIPMENT_LABEL: Record<ShipmentStatus, string> = {
  new: 'New order',
  ready: 'Packed',
  dispatched: 'Sent',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export interface SupplierOrderLine {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  gst_percent: number;
  gst_amount: number;
  platform_fee: number;
  gateway_fee: number;
  payout: number;
}

export type PayoutStatus = 'prepared' | 'approved' | 'paid' | 'cancelled';

/** One row of supplier_orders() — the customer block is null until the balance is paid. */
export interface SupplierOrder {
  id: string;
  order_ref: string;
  status: ShipmentStatus;
  zone: DeliveryZone;
  created_at: string;
  items_amount: number;
  shipping_amount: number;
  payout_amount: number;
  courier: string | null;
  tracking_number: string | null;
  ready_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  payout_hold: boolean;
  payout_status: PayoutStatus | null;
  paid_at: string | null;
  paid_in_full: boolean;
  order_cancelled: boolean;
  ship_to_pincode: string | null;
  ship_to_area: string | null;
  customer: { name: string; phone: string; address: string } | null;
  items: SupplierOrderLine[];
}

export interface SupplierPayout {
  id: string;
  supplier_id: string;
  status: PayoutStatus;
  amount: number;
  shipment_count: number;
  prepared_at: string;
  approved_at: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  cancel_reason: string | null;
}

// ---- The fee split ---------------------------------------------------------

export interface SupplierRates {
  platformRate: number;
  gatewayRate: number;
  holdDays: number;
}

export const DEFAULT_SUPPLIER_RATES: SupplierRates = { platformRate: 0.08, gatewayRate: 0.02, holdDays: 7 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The live rates from Admin → Settings, bounded the way supplier_fee_rates() bounds them. */
export async function loadSupplierRates(): Promise<SupplierRates> {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['supplier_platform_fee_rate', 'supplier_gateway_fee_rate', 'supplier_payout_hold_days']);
  const byKey = new Map((data ?? []).map((row: { key: string; value: number | string }) => [row.key, Number(row.value)]));
  const read = (key: string, fallback: number) => {
    const value = byKey.get(key);
    return value == null || Number.isNaN(value) ? fallback : value;
  };
  return {
    platformRate: clamp(read('supplier_platform_fee_rate', DEFAULT_SUPPLIER_RATES.platformRate), 0, 0.5),
    gatewayRate: clamp(read('supplier_gateway_fee_rate', DEFAULT_SUPPLIER_RATES.gatewayRate), 0, 0.1),
    holdDays: Math.round(clamp(read('supplier_payout_hold_days', DEFAULT_SUPPLIER_RATES.holdDays), 0, 60)),
  };
}

const round2 = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;

/**
 * What the supplier receives from a sale. Mirrors supplier_fee_split() in 040:
 * GST is inside the price (₹100 at 5% holds ₹4.76), the platform and gateway
 * fees are a share of the price. The order records the exact figures.
 */
export function splitSupplierPrice(amount: number, gstPercent: number, rates: SupplierRates) {
  const gst = round2((amount * gstPercent) / (100 + gstPercent));
  const platformFee = round2(amount * rates.platformRate);
  const gatewayFee = round2(amount * rates.gatewayRate);
  return { gst, platformFee, gatewayFee, payout: round2(amount - gst - platformFee - gatewayFee) };
}

export const GST_CHOICES = [5, 18, 0] as const;

/** A starting suggestion only — the supplier picks the rate on their own bill. */
export function suggestedGst(price: number): 5 | 18 {
  return price > 2500 ? 18 : 5;
}

export function rupees(amount: number): string {
  const whole = Number.isInteger(amount);
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function deliverySetupMissing(supplier: Pick<SupplierProfile, 'pincode' | 'ship_same_city' | 'ship_same_state' | 'ship_rest_india'>): boolean {
  return (
    !supplier.pincode ||
    supplier.ship_same_city == null ||
    supplier.ship_same_state == null ||
    supplier.ship_rest_india == null
  );
}

/** The terms a supplier accepts when applying, with the live rates filled in. */
export function supplierTerms(rates: SupplierRates): string[] {
  const example = splitSupplierPrice(100, 5, rates);
  return [
    `You set your own price and stock. From your price SafaKing keeps the GST, a ${Math.round(rates.platformRate * 100)}% platform fee and a ${Math.round(rates.gatewayRate * 100)}% payment gateway fee. A ₹100 safa at 5% GST pays you ${rupees(example.payout)}.`,
    'You set a delivery charge for your city, your state and the rest of India. The customer pays it and you receive it in full.',
    'SafaKing checks every product, and every change to its name, price or photos, before customers see it.',
    'Pack an order as soon as it arrives. Send it only when your portal shows "Paid in full", with the courier name and tracking number.',
    `You are paid for a delivered order ${rates.holdDays} days after delivery, in a weekly batch, to the account you give us. To change that account you call SafaKing.`,
    "SafaKing's customers stay SafaKing's customers: never contact them for direct sales or take payment outside SafaKing.",
    'Only genuine products that match their photos and description.',
  ];
}

// ---- Product photos --------------------------------------------------------

export const SUPPLIER_PHOTO_BUCKET = 'supplier-products';
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** A phone photo shrunk to shop size (longest side 1600px) before it is uploaded. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = await canvasToBlob(canvas, 'image/webp', 0.85);
  if (webp && webp.type === 'image/webp') return webp;
  // Older Safari cannot write WebP.
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.85);
  if (!jpeg) throw new Error('Could not read that photo. Try another one.');
  return jpeg;
}

/** Uploads into the supplier's own folder — the only place the database accepts photos from. */
export async function uploadSupplierPhoto(supplierId: string, file: File): Promise<string> {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('Upload a JPG, PNG or WEBP photo.');
  if (file.size > 20 * 1024 * 1024) throw new Error('That photo is over 20 MB. Choose a smaller one.');

  const blob = await shrinkPhoto(file);
  if (blob.size > 5 * 1024 * 1024) throw new Error('That photo is still over 5 MB after resizing. Choose another one.');

  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${supplierId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(SUPPLIER_PHOTO_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(`Could not upload the photo: ${error.message}`);
  return supabase.storage.from(SUPPLIER_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Best-effort clean-up of a photo no longer used. */
export async function removeSupplierPhoto(url: string | null | undefined): Promise<void> {
  const marker = `/${SUPPLIER_PHOTO_BUCKET}/`;
  if (!url || !url.includes(marker)) return;
  const path = url.slice(url.indexOf(marker) + marker.length);
  await supabase.storage.from(SUPPLIER_PHOTO_BUCKET).remove([path]);
}
