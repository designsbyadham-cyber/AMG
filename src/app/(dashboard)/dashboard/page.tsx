'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Ellipsis,
  Gauge,
  Minus,
  RefreshCw,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import type { Deal, PipelineStage } from '@/types';
import { brandForContact } from '@/lib/car-brands';
import { BrandBadge } from '@/components/ui/brand-badge';
import { Button } from '@/components/ui/button';
import { CommandSearch } from '@/components/dashboard/command-search';
import { useCountUp } from '@/hooks/use-count-up';
import { EASE_OUT, SPRING, listItem, rise, stagger } from '@/lib/motion';
import { searchJobs } from '@/lib/search';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import {
  currencyParts,
  dueDate,
  formatCurrency,
  vehicleName,
} from '@/lib/jobs';
import {
  computePipelineStats,
  daysOverdue,
  overdueJobs,
  paymentsDue,
  type PaymentKind,
} from '@/lib/pipeline-stats';
import {
  DEFAULT_PERIOD,
  PERIODS,
  bookedAt,
  dealsBookedIn,
  dealsCompletedIn,
  formatRange,
  isPeriodId,
  jobsNeedingInfo,
  jobsToCsv,
  parseDate,
  percentChange,
  resolvePeriod,
  revenueIn,
  revenueSeries,
  spanOf,
  type PeriodId,
} from '@/lib/dashboard';
import { cn } from '@/lib/utils';

/**
 * The home screen, top to bottom:
 *
 *   toolbar      search · date range · period · export
 *   KPIs         pipeline value · weighted value · average job
 *   Customers    needs more info · late · overdue payment
 *   Revenue      running total across the period
 *   Jobs table   top jobs, or whichever Customers tile is selected
 *
 * Two kinds of number live here and are kept apart on purpose. The
 * KPIs and Revenue move with the date range and compare against the
 * period before it. The Customers tiles are live: a job that is late
 * today is late whatever range is picked. See `@/lib/dashboard`.
 *
 * The pipeline arithmetic still comes from `@/lib/pipeline-stats`, which
 * the Jobs screen also reads, so with "All time" picked the two screens
 * agree to the dirham. Nothing here is filtered to one pipeline.
 */

/** Rows the table shows before "Show all". */
const ROW_LIMIT = 6;

type Segment = 'top' | 'info' | 'late' | 'payments';

interface TableRow {
  deal: Deal;
  /** The figure in the money column: job value, or what is owed. */
  amount: number;
  kind?: PaymentKind;
  missing?: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [stages, setStages] = useState<PipelineStage[] | null>(null);
  const [failed, setFailed] = useState(false);

  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const [segment, setSegment] = useState<Segment>('top');
  // Set only by the search's "Show all matching jobs"; the field itself
  // shows its results in its own dropdown.
  const [tableQuery, setTableQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const db = createClient();
      // Stages are mapped onto deals client-side, the way the Jobs page
      // does it, rather than relying on an embedded alias resolving.
      const [dealsRes, stagesRes] = await Promise.all([
        db.from('deals').select('*, contact:contacts(*)'),
        db.from('pipeline_stages').select('*').order('position'),
      ]);
      // An error must not render as a dashboard full of zeroes: "AED 0
      // pipeline" is a claim about the business, not a loading state.
      if (dealsRes.error || stagesRes.error)
        throw dealsRes.error ?? stagesRes.error;
      setDeals((dealsRes.data ?? []) as Deal[]);
      setStages((stagesRes.data ?? []) as PipelineStage[]);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setFailed(false);
    setDeals(null);
    setStages(null);
    load();
  };

