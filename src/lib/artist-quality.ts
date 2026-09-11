/**
 * Artist quality control — labels and types for the views in supabase/038.
 *
 * The score itself is computed in the database (artist_job_quality); the
 * rules below only describe it and must match that view.
 */

export type Attendance = 'attended' | 'no_show' | 'withdrew';

export interface JobQuality {
  kind: 'booking' | 'rental';
  job_id: string;
  artist_id: string;
  customer_name: string | null;
  event_date: string;
  event_at: string | null;
  status: string;
  attendance: Attendance | null;
  arrived_at: string | null;
  minutes_late: number | null;
  reported_late: boolean;
  rating: number | null;
  complaints: number;
  critical_complaints: number;
  record_note: string | null;
  arrival_points: number | null;
  rating_points: number | null;
  complaint_points: number | null;
  score: number | null;
  needs_record: boolean;
}

export interface ArtistQuality {
  artist_id: string;
  scored_jobs: number;
  quality_score: number;
  attendance_pct: number;
  on_time_pct: number | null;
  arrival_unrecorded: number;
  avg_rating: number | null;
  rated_jobs: number;
  complaints: number;
  failures: number;
  last_job: string | null;
}

export const ON_TIME_GRACE_MINUTES = 10;

/** Below this many scored jobs a score says more about luck than the artist. */
export const MIN_JOBS_FOR_GRADE = 3;

export const SCORE_RULES = [
  'Came to the job: 40 points. A no-show or pulling out scores the whole job 0.',
  `Arrival: within ${ON_TIME_GRACE_MINUTES} minutes of the start time 20, by 30 minutes 12, by an hour 6, later 0. Not recorded: 10.`,
  'Customer rating: up to 25 points (5 stars = 25). Left out until the customer reviews.',
  'Complaints: none 15, one 5, two or more (or any P1) 0. Dismissed complaints do not count.',
  'The artist score is the average of their last 20 scored jobs.',
];

export const ATTENDANCE_LABEL: Record<Attendance, string> = {
  attended: 'Came',
  no_show: 'Did not come',
  withdrew: 'Pulled out',
};

export function qualityGrade(score: number | null | undefined, jobs: number): { label: string; tone: string } {
  if (score == null || jobs < MIN_JOBS_FOR_GRADE) return { label: 'New', tone: 'bg-gray-100 text-gray-600' };
  if (score >= 85) return { label: 'Excellent', tone: 'bg-emerald-100 text-emerald-800' };
  if (score >= 70) return { label: 'Good', tone: 'bg-lime-100 text-lime-800' };
  if (score >= 50) return { label: 'Needs improvement', tone: 'bg-amber-100 text-amber-800' };
  return { label: 'Poor', tone: 'bg-rose-100 text-rose-800' };
}

export const scoreTone = (score: number | null | undefined) =>
  score == null ? 'text-gray-400' : score >= 85 ? 'text-emerald-700' : score >= 70 ? 'text-lime-700' : score >= 50 ? 'text-amber-700' : 'text-rose-700';

export function arrivalLabel(job: Pick<JobQuality, 'attendance' | 'minutes_late' | 'reported_late'>): string {
  if (job.attendance !== 'attended') return '—';
  if (job.minutes_late == null) return job.reported_late ? 'Reported late' : 'Not recorded';
  if (job.minutes_late < 0) return `${-job.minutes_late} min early`;
  if (job.minutes_late <= ON_TIME_GRACE_MINUTES) return job.minutes_late === 0 ? 'On time' : `On time (+${job.minutes_late} min)`;
  return `${job.minutes_late} min late`;
}

/** What still has to be confirmed about a finished job. */
export function missingFacts(job: JobQuality): string {
  if (job.attendance == null) return 'Did the artist come?';
  if (job.attendance === 'attended' && job.minutes_late == null && !job.reported_late) return 'Arrival time';
  return '';
}
