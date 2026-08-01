'use client';

import { Star } from 'lucide-react';

/**
 * Star rating. Interactive when `onChange` is given, read-only otherwise.
 *
 * `count` matters: a brand new artist stores 5.0 so they don't read as
 * "terrible", but showing five gold stars with no reviews behind them would be
 * misleading. When count is 0 the caller should render "Not rated yet".
 */
export function Stars({
  value, size = 14, onChange, className = '',
}: {
  value: number;
  size?: number;
  onChange?: (next: number) => void;
  className?: string;
}) {
  const interactive = typeof onChange === 'function';

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        const icon = (
          <Star
            size={size}
            className={filled ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}
          />
        );

        return interactive ? (
          <button
            key={star}
            type="button"
            onClick={() => onChange!(star)}
            className="p-0.5 hover:scale-110 transition-transform"
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
          >
            {icon}
          </button>
        ) : (
          <span key={star}>{icon}</span>
        );
      })}
    </span>
  );
}

/** Rating with its evidence, so "5.0" is never shown without context. */
export function RatingSummary({
  rating, count, size = 13,
}: {
  rating: number | null;
  count: number;
  size?: number;
}) {
  if (count === 0) {
    return <span className="text-[11px] font-bold text-gray-400">Not rated yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Stars value={rating ?? 0} size={size} />
      <span className="text-[11px] font-bold text-gray-600">
        {(rating ?? 0).toFixed(1)} ({count})
      </span>
    </span>
  );
}
