import { createClient } from '@supabase/supabase-js';
import { getStaff } from '@/lib/staff-auth';
import { BUSINESS } from '@/lib/business';
import { labelHtml, type LabelItem, type LabelOrder, type LabelParcel, type LabelSender } from '@/lib/label-html';

/**
 * A printable address label for an order, opened from the admin orders list.
 *
 * Served through the service role rather than the browser's own session: an
 * order belongs to its customer under RLS, and the staff member printing a
 * parcel label is not that customer.
 *
 * ---------------------------------------------------------------------------
 * Where the return address comes from
 * ---------------------------------------------------------------------------
 * The parcel does not always leave SafaKing. When the goods are a supplier's,
 * the supplier posts them from their own shop, and a failed delivery has to
 * come back to the place it was actually sent from — printing the shop's
 * address on a parcel posted from somebody else's town sends returns to a
 * counter that never had the safa.
 *
 * So the return address is the supplier who is dispatching. The **name** on it
 * stays SafaKing: the customer ordered from SafaKing and should not read a
 * stranger's business name on their parcel, and the phone stays SafaKing's so
 * a courier with a question reaches the shop that owns the order.
 *
 * An order split across two suppliers is two parcels posted from two towns, so
 * it prints two labels, each carrying only the items in that parcel. Anything
 * not assigned to a supplier is SafaKing's own stock and goes out from the
 * shop.
 */

const page = (html: string, status = 200) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

const plain = (message: string, status: number) =>
  page(
    `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px">
     <h3>${message}</h3></body>`,
    status
  );

type SupplierRow = {
  id: string;
  business_name: string | null;
  phone: string | null;
  shop_address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
};

/** The supplier's shop as one line, skipping whatever they left blank. */
const supplierAddress = (s: SupplierRow) =>
  [s.shop_address, s.city, s.state, s.pincode].map((p) => (p ?? '').trim()).filter(Boolean).join(', ');

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return plain('Labels are not configured on this deployment.', 500);

  // The same staff check every other API route uses: department, 2FA and
  // signed-out devices all asked in one place rather than re-invented here.
  // It reads the session from cookies, which is what a plain link sends — an
  // Authorization header would need JavaScript, and this is an <a href>.
  const { staff, error } = await getStaff();
  if (error || !staff) return plain('Sign in as staff to print a label.', 401);
  // `customers`, not `bookings`: a label is a customer's name, home address
  // and phone, so it is gated on the permission that means exactly that.
  // Operations pack the parcels and support answer "where is it" — both hold
  // it; artist_ops have no business with a customer's address.
  if (!staff.can('customers')) {
    return plain('You do not have permission to print labels.', 403);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  // select('*') on the order rather than a column list: the label reads
  // optional columns (pincode, wedding_date, balance_amount) that an older
  // database may not have yet, and a named column that does not exist fails
  // the whole query.
  const [{ data: order }, { data: items }, { data: business }, { data: shipments }] = await Promise.all([
    admin.from('orders').select('*').eq('id', id).maybeSingle(),
    admin.from('order_items').select('id, product_name, quantity').eq('order_id', id),
    admin.from('business_profile').select('*').maybeSingle(),
    admin
      .from('order_shipments')
      .select('id, supplier_id, supplier_profiles(id, business_name, phone, shop_address, city, state, pincode)')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!order) return plain('That order could not be found.', 404);

  // SafaKing's own counter, admin-editable in business_profile — the same row
  // the invoice prints from. The marketing constants are the last resort.
  const house: LabelSender = {
    name: business?.legal_name || BUSINESS.name,
    address: business?.address || BUSINESS.address,
    phone: business?.phone || BUSINESS.phone,
  };

  const allItems = (items ?? []) as (LabelItem & { id?: string })[];
  const parcels: LabelParcel[] = [];

  const shipmentRows = (shipments ?? []) as { id: string; supplier_profiles: SupplierRow | SupplierRow[] | null }[];

  if (shipmentRows.length > 0) {
    // Which order_item belongs to which parcel. Read in one query rather than
    // one per shipment.
    const { data: splitLines } = await admin
      .from('order_supplier_lines')
      .select('order_item_id, shipment_id, product_name, quantity')
      .eq('order_id', id);

    const claimed = new Set<string>();
    for (const row of shipmentRows) {
      // PostgREST gives an embedded row as an object, or an array when it
      // cannot prove the relationship is to-one. Accept either.
      const sp = Array.isArray(row.supplier_profiles) ? row.supplier_profiles[0] : row.supplier_profiles;
      const mine = (splitLines ?? []).filter((l) => l.shipment_id === row.id);
      mine.forEach((l) => l.order_item_id && claimed.add(l.order_item_id));

      const where = sp ? supplierAddress(sp) : '';
      parcels.push({
        // The name and number stay SafaKing's; only the place changes.
        sender: where ? { name: house.name, address: where, phone: house.phone } : house,
        items: mine.length > 0 ? mine : allItems,
      });
    }

    // Anything no supplier is sending is SafaKing's own stock, posted from
    // the shop as its own parcel.
    const ours = allItems.filter((i) => !i.id || !claimed.has(i.id));
    if (ours.length > 0) parcels.push({ sender: house, items: ours });
  }

  if (parcels.length === 0) parcels.push({ sender: house, items: allItems });

  // Only worth saying when there is more than one box to confuse.
  if (parcels.length > 1) {
    parcels.forEach((p, i) => {
      p.partOf = { index: i + 1, total: parcels.length };
    });
  }

  return page(labelHtml(order as LabelOrder, parcels));
}
