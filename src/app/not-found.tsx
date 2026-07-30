'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-4xl font-serif font-bold text-[#8B1E2F] mb-2">404</h2>
      <p className="text-slate-600 text-sm mb-6">Royal Safa page not found.</p>
      <Link
        href="/"
        className="bg-[#8B1E2F] text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md hover:bg-[#59111E] transition-all"
      >
        Return Home
      </Link>
    </div>
  );
}
