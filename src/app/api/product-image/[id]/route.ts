import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const FALLBACK = '/product-maroon-brocade.jpg';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Raster formats only: an SVG served from this origin could carry script.
const SAFE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
// Browsers keep it an hour; Vercel's edge keeps it a day, then keeps serving
// that copy for up to a week while it fetches a fresh one in the background.
// Photos rarely change, and the first, uncached request is the slow one
// (the database is in Seoul) — a photo changed in the POS shows within a day.
const CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

function db() {
  try {
    return createAdminClient();
  } catch {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
}

function redirect(request: Request, to: string) {
  return NextResponse.redirect(new URL(to, request.url), { status: 302, headers: { 'Cache-Control': CACHE } });
}

/**
 * One product photo, as an image.
 *
 * The POS stores photos as base64 text on the product row. Sending those
 * inside the catalogue made the shop download every photo at once — 6.8 MB
 * before a single product could show. The catalogue now carries only this
 * address; each photo is decoded here once and then served from Vercel's
 * cache near the customer.
 *
 *   /api/product-image/<id>        the main photo
 *   /api/product-image/<id>?i=2    the second extra photo
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return redirect(request, FALLBACK);

  const index = Math.min(20, Math.max(0, Math.floor(Number(new URL(request.url).searchParams.get('i') ?? 0)) || 0));
  const client = db();

  let source: string | null = null;
  if (index === 0) {
    const { data } = await client.from('products').select('image').eq('id', id).maybeSingle();
    source = (data?.image as string | null) ?? null;
  } else {
    const { data } = await client
      .from('product_images')
      .select('url')
      .eq('product_id', id)
      .order('sort_order', { ascending: true })
      .range(index - 1, index - 1);
    source = (data?.[0]?.url as string | undefined) ?? null;
  }

  if (!source) return redirect(request, FALLBACK);

  const inline = source.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/);
  if (inline) {
    const type = (inline[1] || 'image/jpeg').toLowerCase();
    if (!SAFE_TYPES.includes(type)) return redirect(request, FALLBACK);
    const bytes = inline[2] ? Buffer.from(inline[3], 'base64') : Buffer.from(decodeURIComponent(inline[3]));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': type === 'image/jpg' ? 'image/jpeg' : type,
        'Content-Length': String(bytes.length),
        'Cache-Control': CACHE,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (/^https:\/\//i.test(source) || source.startsWith('/')) return redirect(request, source);
  return redirect(request, FALLBACK);
}
