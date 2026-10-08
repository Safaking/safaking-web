'use client';

import { Crown, GraduationCap, Briefcase, Star, Scissors, Users, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * The roles on /careers.
 *
 * They used to be written into the careers page, so posting a job, changing a
 * salary or closing a role meant a code change. They now come from the
 * job_openings table (supabase/044) and are edited in Admin.
 *
 * The icon and colour are stored as keys rather than CSS, for two reasons:
 * a database cannot put a class into the stylesheet (Tailwind only ships the
 * classes it can see in the source), and it keeps the page looking like
 * itself whatever is typed in Admin.
 */

export interface JobOpening {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  experience: string | null;
  salary: string | null;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  icon: string;
  accent: string;
  highlight: boolean;
  active: boolean;
  sortOrder: number;
  createdAt?: string;
}

export const JOB_ICONS: Record<string, LucideIcon> = {
  crown: Crown,
  trainer: GraduationCap,
  business: Briefcase,
  content: Star,
  artist: Scissors,
  team: Users,
};

export const JOB_ACCENTS: Record<string, string> = {
  royal: 'bg-royal-100 text-royal-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  pink: 'bg-pink-100 text-pink-700',
};

/** What each key is called in Admin. */
export const JOB_ICON_CHOICES = [
  { value: 'crown', label: 'Crown — artist roles' },
  { value: 'trainer', label: 'Graduation cap — academy' },
  { value: 'business', label: 'Briefcase — office & sales' },
  { value: 'content', label: 'Star — marketing & content' },
  { value: 'artist', label: 'Scissors — workshop & making' },
  { value: 'team', label: 'People — everything else' },
];

export const JOB_ACCENT_CHOICES = [
  { value: 'royal', label: 'Royal gold' },
  { value: 'amber', label: 'Amber' },
  { value: 'emerald', label: 'Green' },
  { value: 'pink', label: 'Pink' },
];

export const jobIcon = (key: string) => JOB_ICONS[key] ?? Crown;
export const jobAccent = (key: string) => JOB_ACCENTS[key] ?? JOB_ACCENTS.royal;

/** The four roles as they stood before Admin could post them — see supabase/044. */
export const FALLBACK_JOBS: JobOpening[] = [
  {
    id: 'master-safa-artist', slug: 'master-safa-artist', title: 'Master Safa Artist',
    department: 'Artist Network', location: 'Jaipur / Delhi / Mumbai', employmentType: 'Full-time',
    experience: '2+ years', salary: '₹25,000 – ₹50,000/month', icon: 'crown', accent: 'royal',
    highlight: true, active: true, sortOrder: 10,
    summary: 'Join our elite network of safa artists and travel across India to tie safas at premium weddings and events. Work with top grooms, receive premium bookings, and grow your career.',
    responsibilities: [
      'Tie safas at client weddings & events across India',
      'Style Jodhpuri, Rounded & Barati safa variations',
      'Place kalgi, brooch & accessory elements',
      'Coordinate with wedding planners & event teams',
      'Maintain high client satisfaction standards',
    ],
    requirements: [
      'Minimum 2 years of safa tying experience',
      'Proficiency in 2+ safa styles',
      'Willingness to travel for events',
      'Good communication with clients',
      'SafaKing training certification (preferred)',
    ],
  },
  {
    id: 'safa-tying-trainer', slug: 'safa-tying-trainer', title: 'Safa Tying Trainer',
    department: 'SafaKing Academy', location: 'Jaipur / Delhi', employmentType: 'Full-time',
    experience: '4+ years', salary: '₹30,000 – ₹55,000/month', icon: 'trainer', accent: 'amber',
    highlight: false, active: true, sortOrder: 20,
    summary: 'Teach the next generation of safa artists at SafaKing Academy. Conduct hands-on training sessions, demonstrate regional tying styles, and certify new artists.',
    responsibilities: [
      'Conduct daily safa tying training sessions',
      'Demonstrate all 3 signature styles',
      'Evaluate and certify student performance',
      'Maintain training materials and curriculum',
      'Report batch progress to academy head',
    ],
    requirements: [
      '4+ years of professional safa tying',
      'Previous teaching or mentoring experience',
      'Strong knowledge of regional safa styles',
      'Patient and effective communication',
      'Available for both Jaipur & Delhi centers',
    ],
  },
  {
    id: 'sales-supplier-coordinator', slug: 'sales-supplier-coordinator', title: 'Sales & Supplier Coordinator',
    department: 'Business Development', location: 'Jaipur (On-site)', employmentType: 'Full-time',
    experience: '1+ year', salary: '₹18,000 – ₹30,000/month', icon: 'business', accent: 'emerald',
    highlight: false, active: true, sortOrder: 30,
    summary: 'Grow the SafaKing supplier network and keep orders moving between suppliers, artists and customers.',
    responsibilities: [
      'Onboard and verify new safa suppliers',
      'Follow up on orders and dispatches',
      'Keep product and pricing data accurate',
      'Handle customer and supplier calls',
      'Report weekly on sales and stock',
    ],
    requirements: [
      '1+ year in sales or coordination',
      'Comfortable on the phone all day',
      'Basic computer and spreadsheet skills',
      'Hindi and basic English',
      'Based in or near Jaipur',
    ],
  },
  {
    id: 'social-media-content-creator', slug: 'social-media-content-creator', title: 'Social Media & Content Creator',
    department: 'Marketing', location: 'Remote / Jaipur', employmentType: 'Full-time / Part-time',
    experience: 'Fresher welcome', salary: '₹12,000 – ₹22,000/month', icon: 'content', accent: 'pink',
    highlight: false, active: true, sortOrder: 40,
    summary: 'Create stunning Reels, posts, and content showcasing SafaKing safas, artists, and training. Help us grow our social presence and attract grooms across India.',
    responsibilities: [
      'Create Instagram & YouTube video content',
      'Shoot behind-the-scenes safa tying videos',
      'Write product captions and campaign copy',
      'Manage daily posting schedule',
      'Track engagement metrics and report',
    ],
    requirements: [
      'Portfolio of social media content',
      'Experience with Reels / short video editing',
      'Eye for Indian wedding aesthetics',
      'Basic Canva / CapCut / Adobe skills',
      'Passion for Indian culture & fashion',
    ],
  },
];

interface JobRow {
  id: string;
  slug: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  experience: string | null;
  salary: string | null;
  summary: string | null;
  responsibilities: string[] | null;
  requirements: string[] | null;
  icon: string | null;
  accent: string | null;
  highlight: boolean | null;
  active: boolean | null;
  sort_order: number | null;
  created_at?: string;
}

export const JOB_COLUMNS =
  'id, slug, title, department, location, employment_type, experience, salary, summary, ' +
  'responsibilities, requirements, icon, accent, highlight, active, sort_order, created_at';

export function toJobOpening(row: JobRow): JobOpening {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    department: row.department ?? '',
    location: row.location ?? '',
    employmentType: row.employment_type ?? 'Full-time',
    experience: row.experience,
    salary: row.salary,
    summary: row.summary ?? '',
    responsibilities: row.responsibilities ?? [],
    requirements: row.requirements ?? [],
    icon: row.icon ?? 'crown',
    accent: row.accent ?? 'royal',
    highlight: row.highlight ?? false,
    active: row.active ?? true,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
  };
}

/**
 * Loads the roles. `tableMissing` is true on a database where supabase/044
 * has not been run — the careers page then shows the four built-in roles
 * rather than an empty page, and Admin says what to run.
 */
export async function loadJobOpenings(
  { includeClosed = false }: { includeClosed?: boolean } = {}
): Promise<{ jobs: JobOpening[]; tableMissing: boolean }> {
  const query = supabase.from('job_openings').select(JOB_COLUMNS).order('sort_order');
  const { data, error } = includeClosed ? await query : await query.eq('active', true);

  if (error) {
    // 42P01 — the table is not there yet.
    const missing = error.code === '42P01' || /job_openings/i.test(error.message);
    if (!missing) console.warn('Could not load job openings:', error.message);
    return { jobs: [], tableMissing: missing };
  }

  return { jobs: ((data ?? []) as unknown as JobRow[]).map(toJobOpening), tableMissing: false };
}
