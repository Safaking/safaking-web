import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Path prefix -> roles allowed to enter it. */
const PROTECTED: { prefix: string; roles: string[]; signedOutTo: string; deniedTo: string }[] = [
  // Managers run daily operations from the same panel — the panel itself
  // hides what is admin-only, and the database refuses the rest.
  { prefix: '/admin', roles: ['admin', 'manager'], signedOutTo: '/', deniedTo: '/' },
  {
    prefix: '/artist-portal',
    roles: ['artist', 'admin', 'manager'],
    // Artists get their own dedicated login and "profile pending" views,
    // distinct from the shared customer AuthModal — see
    // src/app/artist-portal/{login,status}/page.tsx.
    signedOutTo: '/artist-portal/login',
    deniedTo: '/artist-portal/status',
  },
];

// Sub-routes a signed-in-but-not-yet-artist (or signed-out) visitor must
// still be able to reach — they're what the guard above redirects TO.
const ARTIST_PORTAL_PUBLIC_SUBPATHS = ['/artist-portal/login', '/artist-portal/status'];

/** The user id inside a Supabase access token. Read, not trusted — see below. */
function subjectOf(accessToken: string): string | null {
  try {
    const part = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const sub = JSON.parse(atob(padded)).sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Guards the admin panel and the artist portal. Nothing else runs through
 * here: the database is in Seoul and the customers are in India, so checking
 * the session on every page used to add a round trip to each page a
 * signed-in customer opened. The browser keeps its own session fresh, and
 * every API route verifies its caller itself.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (ARTIST_PORTAL_PUBLIC_SUBPATHS.some((p) => path.startsWith(p))) {
    return NextResponse.next({ request });
  }

  const guard = PROTECTED.find(({ prefix }) => path.startsWith(prefix));
  if (!guard) return NextResponse.next({ request });

  const redirectTo = (kind: 'signedOut' | 'denied') => {
    const url = request.nextUrl.clone();
    if (kind === 'signedOut') {
      url.pathname = guard.signedOutTo;
      if (guard.signedOutTo === '/') {
        url.searchParams.set('auth', 'login');
        url.searchParams.set('next', request.nextUrl.pathname);
      } else {
        url.search = '';
      }
    } else {
      url.pathname = guard.deniedTo;
      if (guard.deniedTo === '/') {
        url.searchParams.set('denied', guard.prefix.replace('/', ''));
      } else {
        url.search = '';
      }
    }
    return NextResponse.redirect(url);
  };

  // Supabase's auth cookie is `sb-<project-ref>-auth-token` (optionally
  // chunked as `.0`, `.1`, …). No cookie, no session — no network call.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
  if (!hasAuthCookie) return redirectTo('signedOut');

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession() reads the cookie and only calls the auth server when the
  // token has expired (refreshing it into the response). It is not taken on
  // trust: the profile query below sends that token to the database, which
  // checks its signature — a forged or stale cookie finds no profile and is
  // turned away. That is one round trip instead of two.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session ? subjectOf(session.access_token) : null;
  if (!userId) return redirectTo('signedOut');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile || !guard.roles.includes(profile.role)) return redirectTo('denied');

  return response;
}

export const config = {
  // Only the guarded areas invoke middleware at all.
  matcher: ['/admin/:path*', '/artist-portal/:path*'],
};
