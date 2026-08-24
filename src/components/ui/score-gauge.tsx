'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A 240-degree dial for a 0-100 score.
 *
 * The arc carries the reading at a glance and the numeral carries the
 * exact value, so neither has to be inferred from the other. Geometry
 * notes: an SVG circle's path begins at 3 o'clock and runs clockwise,
 * so rotating it 150 degrees puts the start at the lower left and
 * leaves the gap centred at the bottom.
 */

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SWEEP = 240 / 360;
const ARC_LENGTH = CIRCUMFERENCE * SWEEP;

const BAND_STROKE = {
  strong: 'stroke-success',
  partial: 'stroke-warning',
  thin: 'stroke-danger',
} as const;

const BAND_TEXT = {
  strong: 'text-success',
  partial: 'text-warning',
  thin: 'text-danger',
} as const;

export type ScoreBand = keyof typeof BAND_STROKE;

interface ScoreGaugeProps {
  /** 0-100. Clamped. */
  value: number;
  band: ScoreBand;
  /** Short word under the numeral, e.g. "Complete". */
  caption?: string;
  /** Rendered width in px. The dial scales with it. */
  size?: number;
  /** Describes what is being scored, for screen readers. */
  label: string;
  className?: string;
}

export function ScoreGauge({
  value,
  band,
  caption,
  size = 96,
  label,
  className,
}: ScoreGaugeProps) {
  const score = Math.max(0, Math.min(100, Math.round(value)));

  // Sweep out from empty on first paint so the dial reads as a
  // measurement being taken rather than a static graphic.
  const [drawn, setDrawn] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const filled = drawn ? ARC_LENGTH * (score / 100) : 0;

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size * 0.8 }}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      aria-valuetext={`${score} out of 100${caption ? `, ${caption}` : ''}`}
    >
      <svg viewBox="0 0 100 80" className="size-full overflow-visible" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-muted"
          strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
          transform="rotate(150 50 50)"
        />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className={cn('transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none', BAND_STROKE[band])}
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          transform="rotate(150 50 50)"
        />
      </svg>

      <div className="absolute inset-x-0 top-[62.5%] -translate-y-1/2 text-center">
        <span
          className={cn(
            'block font-heading font-semibold tabular-nums leading-none tracking-tight',
            BAND_TEXT[band],
          )}
          style={{ fontSize: size * 0.3 }}
        >
          {score}
          <span className="align-super text-[0.5em] font-medium opacity-70">%</span>
        </span>
        {caption && (
          <span className="mt-1 block text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
