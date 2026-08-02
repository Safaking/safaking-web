'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  GraduationCap, Calendar, MapPin, Award, Loader2, AlertCircle,
  CheckCircle2, ArrowLeft, BookOpen, User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BUSINESS, telHref } from '@/lib/business';

interface MyTraining {
  student_id: string;
  full_name: string;
  status: 'enrolled' | 'attending' | 'completed' | 'dropped';
  days_attended: number;
  score: number | null;
  fee_paid: number;
  batch_id: string;
  centre: string;
  start_date: string;
  end_date: string;
  batch_status: string;
  trainer_name: string | null;
  course_name: string;
  course_description: string | null;
  duration_days: number;
  fee: number;
  syllabus: string[] | null;
  certificate_id: string | null;
  certificate_number: string | null;
  certificate_status: 'pending' | 'approved' | 'issued' | 'revoked' | null;
}

/** Student Dashboard — training progress, schedule and certificate. */
export default function StudentDashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [rows, setRows] = useState<MyTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error: loadErr } = await supabase
      .from('my_training')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });

    if (loadErr) {
      setError(
        loadErr.code === 'PGRST205' || loadErr.code === '42P01'
          ? 'The academy is not set up yet — run supabase/011_training.sql.'
          : loadErr.message
      );
      setRows([]);
    } else {
      setRows((data as MyTraining[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-[#FDF6EC] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-amber-200/60 p-10 max-w-md text-center">
          <GraduationCap size={34} className="text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-700">Sign in to see your training.</p>
          <Link
            href="/?auth=login&next=%2Facademy"
            className="inline-block mt-4 px-5 py-2.5 bg-maroon-950 text-royal-300 text-xs font-bold uppercase tracking-wider rounded-xl"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-2 text-royal-200/70 hover:text-royal-300">
            <ArrowLeft size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Home</span>
          </Link>
          <div className="text-right">
            <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
              My Training
            </h1>
            <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
              SafaKing Academy
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-5">
        {error && (
          <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {loading || authLoading ? (
          <div className="py-20 text-center text-gray-500">
            <Loader2 size={28} className="animate-spin mx-auto mb-3 text-amber-500" />
            <p className="text-sm font-bold">Loading…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-3xl border border-amber-200/60 p-12 text-center">
            <BookOpen size={34} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700">You are not enrolled in a batch yet.</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Request enrollment from the Training section on our home page. Once our team places
              you in a batch, your schedule and certificate appear here.
            </p>
            <Link
              href="/#training"
              className="inline-block mt-4 px-5 py-2.5 bg-maroon-950 text-royal-300 text-xs font-bold uppercase tracking-wider rounded-xl"
            >
              Request enrollment
            </Link>
          </div>
        ) : (
          rows.map((row) => {
            const progress =
              row.duration_days > 0
                ? Math.min(100, Math.round((row.days_attended / row.duration_days) * 100))
                : 0;

            return (
              <motion.section
                key={row.student_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden"
              >
                <div className="p-6 bg-maroon-950 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display font-black text-xl text-royal-100">
                        {row.course_name}
                      </h2>
                      <p className="text-[11px] text-royal-200/70 flex items-center gap-1.5 mt-1">
                        <MapPin size={11} /> {row.centre}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        row.status === 'completed'
                          ? 'bg-emerald-400 text-emerald-950'
                          : row.status === 'attending'
                          ? 'bg-royal-400 text-maroon-950'
                          : row.status === 'dropped'
                          ? 'bg-rose-400 text-rose-950'
                          : 'bg-amber-300 text-amber-950'
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Starts', value: row.start_date, icon: Calendar },
                      { label: 'Ends', value: row.end_date, icon: Calendar },
                      { label: 'Trainer', value: row.trainer_name ?? 'To be assigned', icon: User },
                      {
                        label: 'Attendance',
                        value: `${row.days_attended}/${row.duration_days} days`,
                        icon: CheckCircle2,
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60 text-center"
                      >
                        <stat.icon size={15} className="mx-auto text-amber-600 mb-1" />
                        <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">
                          {stat.label}
                        </p>
                        <p className="text-[11px] font-bold text-maroon-950 mt-0.5 truncate">
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1">
                      <span>Course progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-maroon-800 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {row.syllabus && row.syllabus.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        What you will learn
                      </p>
                      <ul className="grid sm:grid-cols-2 gap-1.5">
                        {row.syllabus.map((item) => (
                          <li
                            key={item}
                            className="text-xs text-gray-600 flex items-start gap-1.5"
                          >
                            <CheckCircle2 size={12} className="text-amber-600 shrink-0 mt-0.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Certificate */}
                  <div className="p-4 rounded-2xl border border-amber-200/70 bg-amber-50/40">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1.5">
                      <Award size={12} /> Digital Certificate
                    </p>

                    {row.certificate_status === 'issued' && row.certificate_id ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-emerald-800">
                            Issued · {row.certificate_number}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {row.score != null ? `Score ${row.score}%` : 'Congratulations!'}
                          </p>
                        </div>
                        <Link
                          href={`/documents/certificate/${row.certificate_id}`}
                          className="px-4 py-2.5 bg-maroon-950 hover:bg-maroon-900 text-royal-300 text-[11px] font-bold uppercase tracking-wider rounded-xl"
                        >
                          View & download
                        </Link>
                      </div>
                    ) : row.certificate_status === 'pending' ? (
                      <p className="text-xs text-amber-800">
                        Your certificate is with our team for approval. You will see it here once
                        issued.
                      </p>
                    ) : row.certificate_status === 'revoked' ? (
                      <p className="text-xs text-rose-700">
                        This certificate has been revoked. Please contact the academy.
                      </p>
                    ) : row.status === 'completed' ? (
                      <p className="text-xs text-gray-600">
                        Course complete. Your certificate will be raised by the academy shortly.
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Finish the course to receive your certificate.
                      </p>
                    )}
                  </div>
                </div>
              </motion.section>
            );
          })
        )}

        <p className="text-center text-[11px] text-gray-500 pt-2">
          Questions about your training? Call{' '}
          <a href={telHref} className="font-bold text-maroon-800 hover:underline">
            {BUSINESS.phone}
          </a>
        </p>
      </main>
    </div>
  );
}
