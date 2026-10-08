'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Loader2, AlertCircle, CheckCircle2, Pencil, Trash2, ArrowUp, ArrowDown,
  Eye, EyeOff, X, Briefcase,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import {
  JobOpening, JOB_ICON_CHOICES, JOB_ACCENT_CHOICES, jobIcon, jobAccent, loadJobOpenings,
} from '@/lib/jobs';

/**
 * Posting, editing and closing the roles on /careers (supabase/044).
 *
 * Everything a visitor sees about a job is here, so a salary change or a new
 * role is typed in rather than deployed. A closed role disappears from the
 * careers page but keeps its applications.
 */

interface Draft {
  id: string | null;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  experience: string;
  salary: string;
  summary: string;
  responsibilities: string;
  requirements: string;
  icon: string;
  accent: string;
  highlight: boolean;
  active: boolean;
}

const EMPTY: Draft = {
  id: null, slug: '', title: '', department: '', location: '', employmentType: 'Full-time',
  experience: '', salary: '', summary: '', responsibilities: '', requirements: '',
  icon: 'crown', accent: 'royal', highlight: false, active: true,
};

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const lines = (value: string) =>
  value.split('\n').map((line) => line.replace(/^[-•\s]+/, '').trim()).filter(Boolean);

const INPUT =
  'w-full px-4 py-2.5 rounded-xl border border-amber-300 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800/20 bg-white';
const LABEL = 'block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1';

