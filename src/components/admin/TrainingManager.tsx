'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  GraduationCap, Plus, Loader2, AlertCircle, Award, CheckCircle2, XCircle, Users,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';

interface Course { id: string; name: string; duration_days: number; fee: number; active: boolean }
interface Batch {
  id: string; course_id: string; centre: string; start_date: string; end_date: string;
  seats: number; trainer_name: string | null; status: string;
}
interface Student {
  id: string; batch_id: string; full_name: string; phone: string; city: string | null;
  status: 'enrolled' | 'attending' | 'completed' | 'dropped';
  days_attended: number; score: number | null; user_id: string | null;
}
interface Certificate {
  id: string; student_id: string; student_name: string; course_name: string;
  certificate_number: string | null; status: 'pending' | 'approved' | 'issued' | 'revoked';
  completed_on: string | null; score: number | null;
}

const STUDENT_STATES = ['enrolled', 'attending', 'completed', 'dropped'] as const;
const BATCH_STATES = ['scheduled', 'running', 'completed', 'cancelled'] as const;

/** Admin: batches, students, attendance and certificate approval. */
export function TrainingManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    course_id: '', centre: 'Partapur',
    start_date: '', end_date: '', seats: '15', trainer_name: '',
  });
  const [newStudent, setNewStudent] = useState({ full_name: '', phone: '', city: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [c, b, s, cert] = await Promise.all([
      supabase.from('training_courses').select('*').order('name'),
      supabase.from('training_batches').select('*').order('start_date', { ascending: false }),
      supabase.from('training_students').select('*').order('created_at', { ascending: false }),
      supabase.from('certificates').select('*').order('created_at', { ascending: false }),
    ]);

    const firstError = c.error ?? b.error ?? s.error ?? cert.error;
    if (firstError) setError(friendlyError(firstError));
    else setError(null);

    setCourses((c.data as Course[]) ?? []);
    setBatches((b.data as Batch[]) ?? []);
    setStudents((s.data as Student[]) ?? []);
    setCertificates((cert.data as Certificate[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('batch');
    setError(null);

    const { error: insertErr } = await supabase.from('training_batches').insert({
      course_id: form.course_id || courses[0]?.id,
      centre: form.centre.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      seats: Number(form.seats) || 15,
      trainer_name: form.trainer_name.trim() || null,
    });

    if (insertErr) setError(friendlyError(insertErr));
    else {
      setCreating(false);
      setForm({ ...form, start_date: '', end_date: '', trainer_name: '' });
      await load();
    }
    setBusy(null);
  };

  const addStudent = async (batchId: string) => {
    if (!newStudent.full_name.trim() || !newStudent.phone.trim()) {
      setError('A student needs a name and a phone number.');
      return;
    }
    setBusy(batchId);
    setError(null);

    const { error: insertErr } = await supabase.from('training_students').insert({
      batch_id: batchId,
      full_name: newStudent.full_name.trim(),
      phone: newStudent.phone.trim(),
      city: newStudent.city.trim() || null,
    });

    // The capacity trigger raises a plain message; show it as-is.
    if (insertErr) setError(friendlyError(insertErr));
    else {
      setNewStudent({ full_name: '', phone: '', city: '' });
      await load();
    }
    setBusy(null);
  };

  const patchStudent = async (id: string, patch: Partial<Student>) => {
    setBusy(id);
    const { error: updateErr } = await supabase
      .from('training_students')
      .update(patch)
      .eq('id', id);

    if (updateErr) setError(friendlyError(updateErr));
    else await load();
    setBusy(null);
  };

  const raiseCertificate = async (studentId: string) => {
    setBusy(studentId);
    setError(null);
    setNotice(null);

    const { error: rpcErr } = await supabase.rpc('request_certificate', {
      p_student_id: studentId,
    });

    if (rpcErr) setError(friendlyError(rpcErr));
    else {
      setNotice('Certificate raised. Approve it below to issue the number.');
      await load();
    }
    setBusy(null);
  };

  const approveCertificate = async (certificateId: string) => {
    setBusy(certificateId);
    setError(null);

    const { data, error: rpcErr } = await supabase.rpc('approve_certificate', {
      p_certificate_id: certificateId,
    });

    if (rpcErr) setError(friendlyError(rpcErr));
    else {
      setNotice(`Certificate issued: ${data}`);
      await load();
    }
    setBusy(null);
  };

  const revokeCertificate = async (certificateId: string) => {
    const reason = window.prompt('Why is this certificate being revoked? The student will see it.');
    if (reason === null || !reason.trim()) return;

    setBusy(certificateId);
    const { error: updateErr } = await supabase
      .from('certificates')
      .update({ status: 'revoked', revoked_reason: reason.trim() })
      .eq('id', certificateId);

    if (updateErr) setError(friendlyError(updateErr));
    else await load();
    setBusy(null);
  };

  const pendingCertificates = certificates.filter((c) => c.status === 'pending');

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200/60 p-12 text-center">
        <Loader2 size={26} className="animate-spin mx-auto mb-3 text-amber-500" />
        <p className="text-sm font-bold text-gray-600">Loading academy…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-rose-500">
            <XCircle size={14} />
          </button>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{notice}</p>
        </div>
      )}

      {/* Certificate approval queue */}
      <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-amber-100">
          <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
            <Award size={18} className="text-amber-600" /> Certificate Approval
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {pendingCertificates.length} awaiting approval. A number is only minted on approval.
          </p>
        </div>

        {certificates.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">No certificates raised yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-amber-100">
                <tr>
                  <th className="p-4">Student</th>
                  <th className="p-4">Course</th>
                  <th className="p-4">Number</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 text-xs">
                {certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-amber-50/30">
                    <td className="p-4 font-bold text-maroon-950">
                      {cert.student_name}
                      {cert.score != null && (
                        <span className="block text-[10px] text-gray-400">Score {cert.score}%</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-700">{cert.course_name}</td>
                    <td className="p-4 font-mono text-[11px] text-gray-600">
                      {cert.certificate_number ?? '—'}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          cert.status === 'issued'
                            ? 'bg-emerald-100 text-emerald-800'
                            : cert.status === 'revoked'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {cert.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {cert.status === 'pending' && (
                          <button
                            onClick={() => approveCertificate(cert.id)}
                            disabled={busy === cert.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase flex items-center gap-1 disabled:opacity-50"
                          >
                            {busy === cert.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={11} />
                            )}
                            Approve
                          </button>
                        )}
                        {cert.status === 'issued' && (
                          <>
                            <a
                              href={`/documents/certificate/${cert.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-royal-100 text-royal-800 text-[10px] font-bold uppercase"
                            >
                              View ↗
                            </a>
                            <button
                              onClick={() => revokeCertificate(cert.id)}
                              className="p-1.5 rounded-lg bg-rose-100 text-rose-700"
                              title="Revoke"
                            >
                              <XCircle size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batches */}
      <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
            <GraduationCap size={18} className="text-amber-600" /> Batches
          </h3>
          <button
            onClick={() => setCreating(!creating)}
            className="flex items-center gap-1.5 px-4 py-2 bg-maroon-950 hover:bg-maroon-900 text-royal-300 text-[11px] font-bold uppercase tracking-wider rounded-xl"
          >
            <Plus size={13} /> {creating ? 'Cancel' : 'New batch'}
          </button>
        </div>

        {creating && (
          <form onSubmit={createBatch} className="p-6 border-b border-amber-100 bg-amber-50/40 space-y-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <select
                value={form.course_id}
                onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.duration_days}d, ₹{course.fee})
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Centre"
                value={form.centre}
                onChange={(e) => setForm({ ...form, centre: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs"
              />
              <input
                required
                placeholder="Trainer name"
                value={form.trainer_name}
                onChange={(e) => setForm({ ...form, trainer_name: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs"
              />
              <input
                required
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs"
              />
              <input
                required
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs"
              />
              <input
                required
                type="number"
                min={1}
                placeholder="Seats"
                value={form.seats}
                onChange={(e) => setForm({ ...form, seats: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={busy === 'batch'}
              className="px-5 py-2.5 bg-maroon-950 text-royal-300 text-[11px] font-bold uppercase tracking-wider rounded-xl disabled:opacity-60"
            >
              {busy === 'batch' ? 'Creating…' : 'Create batch'}
            </button>
          </form>
        )}

        {batches.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">
            No batches yet. Create one to start enrolling students.
          </p>
        ) : (
          <div className="divide-y divide-amber-100">
            {batches.map((batch) => {
              const roll = students.filter((s) => s.batch_id === batch.id);
              const active = roll.filter((s) => s.status !== 'dropped').length;
              const isOpen = openBatch === batch.id;

              return (
                <div key={batch.id} className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-maroon-950">{batch.centre}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {batch.start_date} → {batch.end_date}
                        {batch.trainer_name ? ` · ${batch.trainer_name}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-1 flex items-center gap-1">
                        <Users size={11} /> {active} / {batch.seats} seats
                        {active >= batch.seats && (
                          <span className="ml-1 text-rose-600 font-bold">FULL</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={batch.status}
                        onChange={async (e) => {
                          await supabase
                            .from('training_batches')
                            .update({ status: e.target.value })
                            .eq('id', batch.id);
                          load();
                        }}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 text-[11px] font-bold capitalize"
                      >
                        {BATCH_STATES.map((state) => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setOpenBatch(isOpen ? null : batch.id)}
                        className="px-3 py-1.5 rounded-xl bg-royal-100 text-royal-800 text-[11px] font-bold uppercase"
                      >
                        {isOpen ? 'Hide' : 'Students'}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-amber-100 space-y-3">
                      <div className="grid sm:grid-cols-4 gap-2">
                        <input
                          placeholder="Student name"
                          value={newStudent.full_name}
                          onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                          className="px-3 py-2 rounded-xl border border-gray-200 text-xs"
                        />
                        <input
                          placeholder="Phone"
                          value={newStudent.phone}
                          onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                          className="px-3 py-2 rounded-xl border border-gray-200 text-xs"
                        />
                        <input
                          placeholder="City"
                          value={newStudent.city}
                          onChange={(e) => setNewStudent({ ...newStudent, city: e.target.value })}
                          className="px-3 py-2 rounded-xl border border-gray-200 text-xs"
                        />
                        <button
                          onClick={() => addStudent(batch.id)}
                          disabled={busy === batch.id}
                          className="px-3 py-2 bg-maroon-950 text-royal-300 text-[10px] font-bold uppercase rounded-xl disabled:opacity-60"
                        >
                          Add student
                        </button>
                      </div>

                      {roll.length === 0 ? (
                        <p className="text-xs text-gray-500 py-3 text-center">
                          No students in this batch yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {roll.map((student) => {
                            const hasCertificate = certificates.some(
                              (c) => c.student_id === student.id
                            );
                            return (
                              <div
                                key={student.id}
                                className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-amber-50/40 border border-amber-200/70"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-xs text-maroon-950">
                                    {student.full_name}
                                  </p>
                                  <p className="text-[10px] text-gray-500">
                                    {student.phone}
                                    {student.city ? ` · ${student.city}` : ''}
                                  </p>
                                </div>

                                <input
                                  type="number"
                                  min={0}
                                  title="Days attended"
                                  value={student.days_attended}
                                  onChange={(e) =>
                                    patchStudent(student.id, {
                                      days_attended: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  placeholder="Score"
                                  value={student.score ?? ''}
                                  onChange={(e) =>
                                    patchStudent(student.id, {
                                      score: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                  className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]"
                                />
                                <select
                                  value={student.status}
                                  onChange={(e) =>
                                    patchStudent(student.id, {
                                      status: e.target.value as Student['status'],
                                    })
                                  }
                                  className="px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold capitalize"
                                >
                                  {STUDENT_STATES.map((state) => (
                                    <option key={state} value={state}>{state}</option>
                                  ))}
                                </select>

                                {student.status === 'completed' && !hasCertificate && (
                                  <button
                                    onClick={() => raiseCertificate(student.id)}
                                    disabled={busy === student.id}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Award size={11} /> Certificate
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
