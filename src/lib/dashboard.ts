import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import type { Deal, PipelineStage } from '@/types';
import { scoreContact } from '@/lib/ai/profile-score';
import { dueDate, vehicleName } from '@/lib/jobs';

/**
 * The dashboard's period maths, kept pure so it can be tested.
 *
 * Two kinds of figure share the screen and they must not be confused:
 *
 *  - Period figures (pipeline value, weighted value, average job,
 *    revenue) answer "how did this window go" and move with the date
 *    range. Each is compared against the window of equal length that
 *    ends where this one starts.
 *  - Live figures (late jobs, payments due, jobs missing details) answer
 *    "what needs doing now". A job booked two months ago that is late
 *    today is late whatever range is picked, so these ignore it.
 */

export type PeriodId = '7d' | '30d' | '90d' | '12m' | 'all';

export interface PeriodOption {
  id: PeriodId;
  label: string;
  /** Window length in days; null means no window at all. */
  days: number | null;
}

export const PERIODS: readonly PeriodOption[] = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
  { id: '12m', label: 'Last 12 months', days: 365 },
  { id: 'all', label: 'All time', days: null },
];

export const DEFAULT_PERIOD: PeriodId = '30d';

export function isPeriodId(value: unknown): value is PeriodId {
  return PERIODS.some((p) => p.id === value);
}

/** Start inclusive, end exclusive, both at local midnight. */
export interface DateRange {
  start: Date;
  end: Date;
}

export interface ResolvedPeriod {
  /** null for "All time": nothing is filtered out. */
  current: DateRange | null;
  /** The window before `current`; null when there is nothing to compare. */
  previous: DateRange | null;
}

/**
 * "Last 30 days" is today plus the 29 days before it, so the window ends
 * at tomorrow's midnight and today's work is always inside it.
 */
export function resolvePeriod(id: PeriodId, now = new Date()): ResolvedPeriod {
  const days = PERIODS.find((p) => p.id === id)?.days ?? null;
  if (days === null) return { current: null, previous: null };
  const end = startOfDay(addDays(now, 1));
  const start = addDays(end, -days);
  return {
    current: { start, end },
    previous: { start: addDays(start, -days), end: start },
  };
}

/** "Sep 2, 2026 – Oct 1, 2026", with the exclusive end shown as the last day. */
export function formatRange(range: DateRange): string {
  const last = addDays(range.end, -1);
  return `${format(range.start, 'MMM d, yyyy')} – ${format(last, 'MMM d, yyyy')}`;
}

/**
 * Reads a date column. Date-only values ("2026-09-14") are taken as
 * local midnight, not UTC, so a job entered on the 14th never slides
 * onto the 13th for a viewer west of Greenwich.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/**
 * When a job was booked: the earlier of its Entry Date and the moment it
 * was logged.
 *
 * Neither column works alone. Jobs imported from the old sheet were all
 * logged on the import day, so `created_at` would pile them into one
 * week; their Entry Date is the real one. But a job booked today for a
 * car arriving next week has an Entry Date in the future, which would
 * keep it out of every "last N days" window until it arrived. Taking
 * the earlier of the two gets both cases right.
 */
export function bookedAt(deal: Deal): Date | null {
  const entry = parseDate(deal.start_date);
  const logged = parseDate(deal.created_at);
  if (entry && logged) return entry < logged ? entry : logged;
  return entry ?? logged;
}

/**
 * When a job turned into money: the day the car was collected, or for a
 * job marked Won without passing through Collected, its last update
 * (the same stand-in `computePipelineStats` uses for "won this month").
 * Lost and unfinished jobs have not earned anything.
 */
export function completedAt(deal: Deal): Date | null {
  if (deal.status === 'lost') return null;
  const collected = parseDate(deal.collected_at);
  if (collected) return collected;
  if (deal.status === 'won')
    return parseDate(deal.updated_at ?? deal.created_at);
  return null;
}

function inRange(date: Date | null, range: DateRange): boolean {
  return date !== null && date >= range.start && date < range.end;
}

/**
 * From the first booking on record to today, for labelling "All time"
 * with real dates. Null when there are no jobs at all.
 */
export function spanOf(deals: Deal[], now = new Date()): DateRange | null {
  let first: Date | null = null;
  for (const d of deals) {
    const at = bookedAt(d);
    if (at && (!first || at < first)) first = at;
  }
  if (!first) return null;
  const end = startOfDay(addDays(now, 1));
  const start = startOfDay(first);
  return { start: start < end ? start : addDays(end, -1), end };
}

/** Jobs booked inside the window. `null` returns every job. */
export function dealsBookedIn(deals: Deal[], range: DateRange | null): Deal[] {
  if (!range) return deals;
  return deals.filter((d) => inRange(bookedAt(d), range));
}

/** Jobs completed inside the window. `null` returns every completed job. */
export function dealsCompletedIn(
  deals: Deal[],
  range: DateRange | null
): Deal[] {
  return deals.filter((d) => {
    const at = completedAt(d);
    return at !== null && (range === null || inRange(at, range));
  });
}

/** Money from jobs completed inside the window. `null` counts everything. */
export function revenueIn(deals: Deal[], range: DateRange | null): number {
  return dealsCompletedIn(deals, range).reduce(
    (sum, d) => sum + Number(d.value || 0),
    0
  );
}

/**
 * Percentage change from `previous` to `current`, or null when there is
 * no base to measure from. "Up from nothing" is not a percentage, and
 * printing +∞% or +100% for it would be a lie either way.
 */
export function percentChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/* ═══ Revenue trend ════════════════════════════════════════════════════ */

export type Granularity = 'day' | 'week' | 'month';

