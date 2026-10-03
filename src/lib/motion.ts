import type { Transition, Variants } from 'motion/react';

/**
 * The app's motion vocabulary, in one place so every animation shares a
 * tempo.
 *
 * Motion here is feedback, not decoration: things settle into place as
 * they arrive, and what you touch answers back. Nothing loops, nothing
 * bounces for attention, and everything is short enough that nobody
 * waits on it. `MotionConfig reducedMotion="user"` in the dashboard
 * shell turns the movement off for anyone who has asked their OS for
 * less of it.
 */

/** Fast out of the gate, long gentle settle. For anything arriving. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** For things that follow the pointer: quick, with a barely-there settle. */
export const SPRING: Transition = {
  type: 'spring',
  visualDuration: 0.32,
  bounce: 0.14,
};

/** One section rising into place. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

/**
 * Rows of a list, cascading by index (pass it as `custom`). A smaller
 * rise than a section, since 12px of travel on dense rows reads as
 * jitter. The delay stops growing after the eighth row: a long list
 * should land, not drip in for two seconds.
 */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: EASE_OUT,
      delay: Math.min(i, 8) * 0.035,
    },
  }),
};

/** A parent that brings its children in one after another. */
export function stagger(gap = 0.06, delay = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
  };
}