export function JobOpeningsManager() {
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { jobs: rows, tableMissing: missing } = await loadJobOpenings({ includeClosed: true });
    setJobs(rows);
    setTableMissing(missing);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCount = useMemo(() => jobs.filter((job) => job.active).length, [jobs]);

  const edit = (job: JobOpening) =>
    setDraft({
      id: job.id,
      slug: job.slug,
      title: job.title,
      department: job.department,
      location: job.location,
      employmentType: job.employmentType,
      experience: job.experience ?? '',
      salary: job.salary ?? '',
      summary: job.summary,
      responsibilities: job.responsibilities.join('\n'),
      requirements: job.requirements.join('\n'),
      icon: job.icon,
      accent: job.accent,
      highlight: job.highlight,
      active: job.active,
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setError(null);

    const title = draft.title.trim();
    if (title.length < 3) return setError('Give the role a title of at least 3 characters.');
    const slug = (draft.slug.trim() || slugify(title)) || 'role';

    setSaving(true);
    const payload = {
      slug,
      title,
      department: draft.department.trim(),
      location: draft.location.trim(),
      employment_type: draft.employmentType.trim() || 'Full-time',
      experience: draft.experience.trim() || null,
      salary: draft.salary.trim() || null,
      summary: draft.summary.trim(),
      responsibilities: lines(draft.responsibilities),
      requirements: lines(draft.requirements),
      icon: draft.icon,
      accent: draft.accent,
      highlight: draft.highlight,
      active: draft.active,
    };

    const { error: saveErr } = draft.id
      ? await supabase.from('job_openings').update(payload).eq('id', draft.id)
      : await supabase
          .from('job_openings')
          .insert({ ...payload, sort_order: (jobs.at(-1)?.sortOrder ?? 0) + 10 });

    setSaving(false);
    if (saveErr) {
      setError(
        saveErr.code === '23505'
          ? 'Another role already uses that web address. Change the slug.'
          : friendlyError(saveErr)
      );
      return;
    }

    setDraft(null);
    setNotice(draft.id ? 'Role updated. The careers page shows it now.' : 'Role posted. It is live on the careers page.');
    setTimeout(() => setNotice(null), 6000);
    void load();
  };

  const setActive = async (job: JobOpening, active: boolean) => {
    setBusy(job.id);
    const { error: err } = await supabase.from('job_openings').update({ active }).eq('id', job.id);
    setBusy(null);
    if (err) return setError(friendlyError(err));
    setJobs((prev) => prev.map((row) => (row.id === job.id ? { ...row, active } : row)));
  };

  /** Swaps a role with its neighbour, which is how the careers page is ordered. */
  const move = async (index: number, direction: -1 | 1) => {
    const a = jobs[index];
    const b = jobs[index + direction];
    if (!a || !b) return;
    setBusy(a.id);
    await Promise.all([
      supabase.from('job_openings').update({ sort_order: b.sortOrder }).eq('id', a.id),
      supabase.from('job_openings').update({ sort_order: a.sortOrder }).eq('id', b.id),
    ]);
    setBusy(null);
    void load();
  };

  const remove = async (job: JobOpening) => {
    if (
      !confirm(
        `Delete "${job.title}" for good?\n\nApplications already received keep their details and stay in the list below. ` +
          `To stop new ones instead, close the role — it keeps everything and can be reopened.`
      )
    ) return;
    setBusy(job.id);
    const { error: err } = await supabase.from('job_openings').delete().eq('id', job.id);
    setBusy(null);
    if (err) return setError(friendlyError(err));
    setJobs((prev) => prev.filter((row) => row.id !== job.id));
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden mb-6">
      <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
            <Briefcase size={18} className="text-amber-600" /> Job Openings
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {tableMissing
              ? 'Not set up yet.'
              : `${openCount} open on the careers page${jobs.length > openCount ? `, ${jobs.length - openCount} closed` : ''}.`}
          </p>
        </div>
        {!tableMissing && (
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY })}
            className="px-5 py-2.5 rounded-xl bg-maroon-950 text-royal-100 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          >
            <Plus size={14} /> Post a job
          </button>
        )}
      </div>

      {error && (
        <div className="m-6 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}
      {notice && (
        <div className="m-6 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed">{notice}</p>
        </div>
      )}

      {tableMissing ? (
        <div className="p-6">
          <p className="text-sm text-gray-700">
            Run <span className="font-mono text-[12px] text-maroon-900">supabase/044_job_openings.sql</span> in the
            Supabase SQL editor to manage jobs here. Until then the careers page keeps showing the four
            built-in roles.
          </p>
        </div>
      ) : loading ? (
        <p className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Loading roles…
        </p>
      ) : jobs.length === 0 ? (
        <p className="p-10 text-center text-sm text-gray-500">
          No roles yet. Post one and it appears on the careers page straight away.
        </p>
      ) : (
        <ul className="divide-y divide-amber-100">
          {jobs.map((job, index) => {
            const Icon = jobIcon(job.icon);
            return (
              <li key={job.id} className="flex flex-wrap items-center gap-4 p-5 hover:bg-amber-50/30">
                <div className={`w-11 h-11 rounded-2xl ${jobAccent(job.accent)} flex items-center justify-center shrink-0`}>
                  <Icon size={19} />
                </div>
                <div className="min-w-[200px] flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-sm text-maroon-950">
                    {job.title}
                    {job.highlight && (
                      <span className="rounded-full bg-royal-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-maroon-950">
                        Hiring fast
                      </span>
                    )}
                    {!job.active && (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-gray-600">
                        Closed
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {[job.department, job.location, job.employmentType, job.salary].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton label="Move up" disabled={index === 0 || busy === job.id} onClick={() => move(index, -1)}>
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton label="Move down" disabled={index === jobs.length - 1 || busy === job.id} onClick={() => move(index, 1)}>
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton
                    label={job.active ? 'Close this role' : 'Open this role'}
                    disabled={busy === job.id}
                    onClick={() => setActive(job, !job.active)}
                  >
                    {job.active ? <EyeOff size={14} /> : <Eye size={14} />}
                  </IconButton>
                  <IconButton label="Edit" onClick={() => edit(job)}>
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton label="Delete" danger disabled={busy === job.id} onClick={() => remove(job)}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={save}
            onInvalidCapture={(e) => (e.target as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' })}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 flex items-center justify-between bg-maroon-950 px-7 py-5">
              <h3 className="font-display text-lg font-black uppercase tracking-widest text-royal-100">
                {draft.id ? 'Edit role' : 'Post a job'}
              </h3>
              <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="text-royal-200/70 hover:text-royal-100">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-7">
              <div>
                <label className={LABEL}>Job title / पद *</label>
                <input
                  required
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => d && {
                      ...d,
                      title: e.target.value,
                      // The web address follows the title until the role exists.
                      slug: d.id ? d.slug : slugify(e.target.value),
                    })
                  }
                  placeholder="e.g. Master Safa Artist"
                  className={INPUT}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>Department / विभाग</label>
                  <input value={draft.department} onChange={(e) => setDraft((d) => d && { ...d, department: e.target.value })}
                    placeholder="e.g. Artist Network" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Location / जगह</label>
                  <input value={draft.location} onChange={(e) => setDraft((d) => d && { ...d, location: e.target.value })}
                    placeholder="e.g. Ahmedabad / Remote" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Type / प्रकार</label>
                  <input value={draft.employmentType} onChange={(e) => setDraft((d) => d && { ...d, employmentType: e.target.value })}
                    placeholder="Full-time" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Experience / अनुभव</label>
                  <input value={draft.experience} onChange={(e) => setDraft((d) => d && { ...d, experience: e.target.value })}
                    placeholder="e.g. 2+ years, or Fresher welcome" className={INPUT} />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>Salary / वेतन</label>
                  <input value={draft.salary} onChange={(e) => setDraft((d) => d && { ...d, salary: e.target.value })}
                    placeholder="e.g. ₹25,000 – ₹50,000/month" className={INPUT} />
                </div>
              </div>

              <div>
                <label className={LABEL}>About the job / काम के बारे में</label>
                <textarea rows={3} value={draft.summary} onChange={(e) => setDraft((d) => d && { ...d, summary: e.target.value })}
                  placeholder="Two or three sentences a candidate reads first." className={INPUT} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>Responsibilities — one per line</label>
                  <textarea rows={6} value={draft.responsibilities}
                    onChange={(e) => setDraft((d) => d && { ...d, responsibilities: e.target.value })}
                    placeholder={'Tie safas at weddings\nTravel to venues across India'} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Requirements — one per line</label>
                  <textarea rows={6} value={draft.requirements}
                    onChange={(e) => setDraft((d) => d && { ...d, requirements: e.target.value })}
                    placeholder={'2 years of safa tying\nWilling to travel'} className={INPUT} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>Icon</label>
                  <select value={draft.icon} onChange={(e) => setDraft((d) => d && { ...d, icon: e.target.value })} className={INPUT}>
                    {JOB_ICON_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>{choice.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Colour</label>
                  <select value={draft.accent} onChange={(e) => setDraft((d) => d && { ...d, accent: e.target.value })} className={INPUT}>
                    {JOB_ACCENT_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>{choice.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL}>Web address</label>
                <input
                  value={draft.slug}
                  onChange={(e) => setDraft((d) => d && { ...d, slug: slugify(e.target.value) })}
                  disabled={Boolean(draft.id)}
                  className={`${INPUT} font-mono text-[12px] disabled:bg-gray-50 disabled:text-gray-500`}
                />
                <p className="mt-1 text-[10px] text-gray-400">
                  {draft.id
                    ? 'Fixed once a role exists — applications already received are filed under it.'
                    : 'Made from the title. Applications are filed under this.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-5 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-maroon-900">
                  <input type="checkbox" checked={draft.active} className="accent-maroon-900"
                    onChange={(e) => setDraft((d) => d && { ...d, active: e.target.checked })} />
                  Show on the careers page
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-maroon-900">
                  <input type="checkbox" checked={draft.highlight} className="accent-maroon-900"
                    onChange={(e) => setDraft((d) => d && { ...d, highlight: e.target.checked })} />
                  Mark &ldquo;Hiring fast&rdquo;
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-amber-100 bg-white px-7 py-5">
              <button type="button" onClick={() => setDraft(null)}
                className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-maroon-950 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-royal-100 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {draft.id ? 'Save changes' : 'Post the job'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function IconButton({
  label, onClick, children, disabled, danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border p-2 transition-colors disabled:opacity-30 ${
        danger
          ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
          : 'border-amber-200 text-maroon-800 hover:bg-amber-50'
      }`}
    >
      {children}
    </button>
  );
}
