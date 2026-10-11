import { createClient } from '@supabase/supabase-js';
import { BUSINESS } from '@/lib/business';
import { FAQ_GROUPS, FAQ_FALLBACKS, fillTokens } from '@/lib/faq';

/**
 * Everything the assistant is allowed to know.
 *
 * SERVER ONLY. It is assembled from the same places the website reads — the
 * FAQ, the live settings that price a booking, the refund ladder, the
 * contracts and the shop — so the assistant cannot tell a customer one thing
 * while the checkout does another. Anything not in here, it says it does not
 * know and gives the phone number.
 *
 * Rebuilt every few minutes rather than on every message, because a chat is
 * mostly follow-up questions about facts that have not changed.
 */

let cached: { text: string; at: number } | null = null;
const MAX_AGE_MS = 5 * 60 * 1000;

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false } }
  );
}

export async function knowledge(): Promise<string> {
  if (cached && Date.now() - cached.at < MAX_AGE_MS) return cached.text;

  const parts: string[] = [];

  parts.push(`BUSINESS
Name: ${BUSINESS.name} (SafaKing)
Phone and WhatsApp: ${BUSINESS.phone}
Email: ${BUSINESS.email}
Address: ${BUSINESS.address}
Open: ${BUSINESS.hours}
Website: https://www.safaking.in
What it does: ties safas at weddings across India, sells and rents safas and
sehras online, trains safa artists, and runs a marketplace of safa suppliers.`);

  const supabase = publicClient();
  const [settings, refunds, contracts, products] = await Promise.all([
    supabase.from('app_settings').select('key, value'),
    supabase
      .from('refund_rules')
      .select('label, min_hours_before, refund_percent')
      .eq('active', true)
      .order('min_hours_before', { ascending: false }),
    supabase.from('contracts').select('audience, title, body').eq('active', true),
    supabase
      .from('products')
      .select('name, price, category, color, fabric, is_rentable, rent_price_per_day, stock')
      .eq('active', true)
      .order('featured', { ascending: false })
      .limit(24),
  ]);

  const numbers = Object.fromEntries(
    ((settings.data ?? []) as { key: string; value: number }[]).map((row) => [row.key, Number(row.value)])
  );
  const percent = (key: string, fallback: number) => {
    const raw = numbers[key];
    if (raw === undefined) return fallback;
    return Math.round(raw <= 1 ? raw * 100 : raw);
  };

  const tokens = {
    advance: String(percent('advance_rate', 50)),
    groomAdvance: String(percent('groom_safa_advance_percent', 25)),
    dateChangeDays: String(numbers['customer_date_change_free_days'] ?? 3),
  };

  parts.push(`MONEY (these are live settings — never quote any other figure)
Artist booking advance: ${tokens.advance}% of the total, balance to SafaKing before the event.
Groom safa advance: ${tokens.groomAdvance}%.
Free date change if asked at least ${tokens.dateChangeDays} days before the event.
Payment is online — UPI, cards, net banking. Customers must never pay an artist directly.`);

  if (refunds.data?.length) {
    const ladder = (refunds.data as { label: string; refund_percent: number }[])
      .map((rule) => `  ${rule.label}: ${rule.refund_percent}% of the eligible amount back`)
      .join('\n');
    parts.push(`CANCELLATION LADDER (live)\n${ladder}\nEligible amount excludes GST and non-refundable charges. If SafaKing cannot serve a confirmed booking, 100% of the unserved amount comes back.`);
  }

  if (contracts.data?.length) {
    parts.push(
      `TERMS CUSTOMERS AGREE TO\n` +
        (contracts.data as { audience: string; title: string; body: string }[])
          .map((row) => `${row.title} (${row.audience}): ${row.body}`)
          .join('\n\n')
    );
  }

  if (products.data?.length) {
    const list = (products.data as {
      name: string; price: number; category: string | null; color: string | null;
      fabric: string | null; is_rentable: boolean | null; rent_price_per_day: number | null; stock: number | null;
    }[])
      .map((p) => {
        const bits = [p.color, p.fabric, p.category].filter(Boolean).join(', ');
        const rent = p.is_rentable && p.rent_price_per_day ? `, rent ₹${p.rent_price_per_day}/day` : '';
        const stock = (p.stock ?? 0) > 0 ? '' : ' (out of stock)';
        return `  ${p.name} — ₹${p.price}${rent}${bits ? ` [${bits}]` : ''}${stock}`;
      })
      .join('\n');
    parts.push(`SOME SAFAS IN THE SHOP RIGHT NOW (prices are live)\n${list}\nThe full range is at https://www.safaking.in/shop`);
  }

  parts.push(
    `QUESTIONS AND ANSWERS\n` +
      FAQ_GROUPS.map(
        (group) =>
          `${group.title.en}\n` +
          group.items
            .map((item) => `  Q: ${fillTokens(item.q.en, { ...FAQ_FALLBACKS, ...tokens })}\n  A: ${fillTokens(item.a.en, { ...FAQ_FALLBACKS, ...tokens })}`)
            .join('\n')
      ).join('\n\n')
  );

  parts.push(`PAGES YOU CAN SEND PEOPLE TO
  Shop: /shop          Rent: /rent            Try a safa on: /try-on
  Book an artist: /#artist-booking-form       Photo gallery: /gallery
  Questions: /faq      Policies: /policies    Academy: /academy
  Careers: /careers    Contact: /contact      Become a supplier: /supplier-portal/login?tab=join`);

  const text = parts.join('\n\n');
  cached = { text, at: Date.now() };
  return text;
}
