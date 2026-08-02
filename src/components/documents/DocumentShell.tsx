'use client';

import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * Chrome around a printable document.
 *
 * PDF generation is the browser's own print-to-PDF rather than a server-side
 * renderer: it adds no dependency, produces a correct A4 document, and every
 * phone and desktop already has it. `print:hidden` keeps this UI off the paper.
 */
export function DocumentShell({
  title, backHref = '/', children,
}: {
  title: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:hidden bg-maroon-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link
            href={backHref}
            className="flex items-center gap-2 text-royal-200/70 hover:text-royal-300 text-xs font-bold uppercase tracking-wider"
          >
            <ArrowLeft size={15} /> Back
          </Link>
          <h1 className="text-sm font-display font-bold text-royal-100 uppercase tracking-widest">
            {title}
          </h1>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-royal-500 hover:bg-royal-400 text-maroon-950 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors"
          >
            <Printer size={14} /> Save as PDF
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 sm:p-8 print:p-0 print:max-w-none">
        <article className="bg-white shadow-lg print:shadow-none rounded-2xl print:rounded-none p-8 sm:p-12 print:p-0">
          {children}
        </article>
      </div>

      <p className="print:hidden text-center text-xs text-gray-400 pb-8">
        Use your browser&apos;s print dialog and choose &ldquo;Save as PDF&rdquo;.
      </p>
    </div>
  );
}
