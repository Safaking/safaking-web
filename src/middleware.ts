import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Path prefix -> roles allowed to enter it. */
const PROTECTED: { prefix: string; roles: string[] }[] = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/artist-portal', roles: ['artist', 'admin'] },
];

export async function middleware(request: NextRequest) {
  const guard = PROTECTED.find(({ prefix }) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  // Supabase's auth cookie is named `sb-<project-ref>-auth-token` (optionally
  // chunked as `...-auth-token.0`, `.1`, ... for large sessions). An anonymous
  // visitor has none of these, meaning there is no session to refresh and no
  // way they could pass a role guard either — so skip the live Supabase
  // network round-trip entirely rather than paying it on every single page
  // view. This was the single biggest contributor to slow page loads across
  // the site, since most storefront traffic browses signed out.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));

  if (!hasAuthCookie) {
    if (guard) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth', 'login');
      url.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

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

  // Refreshes the auth token and keeps the cookie in sync. Must run on every
  // request from a signed-in visitor, not just protected ones, or sessions
  // expire mid-browse.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (guard) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth', 'login');
      url.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !guard.roles.includes(profile.role)) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('denied', guard.prefix.replace('/', ''));
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
