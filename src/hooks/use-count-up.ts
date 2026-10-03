'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

import { EASE_OUT } from '@/lib/motion';

/**
 * A number that rolls to its value instead of appearing, so a figure
 * arriving from the database (or changing with the date range) reads as
 * the same figure updating rather than a flicker of text.
 *
 * Each change starts from wherever the number currently is, so switching
 * period mid-roll carries on smoothly. Reduced motion jumps straight
 * there.
 */
export function useCountUp(target: number, duration = 0.9): number {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(() => (reduce ? target : 0));
  const current = useRef(shown);

  useEffect(() => {
    const controls = animate(current.current, target, {
      duration: reduce ? 0 : duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        current.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [target, duration, reduce]);

  return shown;
}
