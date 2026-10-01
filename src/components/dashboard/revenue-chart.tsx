'use client';

import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { Granularity, RevenuePoint } from '@/lib/dashboard';
import { formatCurrency } from '@/lib/jobs';

/**
 * Running revenue across the selected window.
 *
 * Cumulative on purpose: the line ends on the headline figure printed
 * under it, so the chart and the number cannot be read as two different
 * claims, and the slope still shows when the money came in. One series,
 * so one hue (the brand indigo) and no legend; the card title names it.
 *
 * Colours are the theme tokens themselves, so After Dark gets its own
 * lifted indigo rather than a flipped copy of Daylight's.
 */

const axisNumber = new Intl.NumberFormat('en-AE', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const PER: Record<Granularity, string> = {
  day: 'that day',
  week: 'that week',
  month: 'that month',
};

export function RevenueChart({
  data,
  granularity,
}: {
  data: RevenuePoint[];
  granularity: Granularity;
}) {
  // One gradient per chart instance; a shared id would let a second
  // chart on the page paint with the first one's fill.
  const fillId = `revenue-fill-${useId().replace(/:/g, '')}`;

  return (
    // A positive starting size: the default (-1 x -1) holds until the
    // resize observer first measures the box, and recharts warns about
    // it on every mount.
    <ResponsiveContainer
      width="100%"
      height="100%"
      initialDimension={{ width: 1, height: 1 }}
    >
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          minTickGap={28}
          interval="preserveStartEnd"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        />
        <YAxis
          width={44}
          axisLine={false}
          tickLine={false}
          tickCount={4}
          allowDecimals={false}
          tickFormatter={(v: number) => axisNumber.format(v)}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        />
        <Tooltip
          cursor={{
            stroke: 'var(--muted-foreground)',
            strokeOpacity: 0.35,
            strokeWidth: 1,
          }}
          content={({ active, payload }) => (
            <ChartTooltip
              active={active}
              point={payload?.[0]?.payload as RevenuePoint | undefined}
              per={PER[granularity]}
            />
          )}
        />
        <Area
          type="monotone"
          dataKey="total"
          name="Revenue"
          stroke="var(--primary)"
          strokeWidth={2}
          fill={`url(#${fillId})`}
          dot={false}
          activeDot={{
            r: 4,
            fill: 'var(--primary)',
            stroke: 'var(--card)',
            strokeWidth: 2,
          }}
          animationDuration={500}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Value leads, label follows: the reader already knows the series. */
function ChartTooltip({
  active,
  point,
  per,
}: {
  active?: boolean;
  point?: RevenuePoint;
  per: string;
}) {
  if (!active || !point) return null;
  return (
    <div className="border-border bg-popover rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{point.label}</p>
      <p className="text-popover-foreground mt-0.5 text-sm font-semibold tabular-nums">
        {formatCurrency(point.total)}
      </p>
      {point.amount > 0 && (
        <p className="text-muted-foreground mt-0.5 tabular-nums">
          +{formatCurrency(point.amount)} {per}
        </p>
      )}
    </div>
  );
}
