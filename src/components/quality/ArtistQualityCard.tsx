'use client';

import { useEffect, useState } from 'react';
import { Gauge, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  ArtistQuality, JobQuality, ATTENDANCE_LABEL, MIN_JOBS_FOR_GRADE, SCORE_RULES,
  arrivalLabel, qualityGrade, scoreTone,
} from '@/lib/artist-quality';

/**
 * The artist's own quality score in their portal: what SafaKing sees, and
 * exactly how it is worked out, so there is nothing to argue about and one
 * obvious thing to do better — usually, entering the arrival code on arrival.
 */
export function ArtistQualityCard({ artistId }: { artistId: string }) {
  const [summary, setSummary] = useState<ArtistQuality | null>(null);
  const [jobs, setJobs] = useState<JobQuality[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('artist_quality_scores').select('*').eq('artist_id', artistId).maybeSingle(),
      supabase
        .from('artist_job_quality')
        .select('*')
        .eq('artist_id', artistId)
        .not('attendance', 'is', null)
        .order('event_date', { ascending: false })
        .limit(6),
    ]).then(([s, j]) => {
      if (cancelled) return;
      setSummary((s.data as ArtistQuality) ?? null);
      setJobs((j.data as JobQuality[]) ?? []);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [artistId]);

  if (!loaded) return null;

  const grade = qualityGrade(summary?.quality_score, summary?.scored_jobs ?? 0);

  return (
    <section className="mb-10 rounded-3xl bg-white border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-amber-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-maroon-950 text-royal-300 flex items-center justify-center">
            <Gauge size={26} />
          </div>
          <div>
            <p className="text-[10px] font-black text-maroon-900/60 uppercase tracking-widest">Your quality score</p>
            {summary ? (
              <p className="flex items-baseline gap-3 mt-0.5">
                <span className={`text-3xl font-display font-black ${scoreTone(summary.quality_score)}`}>{summary.quality_score}</span>
                <span className="text-xs text-gray-500">/ 100 · last {summary.scored_jobs} job{summary.scored_jobs === 1 ? '' : 's'}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${grade.tone}`}>{grade.label}</span>
              </p>
            ) : (
              <p className="text-sm font-bold text-gray-600 mt-1">Appears after your first completed booking.</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          className="text-[11px] font-bold text-maroon-800 hover:underline flex items-center gap-1"
        >
          <Info size={12} /> How it is worked out
        </button>
      </div>

      {showRules && (
        <ul className="px-6 py-4 bg-amber-50/50 border-b border-amber-100 text-[12px] text-gray-700 space-y-1 list-disc pl-10">
          {SCORE_RULES.map((rule) => <li key={rule}>{rule}</li>)}
          <li>A grade is shown after {MIN_JOBS_FOR_GRADE} scored jobs.</li>
        </ul>
      )}

      {summary && (
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Came to the job', value: `${summary.attendance_pct}%` },
              { label: 'On time', value: summary.on_time_pct == null ? '—' : `${summary.on_time_pct}%` },
              { label: 'Customer rating', value: summary.avg_rating == null ? '—' : `${Number(summary.avg_rating).toFixed(1)} ★` },
              { label: 'Complaints', value: String(summary.complaints) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-amber-200/60 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">{s.label}</p>
                <p className="text-xl font-display font-black text-maroon-950 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          {summary.arrival_unrecorded > 0 && (
            <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-3">
              {summary.arrival_unrecorded} of your jobs have no arrival time, so they only get half the arrival points.
              Enter the customer&apos;s arrival code as soon as you reach.
            </p>
          )}

          {jobs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Came</th>
                    <th className="py-2 pr-4">Arrival</th>
                    <th className="py-2 pr-4">Rating</th>
                    <th className="py-2 pr-4">Complaints</th>
                    <th className="py-2">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {jobs.map((job) => (
                    <tr key={`${job.job_id}-${job.artist_id}`}>
                      <td className="py-2 pr-4 whitespace-nowrap">{job.event_date}</td>
                      <td className="py-2 pr-4">{job.customer_name ?? '—'}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{job.attendance ? ATTENDANCE_LABEL[job.attendance] : '—'}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{arrivalLabel(job)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{job.rating == null ? '—' : `${Number(job.rating).toFixed(1)} ★`}</td>
                      <td className="py-2 pr-4">{job.complaints}</td>
                      <td className={`py-2 font-black ${scoreTone(job.score)}`}>{job.score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
