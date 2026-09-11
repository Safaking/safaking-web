'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Stat, Table, SectionTitle, Caveat } from './shared';
import type { Ctx } from './ctx';
import { useAuth } from '@/context/AuthContext';
import { can, unitOf } from '@/lib/departments';
import {
  JobQuality, ATTENDANCE_LABEL, MIN_JOBS_FOR_GRADE, SCORE_RULES,
  arrivalLabel, missingFacts, qualityGrade, scoreTone,
} from '@/lib/artist-quality';
import { JobQualityRecorder } from '@/components/quality/JobQualityRecorder';

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/* ------------------------------------------------- R-51 Artist quality -- */

export function ArtistQuality({ ctx }: { ctx: Ctx }) {
  const { d, inRange, matches } = ctx;
  const { profile } = useAuth();
  const canRecord = can(unitOf(profile?.role, profile?.department), 'assign_artist');
  const [recording, setRecording] = useState<JobQuality | null>(null);

  const nameOf = useMemo(() => {
    const names = new Map(d.artists.map((a) => [a.id, a.display_name]));
    return (id: string) => names.get(id) ?? 'Artist';
  }, [d.artists]);

  const rows = useMemo(
    () => d.jobQuality.filter((q) => inRange(q.event_date) && matches(nameOf(q.artist_id), q.customer_name)),
    [d.jobQuality, inRange, matches, nameOf]
  );
  const scored = rows.filter((q) => q.score != null);
  const attended = scored.filter((q) => q.attendance === 'attended');
  const timed = attended.filter((q) => q.minutes_late != null);
  const rated = attended.filter((q) => q.rating != null);
  const toRecord = rows.filter((q) => q.needs_record);

  const perArtist = useMemo(() => {
    const groups = new Map<string, JobQuality[]>();
    rows.forEach((q) => groups.set(q.artist_id, [...(groups.get(q.artist_id) ?? []), q]));
    return [...groups.entries()].map(([artistId, jobs]) => {
      const s = jobs.filter((q) => q.score != null);
      const came = s.filter((q) => q.attendance === 'attended');
      const t = came.filter((q) => q.minutes_late != null);
      const r = came.filter((q) => q.rating != null);
      return {
        artistId,
        name: nameOf(artistId),
        scored: s.length,
        score: s.length ? Math.round(s.reduce((sum, q) => sum + (q.score ?? 0), 0) / s.length) : null,
        attendance: pct(came.length, s.length),
        onTime: pct(t.filter((q) => (q.minutes_late ?? 0) <= 10).length, t.length),
        rating: r.length ? Math.round((r.reduce((sum, q) => sum + Number(q.rating), 0) / r.length) * 10) / 10 : null,
        complaints: jobs.reduce((sum, q) => sum + q.complaints, 0),
        failures: s.filter((q) => q.attendance !== 'attended').length,
        unrecorded: jobs.filter((q) => q.needs_record).length,
      };
    }).sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
  }, [rows, nameOf]);

  const avgScore = scored.length ? Math.round(scored.reduce((sum, q) => sum + (q.score ?? 0), 0) / scored.length) : null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat label="Average QC score" value={avgScore ?? '—'} tone={avgScore == null ? 'plain' : avgScore >= 70 ? 'good' : avgScore >= 50 ? 'warn' : 'bad'} />
        <Stat label="Came to the job" value={pct(attended.length, scored.length) == null ? '—' : `${pct(attended.length, scored.length)}%`} />
        <Stat label="On time" value={pct(timed.filter((q) => (q.minutes_late ?? 0) <= 10).length, timed.length) == null ? '—' : `${pct(timed.filter((q) => (q.minutes_late ?? 0) <= 10).length, timed.length)}%`} />
        <Stat label="Average rating" value={rated.length ? `${(rated.reduce((s, q) => s + Number(q.rating), 0) / rated.length).toFixed(1)} ★` : '—'} />
        <Stat label="Jobs needing a record" value={toRecord.length} tone={toRecord.length ? 'bad' : 'good'} />
      </div>

      {toRecord.length > 0 && (
        <section className="mb-6">
          <SectionTitle>Finished jobs with something unconfirmed</SectionTitle>
          <Table
            headers={['Date', 'Artist', 'Customer', 'Missing', '']}
            empty=""
            rows={toRecord.map((q) => [
              q.event_date,
              nameOf(q.artist_id),
              q.customer_name ?? '—',
              <span key="m" className="font-bold text-rose-700">{missingFacts(q)}</span>,
              canRecord ? (
                <button key="r" onClick={() => setRecording(q)}
                  className="px-3 py-1.5 rounded-xl bg-maroon-950 text-royal-300 text-[10px] font-bold uppercase tracking-wider no-print">
                  Record
                </button>
              ) : <span key="r" className="text-[10px] text-gray-400">Operations or Artist Manager</span>,
            ])}
          />
        </section>
      )}

      <SectionTitle>By artist (lowest score first)</SectionTitle>
      <Table
        headers={['Artist', 'QC score', 'Jobs scored', 'Came', 'On time', 'Rating', 'Complaints', 'No-show / pulled out', 'To record']}
        empty="No artist jobs in this period."
        rows={perArtist.map((a) => {
          const grade = qualityGrade(a.score, a.scored);
          return [
            <button key="n" onClick={() => ctx.openArtist(a.artistId)}
              className="font-bold text-maroon-950 hover:text-royal-700 underline decoration-royal-300 underline-offset-2 text-left flex items-center gap-1">
              {a.name} <ChevronRight size={11} />
            </button>,
            <span key="s" className="flex items-center gap-2">
              <span className={`font-black ${scoreTone(a.score)}`}>{a.score ?? '—'}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${grade.tone}`}>{grade.label}</span>
            </span>,
            a.scored,
            a.attendance == null ? '—' : `${a.attendance}%`,
            a.onTime == null ? '—' : `${a.onTime}%`,
            a.rating == null ? '—' : `${a.rating.toFixed(1)} ★`,
            <span key="c" className={a.complaints ? 'font-bold text-rose-700' : ''}>{a.complaints}</span>,
            <span key="f" className={a.failures ? 'font-black text-rose-700' : ''}>{a.failures}</span>,
            <span key="u" className={a.unrecorded ? 'font-bold text-amber-700' : ''}>{a.unrecorded}</span>,
          ];
        })}
      />

      <div className="mt-6">
        <SectionTitle>Job by job</SectionTitle>
        <Table
          headers={['Date', 'Artist', 'Customer', 'Came', 'Arrival', 'Rating', 'Complaints', 'Score', 'Record']}
          empty="No artist jobs in this period."
          rows={rows.map((q) => [
            q.event_date,
            nameOf(q.artist_id),
            q.customer_name ?? '—',
            q.attendance
              ? <span key="a" className={q.attendance === 'attended' ? '' : 'font-black text-rose-700'}>{ATTENDANCE_LABEL[q.attendance]}</span>
              : <span key="a" className="text-gray-400">Not yet</span>,
            arrivalLabel(q),
            q.rating == null ? '—' : `${Number(q.rating).toFixed(1)} ★`,
            q.critical_complaints ? <span key="c" className="font-black text-rose-700">{q.complaints} (P1)</span> : q.complaints,
            <span key="s" className={`font-black ${scoreTone(q.score)}`}>{q.score ?? '—'}</span>,
            canRecord && q.score != null ? (
              <button key="r" onClick={() => setRecording(q)} className="text-[10px] font-bold text-maroon-800 hover:underline no-print">
                {q.record_note ? 'Edit' : 'Correct'}
              </button>
            ) : q.record_note ? <span key="r" className="text-[10px] text-gray-500" title={q.record_note}>Staff note</span> : '',
          ])}
        />
      </div>

      <Caveat>
        {SCORE_RULES.join(' ')} A grade needs at least {MIN_JOBS_FOR_GRADE} scored jobs. Arrival comes from the
        customer&apos;s arrival code; where the artist did not use it, staff can record it here.
      </Caveat>

      {recording && (
        <JobQualityRecorder
          job={recording}
          artistName={nameOf(recording.artist_id)}
          onClose={() => setRecording(null)}
          onSaved={() => {
            setRecording(null);
            void d.reload();
          }}
        />
      )}
    </>
  );
}
