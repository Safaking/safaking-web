import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase-server';
import { DocumentShell } from '@/components/documents/DocumentShell';

export const dynamic = 'force-dynamic';

/**
 * Digital Certificate.
 *
 * Only an ISSUED certificate renders. A pending or revoked one deliberately
 * shows nothing printable — a certificate that looks official but was never
 * approved (or was withdrawn) is exactly the document a customer must not be
 * shown when deciding whether to trust an artist.
 */
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: certificate } = await supabase
    .from('certificates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!certificate || certificate.status !== 'issued') {
    return (
      <div className="min-h-screen bg-[#FDF6EC] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-amber-200/60 p-10 max-w-md text-center">
          <p className="text-sm font-bold text-gray-700">
            {certificate?.status === 'revoked'
              ? 'This certificate has been revoked and is no longer valid.'
              : certificate?.status === 'pending'
              ? 'This certificate has not been approved yet.'
              : 'No issued certificate found for this reference.'}
          </p>
          <Link
            href="/academy"
            className="inline-block mt-4 px-5 py-2.5 bg-maroon-950 text-royal-300 text-xs font-bold uppercase tracking-wider rounded-xl"
          >
            Back to my training
          </Link>
        </div>
      </div>
    );
  }

  const { data: business } = await supabase.from('business_profile').select('*').maybeSingle();
  const biz = business ?? { legal_name: 'SafaKing Turban House', phone: '', address: '' };

  const completed = certificate.completed_on
    ? new Date(`${certificate.completed_on}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  return (
    <DocumentShell title="Digital Certificate" backHref="/academy">
      <div className="border-[6px] border-double border-maroon-950 p-8 sm:p-12 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-700">
          {biz.legal_name}
        </p>
        <div className="w-16 h-0.5 bg-amber-600 mx-auto my-4" />

        <h1 className="text-3xl sm:text-4xl font-display font-black text-maroon-950 uppercase tracking-widest">
          Certificate
        </h1>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-gray-500 mt-1">
          of Completion
        </p>

        <p className="text-xs text-gray-600 mt-10">This is to certify that</p>
        <p className="text-2xl sm:text-3xl font-display font-black text-maroon-900 mt-2 border-b-2 border-amber-300 inline-block px-8 pb-1">
          {certificate.student_name}
        </p>

        <p className="text-xs text-gray-600 mt-6 max-w-md mx-auto leading-relaxed">
          has successfully completed the{' '}
          <strong className="text-maroon-950">{certificate.course_name}</strong>
          {certificate.centre ? ` at our ${certificate.centre} centre` : ''}
          {completed ? `, concluding on ${completed}` : ''}.
        </p>

        {certificate.score != null && (
          <p className="text-sm font-bold text-amber-800 mt-4">
            Assessment score: {certificate.score}%
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-6 mt-12 pt-6 text-left">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Certificate number
            </p>
            <p className="text-sm font-mono font-bold text-maroon-950 mt-0.5">
              {certificate.certificate_number}
            </p>
          </div>
          <div className="text-right">
            <div className="w-40 border-b border-maroon-950 mb-1" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Academy Head
            </p>
            <p className="text-[10px] text-gray-500">{biz.legal_name}</p>
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-4">
        Verify this certificate by quoting its number to {biz.phone || 'SafaKing'}.
      </p>
    </DocumentShell>
  );
}
