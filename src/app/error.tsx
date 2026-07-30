'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-serif font-bold text-[#8B1E2F] mb-4">Something went wrong!</h2>
      <button
        onClick={() => reset()}
        className="bg-[#8B1E2F] text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md hover:bg-[#59111E] transition-all"
      >
        Try again
      </button>
    </div>
  );
}