export interface RevenuePoint {
  /** ISO start of the bucket; stable React key. */
  key: string;
  /** Axis label, e.g. "Sep 14" or "Sep 2026". */
  label: string;
  /** What the bucket earned on its own. */
  amount: number;
  /** Running total up to and including this bucket. */
  total: number;
}

/** Daily up to a month, weekly up to a quarter, monthly beyond. */
export function granularityFor(range: DateRange): Granularity {
  const days = Math.round(
    (range.end.getTime() - range.start.getTime()) / 86_400_000
  );
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

const BUCKET = {
  day: { floor: startOfDay, next: (d: Date) => addDays(d, 1), label: 'MMM d' },
  week: {
    floor: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
    next: (d: Date) => addWeeks(d, 1),
    label: 'MMM d',
  },
  month: {
    floor: startOfMonth,
    next: (d: Date) => addMonths(d, 1),
    label: 'MMM yyyy',
  },
} as const;

export interface RevenueSeries {
  points: RevenuePoint[];
  granularity: Granularity;
}

/**
 * Cumulative revenue across the window, one point per bucket, so the
 * line ends exactly on the headline figure printed beneath it.
 *
 * For "All time" (`range` null) the window runs from the first month
 * anything was earned. No points when nothing was.
 */
export function revenueSeries(
  deals: Deal[],
  range: DateRange | null,
  now = new Date()
): RevenueSeries {
  let window = range;
  if (!window) {
    const dates = deals.map(completedAt).filter((d): d is Date => d !== null);
    if (dates.length === 0) return { points: [], granularity: 'month' };
    const first = dates.reduce((a, b) => (a < b ? a : b));
    window = { start: startOfMonth(first), end: startOfDay(addDays(now, 1)) };
  }

  const granularity = granularityFor(window);
  const unit = BUCKET[granularity];
  const points: RevenuePoint[] = [];
  for (let at = unit.floor(window.start); at < window.end; at = unit.next(at)) {
    // The first bucket can begin before the window does (a week that
    // started on Monday when the window starts on Wednesday); label it
    // by the day the window actually starts.
    const shown = at < window.start ? window.start : at;
    points.push({
      key: at.toISOString(),
      label: format(shown, unit.label),
      amount: 0,
      total: 0,
    });
  }
  if (points.length === 0) return { points, granularity };

  const index = new Map(points.map((p, i) => [p.key, i]));
  for (const deal of deals) {
    const at = completedAt(deal);
    if (!inRange(at, window)) continue;
    const i = index.get(unit.floor(at as Date).toISOString());
    if (i !== undefined) points[i].amount += Number(deal.value || 0);
  }

  let running = 0;
  for (const p of points) {
    running += p.amount;
    p.total = running;
  }
  return { points, granularity };
}

/* ═══ Jobs missing details ═════════════════════════════════════════════ */

/**
 * The customer details a job cannot be run without. A subset of the
 * profile score's fields: the score also rewards nice-to-haves (email,
 * VIN, year) that should never put a job on a to-do list.
 */
const ESSENTIAL_FIELDS = new Set([
  'car_model',
  'service_types',
  'name',
  'plate_number',
]);

export interface JobNeedingInfo {
  deal: Deal;
  /** Plain labels, most important first: "Vehicle", "Plate", … */
  missing: string[];
}

/**
 * Open jobs whose customer record is missing something the workshop
 * needs. Field definitions come from `scoreContact`, so "missing" means
 * the same thing here as in the customer panel. Finished and collected
 * jobs are past the point where the gap matters.
 */
export function jobsNeedingInfo(deals: Deal[]): JobNeedingInfo[] {
  const out: JobNeedingInfo[] = [];
  for (const deal of deals) {
    if (deal.status === 'won' || deal.status === 'lost' || deal.collected_at)
      continue;
    if (!deal.contact) {
      out.push({ deal, missing: ['Customer'] });
      continue;
    }
    const missing = scoreContact(deal.contact)
      .missing.filter((m) => ESSENTIAL_FIELDS.has(m.field))
      .map((m) => m.label);
    if (missing.length > 0) out.push({ deal, missing });
  }
  return out.sort((a, b) => b.missing.length - a.missing.length);
}

/* ═══ Export ═══════════════════════════════════════════════════════════ */

/**
 * One CSV cell. Quoted always; text that a spreadsheet would run as a
 * formula (=, +, -, @ …) is prefixed with an apostrophe, because these
 * cells hold whatever a customer typed. Plain numbers and phone numbers
 * like "+971 50 123 4567" are left alone so they still read as numbers.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().,]+$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const ymd = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd') : '');

/**
 * The jobs as a spreadsheet. Money goes out as bare numbers so it can
 * be summed; the column header carries the currency. Starts with a BOM
 * so Excel opens Arabic customer names as text rather than mojibake.
 */
export function jobsToCsv(deals: Deal[], stages: PipelineStage[]): string {
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const header = [
    'Booked',
    'Vehicle',
    'Customer',
    'Phone',
    'Plate',
    'Stage',
    'Status',
    'Value (AED)',
    'Deposit %',
    'Deposit paid',
    'Due',
    'Completed',
  ];
  const rows = deals.map((d) => [
    ymd(bookedAt(d)),
    vehicleName(d),
    d.contact?.name ?? '',
    d.contact?.phone ?? '',
    d.contact?.plate_number ?? '',
    stageName.get(d.stage_id) ?? '',
    d.status ?? 'open',
    Number(d.value || 0),
    d.deposit_percentage ?? '',
    d.deposit_paid ? 'Yes' : 'No',
    ymd(parseDate(dueDate(d))),
    ymd(completedAt(d)),
  ]);
  return (
    '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
  );
}
