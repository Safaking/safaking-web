import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS.
 *
 * SERVER ONLY — never import this from a file that ships to the browser.
 * It is the only thing allowed to write orders, order_items and payments,
 * which is what keeps prices out of the client's hands.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local from ' +
        'Supabase Dashboard -> Project Settings -> API -> service_role. ' +
        'It must never be prefixed NEXT_PUBLIC_.'
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