  const view = useMemo(() => {
    if (!deals || !stages) return null;
    const now = new Date();
    const { current, previous } = resolvePeriod(period, now);
    const booked = dealsBookedIn(deals, current);
    const series = revenueSeries(deals, current, now);
    const span = current ?? spanOf(deals, now);

    return {
      current,
      rangeLabel: span ? formatRange(span) : 'No jobs yet',
      booked,
      stats: computePipelineStats(booked, stages),
      prevStats: previous
        ? computePipelineStats(dealsBookedIn(deals, previous), stages)
        : null,
      revenue: revenueIn(deals, current),
      prevRevenue: previous ? revenueIn(deals, previous) : null,
      completedCount: dealsCompletedIn(deals, current).length,
      series,
      top: booked
        .filter((d) => d.status !== 'lost')
        .sort((a, b) => Number(b.value || 0) - Number(a.value || 0)),
      late: overdueJobs(deals),
      payments: paymentsDue(deals, stages),
      needInfo: jobsNeedingInfo(deals),
      stageName: new Map(stages.map((s) => [s.id, s.name])),
    };
  }, [deals, stages, period]);

  const loading = view === null && !failed;
  const term = tableQuery.trim();

  const rows: TableRow[] = useMemo(() => {
    if (!view || !deals) return [];
    if (term) {
      // Same matching and order as the search dropdown, so "Show all 12"
      // lists exactly the twelve it counted. Reaches every job, not just
      // the ones in the date range.
      return searchJobs(deals, term, view.stageName).map((deal) => ({
        deal,
        amount: Number(deal.value || 0),
      }));
    }
    switch (segment) {
      case 'late':
        return view.late.map((deal) => ({
          deal,
          amount: Number(deal.value || 0),
        }));
      case 'payments':
        return view.payments.map((p) => ({
          deal: p.deal,
          amount: p.amount,
          kind: p.kind,
        }));
      case 'info':
        return view.needInfo.map((n) => ({
          deal: n.deal,
          amount: Number(n.deal.value || 0),
          missing: n.missing,
        }));
      default:
        return view.top.map((deal) => ({
          deal,
          amount: Number(deal.value || 0),
        }));
    }
  }, [view, deals, segment, term]);

  const selectSegment = (next: Segment) => {
    setSegment((prev) => (prev === next ? 'top' : next));
    setTableQuery('');
    setExpanded(false);
  };

