import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { can, unitOf, Permission, StaffUnit } from '@/lib/departments';

export interface StaffContext {
  userId: string;
  role: 'admin' | 'manager';
  unit: StaffUnit;
  aal: string;
  can: (permission: Permission) => boolean;
}

type StaffResult = { staff: StaffContext; error: null } | { staff: null; error: NextResponse };

const fail = (message: string, status: number): StaffResult => ({
  staff: null,
  error: NextResponse.json({ error: message }, { status }),
});

function claimsOf(accessToken: string | undefined): Record<string, unknown> {
  if (!accessToken) return {};
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

/**
 * The one staff check for API routes.
 *
 * It asks the same questions the database does: is this person staff, which
 * department, did they enter their 2FA code when the owner requires it, and
 * has this device been signed out. Uses the caller's own session, so it works
 * even where the service-role key is not configured.
 */
export async function getStaff(): Promise<StaffResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('Sign in.', 401);

  const [{ data: profile }, { data: settings }, { data: sessionData }] = await Promise.all([
    supabase.from('profiles').select('role, department').eq('id', user.id).maybeSingle(),
    supabase.from('security_settings').select('staff_2fa_required').maybeSingle(),
    supabase.auth.getSession(),
  ]);

  const unit = unitOf(profile?.role, profile?.department);
  if (!unit) return fail('SafaKing staff only.', 403);

  // The token was just verified by getUser(); this only reads its claims.
  const claims = claimsOf(sessionData.session?.access_token);
  const aal = typeof claims.aal === 'string' ? claims.aal : 'aal1';
  if (settings?.staff_2fa_required && aal !== 'aal2') {
    return fail('Two-step verification is required. Sign in again and enter your authenticator code.', 403);
  }

  const { data: active, error: activeErr } = await supabase.rpc('session_is_active');
  if (!activeErr && active === false) return fail('This device was signed out. Please sign in again.', 401);

  return {
    staff: {
      userId: user.id,
      role: profile!.role as 'admin' | 'manager',
      unit,
      aal,
      can: (permission) => can(unit, permission),
    },
    error: null,
  };
}
