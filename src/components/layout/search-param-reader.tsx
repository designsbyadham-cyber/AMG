'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Reports one query-string value to its parent, for deep links such as
 * `/pipelines?job=<id>`.
 *
 * A component rather than a hook so the caller can put it inside its own
 * `<Suspense>`: Next client-renders everything up to the nearest
 * boundary above a `useSearchParams` call, and isolating it keeps that
 * to this null-rendering leaf instead of the whole page.
 *
 * `onChange` must be stable (a state setter or a `useCallback`), or it
 * re-fires on every render.
 */
export function SearchParamReader({
  name,
  onChange,
}: {
  name: string;
  onChange: (value: string | null) => void;
}) {
  const value = useSearchParams().get(name);
  useEffect(() => {
    onChange(value);
  }, [value, onChange]);
  return null;
}