  const showAllJobs = (q: string) => {
    setTableQuery(q);
    setExpanded(false);
    tableRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const exportCsv = () => {
    if (!view || !stages) return;
    if (view.booked.length === 0) {
      toast.info('No jobs were booked in this period.');
      return;
    }
    const sorted = [...view.booked].sort(
      (a, b) => (bookedAt(b)?.getTime() ?? 0) - (bookedAt(a)?.getTime() ?? 0)
    );
    const csv = jobsToCsv(sorted, stages);
    const name = view.current
      ? `amg-jobs-${format(view.current.start, 'yyyy-MM-dd')}-to-${format(
          new Date(view.current.end.getTime() - 1),
          'yyyy-MM-dd'
        )}.csv`
      : 'amg-jobs-all-time.csv';
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking synchronously can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(
      `Exported ${sorted.length} ${sorted.length === 1 ? 'job' : 'jobs'}`
    );
  };

  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? '';
  const compared = period !== 'all';

  return (
    <TooltipProvider>
      {/* Sections arrive one after another, top to bottom, the order the
          page is read in. Played once on mount; data arriving later
          rolls the numbers instead of replaying the entrance. */}
      <motion.div
        variants={stagger(0.07)}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-6xl space-y-5"
      >
        {/* ── Toolbar ───────────────────────────────────────────────── */}
        {/* z-20: the sections below become their own stacking layers
            while they animate, and would otherwise paint over the
            search dropdown. */}
        <motion.div
          variants={rise}
          className="relative z-20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <CommandSearch
            deals={deals}
            stageName={view?.stageName}
            onShowAllJobs={showAllJobs}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="border-border bg-card text-foreground hidden h-8 items-center gap-2 rounded-lg border px-3 text-sm sm:inline-flex">
              <CalendarDays
                className="text-muted-foreground size-4"
                aria-hidden
              />
              {view ? (
                <span className="tabular-nums">{view.rangeLabel}</span>
              ) : (
                <span className="bg-muted h-3.5 w-44 animate-pulse rounded" />
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" className="bg-card" />}
              >
                {periodLabel}
                <ChevronDown className="text-muted-foreground size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuRadioGroup
                  value={period}
                  onValueChange={(v) => {
                    if (isPeriodId(v)) setPeriod(v);
                    setExpanded(false);
                  }}
                >
                  {PERIODS.map((p) => (
                    <DropdownMenuRadioItem key={p.id} value={p.id}>
                      {p.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={exportCsv}
              disabled={!view}
              className="group/export"
            >
              <Download className="transition-transform duration-200 group-hover/export:translate-y-px" />
              Export
            </Button>
          </div>
        </motion.div>

        <motion.h1
          variants={rise}
          className="text-foreground text-2xl font-semibold tracking-tight"
        >
          Dashboard
        </motion.h1>

        {failed ? (
          <motion.div variants={rise}>
            <LoadError onRetry={retry} />
          </motion.div>
        ) : (
          <>
            {/* ── KPIs ─────────────────────────────────────────────── */}
            <motion.div
              variants={stagger(0.07)}
              className="grid gap-4 sm:grid-cols-3"
            >
              <KpiCard
                label="Total Pipeline Value"
                icon={<Wallet />}
                tooltip="Combined value of the jobs booked in this period, except jobs marked Lost. Won jobs still count."
                loading={loading}
                value={view?.stats.totalValue ?? 0}
                previous={compared ? (view?.prevStats?.totalValue ?? 0) : null}
              />
              <KpiCard
                label="Weighted Value"
                icon={<TrendingUp />}
                tooltip="Expected revenue from the open jobs booked in this period: each job's value times its stage probability, from about 10% at the first stage to 100% at the last."
                loading={loading}
                value={view?.stats.weightedValue ?? 0}
                previous={
                  compared ? (view?.prevStats?.weightedValue ?? 0) : null
                }
              />
              <KpiCard
                label="Average Job"
                icon={<Gauge />}
                tooltip="Total pipeline value divided by the number of jobs booked in this period, Lost jobs excluded."
                loading={loading}
                value={view?.stats.avgValue ?? 0}
                previous={compared ? (view?.prevStats?.avgValue ?? 0) : null}
              />
            </motion.div>

            {/* ── Customers ────────────────────────────────────────── */}
            <Card
              title="Customers"
              caption="Live, across all dates"
              menu={[
                { href: '/contacts', label: 'Open Customers' },
                { href: '/call-log', label: 'Open Call Log' },
                { href: '/pipelines', label: 'Open Jobs board' },
              ]}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <SegmentTile
                  label="Needs more info"
                  tone="primary"
                  hint="Open jobs whose customer is missing a name, vehicle, plate or services"
                  count={view?.needInfo.length ?? null}
                  active={segment === 'info' && !term}
                  onSelect={() => selectSegment('info')}
                />
                <SegmentTile
                  label="Late Pick-up or Delivery"
                  tone="danger"
                  hint="Open jobs past their delivery date"
                  count={view?.late.length ?? null}
                  active={segment === 'late' && !term}
                  onSelect={() => selectSegment('late')}
                />
                <SegmentTile
                  label="Overdue Payment"
                  tone="warning"
                  hint="Deposits never taken, and finished cars with the balance still owed"
                  count={view?.payments.length ?? null}
                  active={segment === 'payments' && !term}
                  onSelect={() => selectSegment('payments')}
                />
              </div>
            </Card>

            {/* ── Revenue ──────────────────────────────────────────── */}
            <Card
              title="Revenue"
              menu={[{ href: '/pipelines', label: 'Open Jobs board' }]}
            >
              <div className="h-44 sm:h-52">
                {loading || !view ? (
                  <div className="bg-muted h-full animate-pulse rounded-xl" />
                ) : view.series.points.some((p) => p.total > 0) ? (
                  <RevenueChart
                    data={view.series.points}
                    granularity={view.series.granularity}
                  />
                ) : (
                  <div className="bg-muted/50 text-muted-foreground flex h-full items-center justify-center rounded-xl px-6 text-center text-sm">
                    No jobs completed in this period yet.
                  </div>
                )}
              </div>
              <div className="mt-5">
                {loading || !view ? (
                  <div className="bg-muted h-11 w-48 animate-pulse rounded-lg" />
                ) : (
                  <Money value={view.revenue} size="hero" />
                )}
                {view && (
                  <>
                    <div className="text-muted-foreground mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                      {compared && (
                        <DeltaBadge
                          change={percentChange(
                            view.revenue,
                            view.prevRevenue ?? 0
                          )}
                        />
                      )}
                      <span>
                        {compared ? 'vs. last period' : 'All recorded revenue'}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      From {view.completedCount}{' '}
                      {view.completedCount === 1
                        ? 'completed job'
                        : 'completed jobs'}
                      . A job counts on the day its car is collected, or when
                      it&apos;s marked Won.
                    </p>
                  </>
                )}
              </div>
            </Card>

            {/* ── Jobs table ───────────────────────────────────────── */}
            <motion.div variants={rise} ref={tableRef} className="scroll-mt-4">
              <JobsTable
                rows={rows}
                loading={loading}
                segment={segment}
                term={term}
                expanded={expanded}
                onExpand={() => setExpanded(true)}
                onClear={() => {
                  setTableQuery('');
                  setSegment('top');
                  setExpanded(false);
                }}
                stageName={view?.stageName}
                onOpen={(deal) =>
                  router.push(`/pipelines?job=${encodeURIComponent(deal.id)}`)
                }
              />
            </motion.div>
          </>
        )}
      </motion.div>
    </TooltipProvider>
  );
}

/* ═══ Cards ═══════════════════════════════════════════════════════════ */

/** The shell every section shares: title, optional caption, ⋯ menu. */
function Card({
  title,
  caption,
  menu,
  children,
}: {
  title: string;
  caption?: string;
  menu: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={rise}
      aria-label={title}
      className="border-border bg-card rounded-2xl border p-4 shadow-xs sm:p-5"
    >
      <header className="mb-4 flex items-center gap-3">
        <h2 className="text-foreground text-[15px] font-semibold">{title}</h2>
        {caption && (
          <span className="text-muted-foreground text-xs">{caption}</span>
        )}
        <CardMenu title={title} links={menu} className="ml-auto" />
      </header>
      {children}
    </motion.section>
  );
}

function CardMenu({
  title,
  links,
  className,
}: {
  title: string;
  links: { href: string; label: string }[];
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${title} options`}
            className={cn('text-muted-foreground -my-1', className)}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {links.map((l) => (
          <DropdownMenuItem key={l.href} render={<Link href={l.href} />}>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A money figure with the currency code set small, so the eye lands on
 * the amount. `hero` is the page's one headline number; it is compact
 * ("446.7K") with the exact figure in the title.
 *
 * The amount rolls to its value. Compactness is decided by the final
 * figure, not the rolling one, so a hero number never flips from
 * "99,000" to "100K" halfway through. Screen readers get the final
 * figure once; the rolling digits are hidden from them.
 */
function Money({ value, size }: { value: number; size: 'kpi' | 'hero' }) {
  const hero = size === 'hero';
  const compact = hero && value >= 100_000;
  const rolling = useCountUp(value);
  const { code, amount } = currencyParts(rolling, { compact });
  return (
    <p
      className="text-foreground flex items-baseline gap-1.5 leading-none"
      title={formatCurrency(value)}
    >
      <span className="sr-only">{formatCurrency(value)}</span>
      <span
        aria-hidden
        className={cn(
          'text-muted-foreground font-medium',
          hero ? 'text-base sm:text-lg' : 'text-sm'
        )}
      >
        {code}
      </span>
      <span
        aria-hidden
        className={cn(
          'font-semibold tracking-tight',
          hero ? 'text-4xl sm:text-5xl' : 'text-[1.75rem]'
        )}
      >
        {amount}
      </span>
    </p>
  );
}

function KpiCard({
  label,
  icon,
  tooltip,
  loading,
  value,
  previous,
}: {
  label: string;
  icon: React.ReactNode;
  tooltip: string;
  loading: boolean;
  value: number;
  /** null when the period has nothing to compare against ("All time"). */
  previous: number | null;
}) {
  return (
    <motion.section
      variants={rise}
      aria-label={label}
      className="border-border bg-card flex flex-col rounded-2xl border p-4 shadow-xs sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-muted-foreground pt-1 text-sm font-medium">
          {label}
        </h2>
        {/* The icon square doubles as the "how is this calculated" hint. */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`How ${label} is calculated`}
                className="bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 [&_svg]:size-4"
              />
            }
          >
            {icon}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>

      {loading ? (
        <>
          <div className="bg-muted mt-2 h-7 w-32 animate-pulse rounded-md" />
          <div className="bg-muted mt-3 h-3 w-40 animate-pulse rounded" />
        </>
      ) : (
        <>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <Money value={value} size="kpi" />
            {previous !== null && (
              <DeltaBadge change={percentChange(value, previous)} />
            )}
          </div>
          <p className="text-muted-foreground mt-2.5 text-xs">
            {previous !== null ? (
              <>
                vs.{' '}
                <span className="tabular-nums">{formatCurrency(previous)}</span>{' '}
                last period
              </>
            ) : (
              'Across every job on record'
            )}
          </p>
        </>
      )}
    </motion.section>
  );
}

/**
 * Change against the previous period. Tints are 8%, not the 12% soft
 * tokens: success and danger ink on their own 12% tint measure 4.4:1 in
 * Daylight, just under the floor for 12px text; at 8% they clear 4.6:1
 * in Daylight and 5.4:1 in After Dark.
 */
function DeltaBadge({ change }: { change: number | null }) {
  const base =
    'inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums [&_svg]:size-3';
  // Pops in once its figure has mostly rolled into place, and again
  // whenever the percentage changes (the key), so a new period visibly
  // brings a new comparison.
  const pop = {
    initial: { opacity: 0, scale: 0.85 },
    animate: { opacity: 1, scale: 1 },
    transition: { ...SPRING, delay: 0.3 },
  };

  if (change === null) {
    return (
      <motion.span
        key="new"
        {...pop}
        className={cn(base, 'bg-success/8 text-success')}
      >
        <ArrowUp aria-hidden />
        New
        <span className="sr-only"> this period, nothing in the last</span>
      </motion.span>
    );
  }

  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) {
    return (
      <motion.span
        key="flat"
        {...pop}
        className={cn(base, 'bg-muted text-muted-foreground')}
      >
        <Minus aria-hidden />
        0%
      </motion.span>
    );
  }

  const up = rounded > 0;
  const text = `${Math.abs(rounded).toLocaleString('en', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
  return (
    <motion.span
      key={`${up ? '+' : '-'}${text}`}
      {...pop}
      className={cn(
        base,
        up ? 'bg-success/8 text-success' : 'bg-danger/8 text-danger'
      )}
    >
      {up ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}
      <span className="sr-only">{up ? 'Up ' : 'Down '}</span>
      {text}
    </motion.span>
  );
}

const TONE = {
  primary: {
    idle: 'border-primary/35',
    active: 'border-primary bg-primary/6 ring-primary/15',
    dot: 'bg-primary',
  },
  danger: {
    idle: 'border-danger/35',
    active: 'border-danger bg-danger/6 ring-danger/15',
    dot: 'bg-danger',
  },
  warning: {
    idle: 'border-warning/50',
    active: 'border-warning bg-warning/8 ring-warning/20',
    dot: 'bg-warning',
  },
} as const;

/**
 * One Customers tile. Selecting it puts its jobs in the table below;
 * selecting it again goes back to Top Jobs.
 *
 * Colour is earned: a tile with nothing in it drops to a neutral border,
 * because a dashboard that is permanently red and amber is one nobody
 * reads. The label always names the state, so colour is never the only
 * cue.
 */
function SegmentTile({
  label,
  tone,
  hint,
  count,
  active,
  onSelect,
}: {
  label: string;
  tone: keyof typeof TONE;
  hint: string;
  count: number | null;
  active: boolean;
  onSelect: () => void;
}) {
  const t = TONE[tone];
  const lit = count !== null && count > 0;
  const rolling = Math.round(useCountUp(count ?? 0, 0.7));
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      disabled={count === null}
      title={hint}
      // It's a control, so it answers the pointer: a lift on hover and a
      // press on click. The cards around it don't move; they aren't
      // clickable, and a lift would promise that they were.
      whileHover={count === null ? undefined : { y: -2 }}
      whileTap={count === null ? undefined : { scale: 0.98 }}
      transition={SPRING}
      className={cn(
        'group bg-card focus-visible:ring-ring/40 flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-[background-color,border-color,box-shadow] focus:outline-none focus-visible:ring-2 disabled:cursor-default',
        active ? cn('ring-4', t.active) : lit ? t.idle : 'border-border',
        !active && 'hover:bg-muted/50'
      )}
    >
      <span className="text-muted-foreground flex w-full items-center gap-2 text-xs font-medium">
        {label}
        <span
          aria-hidden
          className={cn(
            'ml-auto size-1.5 shrink-0 rounded-full',
            lit ? t.dot : 'bg-border'
          )}
        />
      </span>
      {count === null ? (
        <span className="bg-muted mt-2 h-6 w-12 animate-pulse rounded" />
      ) : (
        <span className="text-foreground mt-1 text-2xl font-semibold tracking-tight">
          <span className="sr-only">{count.toLocaleString('en')}</span>
          <span aria-hidden>{rolling.toLocaleString('en')}</span>
        </span>
      )}
    </motion.button>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border px-6 py-12 text-center"
    >
      <AlertTriangle className="text-danger size-6" aria-hidden />
      <div>
        <p className="text-foreground font-medium">
          Couldn&apos;t load the dashboard
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          The job data didn&apos;t come through. Check the connection and try
          again.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw />
        Try again
      </Button>
    </div>
  );
}

/* ═══ Jobs table ══════════════════════════════════════════════════════ */

const SEGMENT_COPY: Record<
  Segment,
  { title: string; caption: string; empty: string }
> = {
  top: {
    title: 'Top Jobs',
    caption: 'Highest value, booked in this period',
    empty: 'No jobs were booked in this period.',
  },
  info: {
    title: 'Needs more info',
    caption: 'Open jobs whose customer record is missing something',
    empty: 'Every open job has the details it needs.',
  },
  late: {
    title: 'Late Pick-up or Delivery',
    caption: 'Open jobs past their delivery date, latest first',
    empty: 'Every job is on time.',
  },
  payments: {
    title: 'Overdue Payment',
    caption: 'Unpaid deposits, and finished cars with a balance owed',
    empty: 'Nothing outstanding.',
  },
};

function JobsTable({
  rows,
  loading,
  segment,
  term,
  expanded,
  onExpand,
  onClear,
  stageName,
  onOpen,
}: {
  rows: TableRow[];
  loading: boolean;
  segment: Segment;
  term: string;
  expanded: boolean;
  onExpand: () => void;
  onClear: () => void;
  stageName?: Map<string, string>;
  onOpen: (deal: Deal) => void;
}) {
  const searching = term.length > 0;
  const copy = SEGMENT_COPY[segment];
  const title = searching ? `Results for “${term}”` : copy.title;
  const caption = searching ? 'Every job, best match first' : copy.caption;
  const empty = searching ? `No jobs match “${term}”.` : copy.empty;
  const visible = expanded ? rows : rows.slice(0, ROW_LIMIT);
  const showMissing = !searching && segment === 'info';
  const owed = !searching && segment === 'payments';
  // A new list (another tile, a search) cascades in afresh; expanding
  // the same list only brings in the rows that were hidden.
  const listKey = `${segment}|${term}|${loading ? 'loading' : 'ready'}`;

  return (
    <section
      aria-label={title}
      className="border-border bg-card overflow-hidden rounded-2xl border shadow-xs"
    >
      <header className="flex items-start gap-3 px-4 pt-4 pb-3 sm:px-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="min-w-0"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-foreground truncate text-[15px] font-semibold">
                {title}
              </h2>
              {!loading && rows.length > 0 && (
                <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                  {rows.length}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">{caption}</p>
          </motion.div>
        </AnimatePresence>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {(searching || segment !== 'top') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-muted-foreground"
            >
              <X />
              Clear
            </Button>
          )}
          <CardMenu
            title={copy.title}
            links={[
              { href: '/pipelines', label: 'Open Jobs board' },
              { href: '/contacts', label: 'Open Customers' },
            ]}
          />
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={cn(!loading && rows.length === 0 && 'hidden')}>
            <tr className="border-border bg-muted/60 text-muted-foreground border-y text-[11px] font-medium tracking-wider uppercase">
              <th
                scope="col"
                className="hidden px-5 py-2.5 text-left font-medium sm:table-cell"
              >
                Plate
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium sm:px-0"
              >
                Vehicle
              </th>
              <th
                scope="col"
                className="hidden px-4 py-2.5 text-right font-medium md:table-cell"
              >
                Stage
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                {owed ? 'Owed' : 'Value'}
              </th>
              <th
                scope="col"
                className="hidden py-2.5 pr-4 pl-2 text-right font-medium sm:table-cell sm:pr-5"
              >
                {showMissing ? 'Missing' : 'Due'}
              </th>
            </tr>
          </thead>
          <motion.tbody
            key={listKey}
            initial="hidden"
            animate="show"
            className="divide-border divide-y"
          >
            {loading
              ? [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td className="hidden px-5 py-3.5 sm:table-cell">
                      <div className="bg-muted h-3 w-14 animate-pulse rounded" />
                    </td>
                    <td className="px-4 py-3.5 sm:px-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-muted size-8 animate-pulse rounded-lg" />
                        <div className="bg-muted h-3.5 w-36 animate-pulse rounded" />
                      </div>
                    </td>
                    <td className="hidden px-4 md:table-cell">
                      <div className="bg-muted ml-auto h-3 w-16 animate-pulse rounded" />
                    </td>
                    <td className="px-4">
                      <div className="bg-muted ml-auto h-3 w-20 animate-pulse rounded" />
                    </td>
                    <td className="hidden pr-4 pl-2 sm:table-cell sm:pr-5">
                      <div className="bg-muted ml-auto h-3 w-16 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              : visible.map((row, i) => (
                  <JobRow
                    key={row.deal.id}
                    index={i}
                    row={row}
                    stage={stageName?.get(row.deal.stage_id)}
                    showMissing={showMissing}
                    onOpen={onOpen}
                  />
                ))}
          </motion.tbody>
        </table>
      </div>

      {!loading && rows.length === 0 && (
        <div className="border-border flex flex-col items-center gap-2 border-t px-6 py-10 text-center">
          {/* The check means "all clear", so only the to-do lists earn it.
              An empty search or a quiet period is not good news. */}
          {!searching && segment !== 'top' && (
            <CheckCircle2 className="text-success size-5" aria-hidden />
          )}
          <p className="text-muted-foreground text-sm">{empty}</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <footer className="border-border text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3 text-xs sm:px-5">
          {!owed && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="bg-success size-1.5 rounded-full" />
              Deposit received
            </span>
          )}
          <span className="ml-auto flex items-center gap-3">
            {!expanded && rows.length > ROW_LIMIT && (
              <button
                type="button"
                onClick={onExpand}
                className="text-primary focus-visible:ring-ring/40 rounded font-medium hover:underline focus:outline-none focus-visible:ring-2"
              >
                Show all {rows.length}
              </button>
            )}
            <Link
              href="/pipelines"
              className="text-primary focus-visible:ring-ring/40 rounded font-medium hover:underline focus:outline-none focus-visible:ring-2"
            >
              Open Jobs board
            </Link>
          </span>
        </footer>
      )}
    </section>
  );
}

/**
 * One job. The whole row opens that job's card on the Jobs board for
 * pointer users; the vehicle name is the real link, so keyboard and
 * screen-reader users get one tab stop per row rather than a clickable
 * <tr> they can't reach.
 */
function JobRow({
  index,
  row,
  stage,
  showMissing,
  onOpen,
}: {
  index: number;
  row: TableRow;
  stage?: string;
  showMissing: boolean;
  onOpen: (deal: Deal) => void;
}) {
  const { deal } = row;
  const href = `/pipelines?job=${encodeURIComponent(deal.id)}`;
  const customer = deal.contact?.name || deal.contact?.phone || 'No customer';
  const settled =
    deal.deposit_paid || deal.status === 'won' || Boolean(deal.collected_at);
  const trailing = showMissing ? (
    <span className="text-foreground">{row.missing?.join(', ')}</span>
  ) : (
    <DueCell deal={deal} />
  );

  return (
    <motion.tr
      variants={listItem}
      custom={index}
      onClick={() => onOpen(deal)}
      className="hover:bg-muted/40 cursor-pointer transition-colors"
    >
      <td className="text-muted-foreground hidden px-5 py-3 whitespace-nowrap tabular-nums sm:table-cell">
        {deal.contact?.plate_number || '—'}
      </td>
      <td className="w-full max-w-0 px-4 py-3 sm:px-0">
        <div className="flex items-center gap-3">
          <BrandBadge
            brand={brandForContact(deal.contact)}
            size={32}
            bordered
            className="rounded-lg"
          />
          <div className="min-w-0">
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="text-foreground block truncate font-medium hover:underline focus:outline-none focus-visible:underline"
            >
              {vehicleName(deal)}
            </Link>
            <p className="text-muted-foreground truncate text-xs">{customer}</p>
          </div>
        </div>
      </td>
      <td className="text-muted-foreground hidden px-4 py-3 text-right whitespace-nowrap md:table-cell">
        {stage ?? '—'}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span className="inline-flex items-center justify-end gap-2">
          {row.kind ? (
            <PaymentKindChip kind={row.kind} />
          ) : (
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                settled ? 'bg-success' : 'bg-border'
              )}
              title={settled ? 'Deposit received' : 'No deposit yet'}
            >
              <span className="sr-only">
                {settled ? 'Deposit received' : 'No deposit yet'}
              </span>
            </span>
          )}
          <span className="text-foreground font-medium tabular-nums">
            {formatCurrency(row.amount)}
          </span>
        </span>
        {/* On a phone the last column folds in under the amount, so the
            vehicle name keeps enough width to be read. */}
        <div className="mt-0.5 text-xs whitespace-normal sm:hidden">
          {trailing}
        </div>
      </td>
      <td className="hidden py-3 pr-4 pl-2 text-right whitespace-nowrap sm:table-cell sm:pr-5">
        {trailing}
      </td>
    </motion.tr>
  );
}

function DueCell({ deal }: { deal: Deal }) {
  if (deal.status === 'lost')
    return <span className="text-muted-foreground">Lost</span>;
  if (deal.status === 'won' || deal.collected_at) {
    return (
      <span className="text-success inline-flex items-center gap-1">
        <CheckCircle2 className="size-3.5" aria-hidden />
        {deal.collected_at ? 'Collected' : 'Won'}
      </span>
    );
  }
  const due = parseDate(dueDate(deal));
  if (!due) return <span className="text-muted-foreground">—</span>;
  const late = daysOverdue(deal);
  if (late > 0) {
    return (
      <span className="text-danger font-medium tabular-nums">
        {late} {late === 1 ? 'day' : 'days'} late
      </span>
    );
  }
  return (
    <span className="text-muted-foreground tabular-nums">
      {format(due, 'MMM d')}
    </span>
  );
}

/**
 * Says which kind of money a row is, since the list mixes both. Ink is
 * `foreground`, not the semantic hue: warning ink on a warning tint is
 * 3.7:1 in Daylight, under the floor for small text, so the tint and
 * border carry the distinction instead.
 */
function PaymentKindChip({ kind }: { kind: PaymentKind }) {
  const isBalance = kind === 'balance';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
        isBalance
          ? 'border-warning/40 bg-warning-soft text-foreground'
          : 'border-border bg-muted text-muted-foreground'
      )}
    >
      {isBalance ? 'Balance' : 'Deposit'}
    </span>
  );
}
