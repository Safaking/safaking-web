import { createClient } from '@supabase/supabase-js';
import { getStaff } from '@/lib/staff-auth';
import { BUSINESS } from '@/lib/business';
import { labelHtml, type LabelBusiness, type LabelOrder, type LabelItem } from '@/lib/label-html';

/**
 * A printable address label for an order, opened from the admin orders list.
 *
 * Served through the service role rather than the browser's own session: an
 * order belongs to its customer under RLS, and the staff member printing a
 * parcel label is not that customer.
 *
 * The page itself is built in `label-html.ts`, which is also what renders it
 * when somebody wants to see a change before shipping it.
 */

const page = (html: string, status = 200) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

const plain = (message: string, status: number) =>
  page(
    `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px">
     <h3>${message}</h3></body>`,
    status
  );

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

  // select('*') rather than a column list: the label reads optional columns
  // (pincode, wedding_date, balance_amount) that older databases may not have
  // yet, and a named column that does not exist fails the whole query.
  const [{ data: order }, { data: items }, { data: business }] = await Promise.all([
    admin.from('orders').select('*').eq('id', id).maybeSingle(),
    admin.from('order_items').select('product_name, quantity').eq('order_id', id),
    admin.from('business_profile').select('*').maybeSingle(),
  ]);

  if (!order) return plain('That order could not be found.', 404);

  // The return address is admin-editable, the same one the invoice prints.
  // Falling back to the marketing constants keeps a label printable on a
  // database where nobody has filled the profile in yet.
  const biz: LabelBusiness = {
    legal_name: business?.legal_name ?? BUSINESS.name,
    address: business?.address ?? BUSINESS.address,
    phone: business?.phone ?? BUSINESS.phone,
  };

  return page(labelHtml(order as LabelOrder, (items ?? []) as LabelItem[], biz));
}
