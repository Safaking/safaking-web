'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, ClipboardCheck } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { JobQuality } from '@/lib/artist-quality';

const istTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) : '';

/**
 * Staff confirm what the app did not capture: whether the artist came, and
 * when they arrived — usually because the artist never entered the
 * customer's arrival code. Recording a no-show also puts it on the artist's
 * standing, without the rescue steps meant for an event that is still ahead.
 */
export function JobQualityRecorder({ job, artistName, onClose, onSaved }: {
  job: JobQuality;
  artistName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [attendance, setAttendance] = useState<'attended' | 'no_show'>(job.attendance === 'no_show' ? 'no_show' : 'attended');
  const [arrival, setArrival] = useState(istTime(job.arrived_at));
  const [note, setNote] = useState(job.record_note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (note.trim().length < 5) {
      setError('Say how you know: who confirmed it, or what happened.');
      return;
    }
    setSaving(true);
    setError(null);
    const target = job.kind === 'booking' ? { booking_id: job.job_id } : { rental_id: job.job_id };
    const { error: saveErr } = await supabase.from('artist_job_records').upsert(
      {
        ...target,
        artist_id: job.artist_id,
        attendance,
        arrived_at: attendance === 'attended' && arrival ? `${job.event_date}T${arrival}:00+05:30` : null,
        note: note.trim(),
      },
      { onConflict: 'job_id,artist_id' }
    );
    if (saveErr) {
      setSaving(false);
      setError(friendlyError(saveErr));
      return;
    }
    if (attendance === 'no_show' && job.attendance !== 'no_show') {
      const { error: incidentErr } = await supabase.from('artist_incidents').insert({
        ...target,
        artist_id: job.artist_id,
        kind: 'no_show',
        reason: note.trim(),
        reported_by: profile?.id ?? null,
        reported_role: profile?.role ?? 'staff',
      });
      if (incidentErr) {
        setSaving(false);
        setError(`Recorded, but it could not be added to the artist's standing: ${friendlyError(incidentErr)}`);
        return;
      }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-maroon-950/70 backdrop-blur-sm flex items-center justify-center p-4 no-print">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="bg-maroon-950 px-7 py-5 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="font-display font-black text-base text-royal-100 uppercase tracking-widest">Job quality record</h3>
            <p className="text-[11px] text-royal-200/60 mt-0.5 truncate">
              {artistName} · {job.customer_name ?? 'Booking'} · {job.event_date}
              {job.event_at ? ` · starts ${istTime(job.event_at)}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="p-7 space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {(['attended', 'no_show'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAttendance(value)}
                className={`py-3 rounded-2xl border-2 text-xs font-bold ${
                  attendance === value
                    ? value === 'attended' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-rose-500 bg-rose-50 text-rose-900'
                    : 'border-amber-200/70 text-gray-600'
                }`}
              >
                {value === 'attended' ? 'The artist came' : 'The artist did not come'}
              </button>
            ))}
          </div>

          {attendance === 'attended' ? (
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Arrived at (India time)</span>
              <input
                type="time"
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
                className="w-40 px-3.5 py-2.5 rounded-xl border border-amber-200/80 text-sm font-bold text-maroon-950"
              />
              <span className="block text-[11px] text-gray-500 mt-1">Leave empty if nobody knows. The job then keeps half the arrival points.</span>
            </label>
          ) : (
            <p className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 leading-relaxed">
              This scores the job 0 and adds a no-show (3 points) to the artist&apos;s standing.
            </p>
          )}

          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">How do you know?</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Customer confirmed on the phone that he reached at 6:10 pm"
              className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200/80 text-sm text-maroon-950 resize-none"
            />
          </label>

          {error && <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full py-3 rounded-2xl bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />} Save record
          </button>
        </div>
      </motion.div>
    </div>
  );
}
