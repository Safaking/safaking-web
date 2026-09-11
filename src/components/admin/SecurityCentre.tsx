'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, ShieldAlert, KeyRound, Smartphone, Monitor, LogOut, Loader2, History, Users, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { logAuthEvent } from '@/lib/auth-events';
import { passwordProblems, STAFF_PASSWORD_RULES } from '@/lib/password-policy';
import { DEPARTMENT_LABEL, unitOf } from '@/lib/departments';

interface SessionRow {
  id: string;
  created_at: string;
  last_active_at: string | null;
  user_agent: string | null;
  ip: string | null;
  aal: string | null;
  is_current: boolean;
}

interface LoginEvent {
  id: string;
  user_id: string | null;
  email: string | null;
  event: string;
  ip: string | null;
  user_agent: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
}

interface StaffRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  department: string | null;
  has_2fa: boolean;
  active_sessions: number;
  devices_24h: number;
  last_sign_in_at: string | null;
  password_changed_at: string | null;
  security_ack_at: string | null;
}

const EVENT_LABEL: Record<string, string> = {
  sign_in: 'Signed in',
  sign_out: 'Signed out',
  mfa_verified: 'Entered 2FA code',
  failed_password: 'Wrong password',
  failed_mfa: 'Wrong 2FA code',
  mfa_enrolled: 'Turned on 2FA',
  mfa_removed: 'Turned off 2FA',
  password_changed: 'Changed password',
  session_revoked: 'Signed a device out',
  forced_sign_out: 'Signed out by the owner',
  '2fa_required_on': 'Required 2FA for all staff',
  '2fa_required_off': 'Stopped requiring 2FA',
};

/** "Chrome on Windows" — enough to recognise a device, without the noise. */
export function describeDevice(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const app = /Electron/i.test(ua) ? 'Desktop app'
    : /Edg\//.test(ua) ? 'Edge'
      : /OPR\//.test(ua) ? 'Opera'
        : /Chrome\//.test(ua) ? 'Chrome'
          : /Firefox\//.test(ua) ? 'Firefox'
            : /Safari\//.test(ua) ? 'Safari'
              : 'Browser';
  const os = /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad/i.test(ua) ? 'iPhone'
      : /Windows/i.test(ua) ? 'Windows'
        : /Mac OS X/i.test(ua) ? 'Mac'
          : /Linux/i.test(ua) ? 'Linux'
            : '';
  return os ? `${app} on ${os}` : app;
}

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

const btn = 'px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5';

/**
 * Whether the owner's "2FA required" rule is keeping this session out. The
 * database refuses the data regardless; this is so the panel explains why
 * and shows the way in, instead of rendering empty tables.
 */
