'use client';

import { useState } from 'react';
import { BellRing, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Sends a notification to your own phone, so you can see that the whole chain
 * works: Firebase key on the server → your phone's token → the notification.
 * Free, and no DLT registration, unlike SMS (supabase/042).
 */
export function PushTestCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          title: 'SafaKing test',
          body: 'If you can read this, notifications are working. 👑',
          path: '/',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That did not work.');
      setResult({
        ok: data.sent > 0,
        text: data.sent > 0
          ? `Sent to ${data.sent} phone${data.sent === 1 ? '' : 's'}. Check your phone.`
          : data.note || 'No phone is registered for your account yet. Open the app, sign in, and allow notifications.',
      });
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : 'That did not work.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 border-t border-amber-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-bold text-sm text-maroon-950">
            <BellRing size={15} /> App notifications
          </p>
          <p className="text-xs text-gray-500 mt-1 max-w-lg">
            Free alerts to phones with the SafaKing app — no SMS charges and no DLT registration.
            Artists get one the moment a job is assigned to them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="px-5 py-2.5 rounded-xl bg-maroon-950 text-royal-100 text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
          Send me a test
        </button>
      </div>
      {result && (
        <p className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-xs font-medium ${
          result.ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'
        }`}>
          {result.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
          {result.text}
        </p>
      )}
    </div>
  );
}
