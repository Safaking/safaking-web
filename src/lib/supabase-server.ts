import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Supabase client for server components and route handlers.
 *
 * Uses the visitor's own session, so RLS still applies — a customer reading
 * their invoice sees only theirs, an admin sees any. This is deliberately NOT
 * the service-role client: documents are rendered with the reader's rights.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // Server components cannot set cookies; middleware refreshes the
          // session, so there is nothing to do here.
        },
      },
    }
  );
}