export function useStaffSecurityGate(enabled: boolean) {
  const [state, setState] = useState<{ required: boolean; aal: string } | null>(null);

  const reload = useCallback(async () => {
    const [settings, level] = await Promise.all([
      supabase.from('security_settings').select('staff_2fa_required').maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setState({ required: !!settings.data?.staff_2fa_required, aal: level.data?.currentLevel ?? 'aal1' });
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // Deferred: calling Supabase inside this callback can deadlock the client.
      if (event === 'MFA_CHALLENGE_VERIFIED' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => reload(), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [reload]);

  return { blocked: enabled && !!state && state.required && state.aal !== 'aal2', reload };
}

function Card({ icon, title, subtitle, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-3xl border border-amber-200/70 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-amber-100 flex items-start gap-3">
        <span className="mt-0.5 text-maroon-800">{icon}</span>
        <div className="min-w-0">
          <h3 className="font-display font-bold text-base text-maroon-950">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function EventList({ events, names }: { events: LoginEvent[]; names?: Record<string, string> }) {
  if (events.length === 0) return <p className="text-xs text-gray-500">Nothing recorded yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px]">
        <tbody className="divide-y divide-amber-100">
          {events.map((e) => {
            const failed = e.event.startsWith('failed');
            return (
              <tr key={e.id} className={failed ? 'bg-rose-50/60' : ''}>
                <td className={`py-2 pr-4 font-bold whitespace-nowrap ${failed ? 'text-rose-700' : 'text-maroon-950'}`}>
                  {EVENT_LABEL[e.event] ?? e.event}
                </td>
                {names && (
                  <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">
                    {(e.user_id && names[e.user_id]) || e.email || '—'}
                  </td>
                )}
                <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">{e.user_agent ? describeDevice(e.user_agent) : '—'}</td>
                <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                  {[e.city, e.country].filter(Boolean).join(', ') || '—'}{e.ip ? ` · ${e.ip}` : ''}
                </td>
                <td className="py-2 text-gray-500 whitespace-nowrap">{when(e.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Admin → Security: the owner's data-security rules, made usable.
 *
 * Everyone on staff: two-step verification, a password that meets the rules,
 * the devices signed in to their account, and their own sign-in history.
 * The owner also gets every staff account at a glance — who has 2FA, who is
 * signed in on several devices at once (the tell-tale of a shared password)
 * — with the power to sign anyone out everywhere and to require 2FA.
 */
export function SecurityCentre({ isOwner, onSecured }: { isOwner: boolean; onSecured?: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const [factor, setFactor] = useState<{ id: string; created_at: string } | null>(null);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [aal, setAal] = useState('aal1');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [allEvents, setAllEvents] = useState<LoginEvent[]>([]);
  const [requiredFlag, setRequiredFlag] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [factors, level, mine, myEvents, settings] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.rpc('my_sessions'),
      supabase.from('login_events').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(15),
      supabase.from('security_settings').select('staff_2fa_required').maybeSingle(),
    ]);
    const verified = factors.data?.totp?.[0];
    setFactor(verified ? { id: verified.id, created_at: verified.created_at } : null);
    setAal(level.data?.currentLevel ?? 'aal1');
    setMissing(mine.error?.code === 'PGRST202' || myEvents.error?.code === 'PGRST205');
    setSessions((mine.data as SessionRow[]) ?? []);
    setEvents((myEvents.data as LoginEvent[]) ?? []);
    setRequiredFlag(!!settings.data?.staff_2fa_required);

    if (isOwner) {
      const [overview, history] = await Promise.all([
        supabase.rpc('staff_security_overview'),
        supabase.from('login_events').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      setStaff((overview.data as StaffRow[]) ?? []);
      setAllEvents((history.data as LoginEvent[]) ?? []);
    }
  }, [profile, isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  const names = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.user_id, s.full_name || s.email || 'Staff'])),
    [staff]
  );

  const run = async (key: string, action: () => Promise<string | void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const message = await action();
      if (message) setNotice(message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const startEnroll = () =>
    run('enroll', async () => {
      // An abandoned setup leaves an unverified factor that blocks a new one.
      const existing = await supabase.auth.mfa.listFactors();
      for (const f of existing.data?.all ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `SafaKing ${new Date().toISOString().slice(0, 16)}`,
      });
      if (enrollErr) throw new Error(enrollErr.message);
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode('');
    });

  const finishEnroll = () =>
    run('verify', async () => {
      if (!enrolling) return;
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code });
      if (verifyErr) {
        void logAuthEvent('failed_mfa');
        throw new Error('That code did not match. Check that the time on your phone is right and use the newest code.');
      }
      void logAuthEvent('mfa_enrolled');
      setEnrolling(null);
      setCode('');
      onSecured?.();
      return 'Two-step verification is on. You will be asked for a code every time you sign in.';
    });

  const removeFactor = () => {
    if (!factor) return;
    const warning = requiredFlag
      ? 'Staff must use two-step verification, so turning it off will lock you out of the panel until you set it up again. Continue?'
      : 'Turn off two-step verification? Anyone with your password could then sign in as you.';
    if (!window.confirm(warning)) return;
    run('remove', async () => {
      const { error: removeErr } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (removeErr) {
        throw new Error(/aal2/i.test(removeErr.message)
          ? 'Sign out and sign in again with your code first, then you can turn it off.'
          : removeErr.message);
      }
      void logAuthEvent('mfa_removed');
      await supabase.auth.refreshSession();
      return 'Two-step verification is off.';
    });
  };

  const changePassword = () =>
    run('password', async () => {
      const problems = passwordProblems(pw, { strong: true, email: profile?.email, name: profile?.full_name });
      if (problems.length) throw new Error(problems.join(' '));
      if (pw !== pw2) throw new Error('The two passwords do not match.');
      const { error: updateErr } = await supabase.auth.updateUser({ password: pw });
      if (updateErr) throw new Error(updateErr.message);
      setPw('');
      setPw2('');
      await refreshProfile();
      return 'Password changed. If you are not sure who else might know the old one, sign out your other devices below.';
    });

  const revoke = (sessionId: string) =>
    run(`revoke-${sessionId}`, async () => {
      const { error: revokeErr } = await supabase.rpc('revoke_my_session', { p_session: sessionId });
      if (revokeErr) throw new Error(revokeErr.message);
      return 'That device is signed out.';
    });

  const signOutOthers = () =>
    run('others', async () => {
      const { error: outErr } = await supabase.auth.signOut({ scope: 'others' });
      if (outErr) throw new Error(outErr.message);
      return 'Every other device is signed out.';
    });

  const toggleRequired = (next: boolean) =>
    run('flag', async () => {
      const { error: flagErr } = await supabase.rpc('set_staff_2fa_required', { p_required: next });
      if (flagErr) throw new Error(flagErr.message);
      return next
        ? 'Two-step verification is now required for every staff account.'
        : 'Two-step verification is no longer required.';
    });

  const forceSignOut = (row: StaffRow) => {
    if (!window.confirm(`Sign ${row.full_name || row.email} out of every device? They will need their password (and code) to get back in.`)) return;
    run(`force-${row.user_id}`, async () => {
      const { data, error: forceErr } = await supabase.rpc('revoke_user_sessions', { p_user: row.user_id });
      if (forceErr) throw new Error(forceErr.message);
      return `${row.full_name || 'They'} ${row.full_name ? 'is' : 'are'} signed out of ${data ?? 0} device${data === 1 ? '' : 's'}.`;
    });
  };

  const canRequire = !!factor && aal === 'aal2';

  return (
    <div className="space-y-6">
      {missing && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          Login history and device management switch on once supabase/037 has been run.
        </p>
      )}
      {error && <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl p-4">{error}</p>}
      {notice && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">{notice}</p>}

      <Card
        icon={<Smartphone size={18} />}
        title="Two-step verification"
        subtitle="A 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator or Authy) as well as your password."
      >
        {factor ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
              <ShieldCheck size={16} /> On since {when(factor.created_at)}
              {aal !== 'aal2' && <span className="text-[11px] font-bold text-amber-700">· this session has not entered a code</span>}
            </p>
            <button onClick={removeFactor} disabled={busy === 'remove'} className={`${btn} bg-white border border-rose-200 text-rose-700 hover:bg-rose-50`}>
              {busy === 'remove' && <Loader2 size={12} className="animate-spin" />} Turn off
            </button>
          </div>
        ) : enrolling ? (
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrolling.qr}
              alt="QR code to add SafaKing to your authenticator app"
              className="w-44 h-44 rounded-2xl border border-amber-200 bg-white p-2 shrink-0"
            />
            <div className="space-y-3 min-w-0">
              <ol className="text-xs text-gray-700 space-y-1.5 list-decimal pl-4">
                <li>Open your authenticator app and choose to add an account.</li>
                <li>
                  Scan this QR code. Can&apos;t scan? Enter this key instead:{' '}
                  <span className="font-mono font-bold break-all text-maroon-950">{enrolling.secret}</span>
                </li>
                <li>Type the 6-digit code the app now shows.</li>
              </ol>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                aria-label="Code from your authenticator app"
                className="w-44 px-3.5 py-2.5 rounded-xl border border-amber-200 font-mono text-lg tracking-[0.3em] text-maroon-950"
              />
              <div className="flex gap-2">
                <button onClick={finishEnroll} disabled={code.length !== 6 || busy === 'verify'} className={`${btn} bg-maroon-950 hover:bg-maroon-900 text-royal-300`}>
                  {busy === 'verify' ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Confirm
                </button>
                <button onClick={() => setEnrolling(null)} className={`${btn} text-gray-500 hover:text-maroon-900`}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-rose-700 flex items-center gap-2">
              <ShieldAlert size={16} /> Off — your account is protected by your password alone
            </p>
            <button onClick={startEnroll} disabled={busy === 'enroll'} className={`${btn} bg-maroon-950 hover:bg-maroon-900 text-royal-300`}>
              {busy === 'enroll' ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Turn on
            </button>
          </div>
        )}
      </Card>

      <Card
        icon={<KeyRound size={18} />}
        title="Password"
        subtitle={profile?.password_changed_at
          ? `Last changed ${when(profile.password_changed_at)}.`
          : 'Not changed since the password rules came in. Please set one that meets them.'}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="New password"
            className="px-3.5 py-2.5 rounded-xl border border-amber-200 text-sm"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Type it again"
            className="px-3.5 py-2.5 rounded-xl border border-amber-200 text-sm"
          />
        </div>
        <ul className="mt-2 text-[11px] text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
          {STAFF_PASSWORD_RULES.map((rule) => <li key={rule}>• {rule}</li>)}
        </ul>
        <button onClick={changePassword} disabled={!pw || busy === 'password'} className={`${btn} mt-4 bg-maroon-950 hover:bg-maroon-900 text-royal-300`}>
          {busy === 'password' ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />} Change password
        </button>
      </Card>

      <Card icon={<Monitor size={18} />} title="Your devices" subtitle="Everywhere your account is signed in right now.">
        {sessions.length === 0 ? (
          <p className="text-xs text-gray-500">No devices listed.</p>
        ) : (
          <ul className="divide-y divide-amber-100">
            {sessions.map((s) => (
              <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-maroon-950 flex flex-wrap items-center gap-2">
                    {describeDevice(s.user_agent)}
                    {s.is_current && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">This device</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {s.ip ?? 'IP unknown'} · signed in {when(s.created_at)} · last active {when(s.last_active_at)}
                  </p>
                </div>
                {!s.is_current && (
                  <button onClick={() => revoke(s.id)} disabled={busy === `revoke-${s.id}`} className={`${btn} bg-white border border-amber-200 text-maroon-900 hover:bg-amber-50`}>
                    <LogOut size={12} /> Sign out
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {sessions.length > 1 && (
          <button onClick={signOutOthers} disabled={busy === 'others'} className={`${btn} mt-3 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50`}>
            <LogOut size={12} /> Sign out every other device
          </button>
        )}
      </Card>

      <Card icon={<History size={18} />} title="Your recent sign-ins">
        <EventList events={events} />
      </Card>

      {isOwner && (
        <>
          <Card
            icon={<ShieldCheck size={18} />}
            title="Require two-step verification for all staff"
            subtitle="When this is on, admin and manager rights only work after the code is entered. Anyone without it set up sees only this Security tab until they set it up."
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={`text-sm font-bold ${requiredFlag ? 'text-emerald-800' : 'text-gray-600'}`}>
                {requiredFlag ? 'Required for every staff account' : 'Not required yet'}
              </p>
              <button
                onClick={() => toggleRequired(!requiredFlag)}
                disabled={busy === 'flag' || (!requiredFlag && !canRequire)}
                className={`${btn} ${requiredFlag ? 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50' : 'bg-maroon-950 hover:bg-maroon-900 text-royal-300'}`}
              >
                {busy === 'flag' && <Loader2 size={12} className="animate-spin" />}
                {requiredFlag ? 'Stop requiring' : 'Require it'}
              </button>
            </div>
            {!requiredFlag && !canRequire && (
              <p className="text-[11px] text-amber-800 mt-2">
                First turn on two-step verification for your own account above, then sign out and sign in with your
                code. That way you cannot lock yourself out.
              </p>
            )}
          </Card>

          <Card icon={<Users size={18} />} title="Staff accounts" subtitle="Everyone with access to this panel.">
            {staff.length === 0 ? (
              <p className="text-xs text-gray-500">No staff accounts listed.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                      <th className="py-2 pr-4">Person</th>
                      <th className="py-2 pr-4">2FA</th>
                      <th className="py-2 pr-4">Signed in on</th>
                      <th className="py-2 pr-4">Last sign-in</th>
                      <th className="py-2 pr-4">Password changed</th>
                      <th className="py-2 pr-4">Policy</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {staff.map((row) => (
                      <tr key={row.user_id}>
                        <td className="py-2.5 pr-4">
                          <p className="font-bold text-maroon-950">{row.full_name || row.email}</p>
                          <p className="text-[10px] text-gray-500">{DEPARTMENT_LABEL[unitOf(row.role, row.department) ?? 'operations']}</p>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${row.has_2fa ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {row.has_2fa ? 'On' : 'Off'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          {row.active_sessions} device{row.active_sessions === 1 ? '' : 's'}
                          {row.devices_24h >= 2 && (
                            <span
                              className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9px] font-black uppercase"
                              title="Used from more than one device in the last 24 hours. Check that the password is not shared."
                            >
                              <AlertTriangle size={9} /> {row.devices_24h} in 24h
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">{when(row.last_sign_in_at)}</td>
                        <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">{when(row.password_changed_at)}</td>
                        <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">{row.security_ack_at ? 'Accepted' : 'Not yet'}</td>
                        <td className="py-2.5 text-right">
                          {row.user_id !== profile?.id && row.active_sessions > 0 && (
                            <button
                              onClick={() => forceSignOut(row)}
                              disabled={busy === `force-${row.user_id}`}
                              className={`${btn} ml-auto bg-white border border-rose-200 text-rose-700 hover:bg-rose-50`}
                            >
                              <LogOut size={12} /> Sign out everywhere
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon={<History size={18} />} title="Sign-in history" subtitle="The last 100 events across every account, failed attempts included.">
            <EventList events={allEvents} names={names} />
          </Card>
        </>
      )}
    </div>
  );
}
