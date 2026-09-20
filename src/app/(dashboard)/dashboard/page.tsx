'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  XCircle,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import type { Deal, PipelineStage } from '@/types';
import { brandForContact } from '@/lib/car-brands';
import { BrandBadge } from '@/components/ui/brand-badge';
import { MetricTile, type MetricAccent } from '@/components/ui/metric-tile';
import { TooltipProvider } from '@/components/ui/tooltip';
import { formatCurrency, vehicleName } from '@/lib/jobs';
import {
  computePipelineStats,
  daysOverdue,
  overdueJobs,
  paymentsDue,
  type OutstandingPayment,
} from '@/lib/pipeline-stats';
import { cn } from '@/lib/utils';

/**
 * The home screen.
 *
 * A bento rather than a list: the two things that need acting on today
 * take large tiles on the left, the figures that describe the state of
 * the shop take smaller ones on the right, and tile size is the
 * hierarchy. Every tile carries the nav's accent dash on its left edge,
 * which is what ties this screen, the sidebar and the job log into one
 * system.
 *
 * The numbers come from `@/lib/pipeline-stats` and the figure tiles from
 * `@/components/ui/metric-tile`, both shared with the Jobs screen, so
 * the two surfaces cannot drift apart.
 *
 * Unlike Jobs, nothing here is filtered to one pipeline: the question
 * this page answers is "where does the whole operation stand".
 */

/** Rows a list tile shows before deferring to its "View all" link. */
const LIST_LIMIT = 4;

export default function DashboardPage() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [stages, setStages] = useState<PipelineStage[] | null>(null);

  const load = useCallback(async () => {
    const db = createClient();
    // Stages are mapped onto deals client-side, the way the Jobs page
    // does it, rather than relying on an embedded alias resolving.
    const [dealsRes, stagesRes] = await Promise.all([
      db.from('deals').select('*, contact:contacts(*)'),
      db.from('pipeline_stages').select('*').order('position'),
    ]);
    setDeals((dealsRes.data ?? []) as Deal[]);
    setStages((stagesRes.data ?? []) as PipelineStage[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const view = useMemo(() => {
    if (!deals || !stages) return null;
    return {
      stats: computePipelineStats(deals, stages),
      overdue: overdueJobs(deals),
      payments: paymentsDue(deals, stages),
    };
  }, [deals, stages]);

  const loading = view === null;
  const overdue = view?.overdue ?? [];
  const payments = view?.payments ?? [];

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Today</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where AMG Operations stands right now.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {/* ── Overdue ──────────────────────────────────────────────
              The only red on the page, and only when it is earned: with
              an empty list the tile goes neutral. A dashboard that is
              permanently red is one nobody reads. */}
          <ListTile
            className="col-span-2 sm:col-span-4 lg:col-span-4 lg:row-span-2"
            accent={loading || overdue.length > 0 ? 'danger' : 'neutral'}
            icon={
              loading || overdue.length > 0 ? (
                <AlertTriangle className="size-4 shrink-0 text-danger" />
              ) : (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              )
            }
            label="Overdue"
            count={loading ? null : overdue.length}
            // Red ink on a neutral chip, not on a red tint. Danger on
            // danger-soft measures 3.4:1 on After Dark, which is under
            // the floor for 10px text; on bg-muted it clears 4.8:1 in
            // both themes and the count still reads red.
            countClass="bg-muted text-danger"
            loading={loading}
            empty="Every job is on time."
          >
            {overdue.slice(0, LIST_LIMIT).map((deal) => {
              const late = daysOverdue(deal);
              return (
                <JobRow
                  key={deal.id}
                  deal={deal}
                  trailing={
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-danger">
                      {late} {late === 1 ? 'day' : 'days'} late
                    </span>
                  }
                />
              );
            })}
          </ListTile>

          {/* ── The money ────────────────────────────────────────── */}
          <MetricTile
            size="lg"
            accent="primary"
            loading={loading}
            className="col-span-2 sm:col-span-2"
            icon={<DollarSign className="size-4 shrink-0 text-primary" />}
            label="Pipeline value"
            value={loading ? '' : formatCurrency(view.stats.totalValue)}
            tooltip="Sum of the values of every job that isn't marked Lost. Won jobs are still included."
          />
          <MetricTile
            size="lg"
            accent="primary"
            loading={loading}
            className="col-span-2 sm:col-span-2"
            icon={<TrendingUp className="size-4 shrink-0 text-primary" />}
            label="Weighted value"
            value={loading ? '' : formatCurrency(view.stats.weightedValue)}
            tooltip="Expected revenue: each open job's value times its stage probability. First stage is about 10%, rising to 90%, final stage 100%."
          />

          {/* ── Payments due ─────────────────────────────────────── */}
          <ListTile
            className="col-span-2 sm:col-span-4 lg:col-span-4 lg:row-span-2"
            accent={loading || payments.length > 0 ? 'warning' : 'neutral'}
            icon={
              <Wallet
                className={cn(
                  'size-4 shrink-0',
                  loading || payments.length > 0 ? 'text-warning' : 'text-success',
                )}
              />
            }
            label="Payments due"
            count={loading ? null : payments.length}
            // Neutral ink here: the warning token is too light to carry
            // 10px text on any tint in Daylight (3.9:1). The urgency is
            // carried by the accent bar and the icon instead.
            countClass="bg-muted text-foreground"
            loading={loading}
            empty="Nothing outstanding."
          >
            {payments.slice(0, LIST_LIMIT).map((p) => (
              <JobRow
                key={p.deal.id}
                deal={p.deal}
                badge={<PaymentKindChip payment={p} />}
                trailing={
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(p.amount)}
                  </span>
                }
              />
            ))}
          </ListTile>

          {/* ── The counts ───────────────────────────────────────── */}
          <MetricTile
            size="md"
            accent="neutral"
            loading={loading}
            className="col-span-1"
            icon={<BarChart3 className="size-4 shrink-0 text-muted-foreground" />}
            label="Open jobs"
            value={loading ? '' : String(view.stats.totalCount)}
            tooltip="Every job that isn't marked Lost."
          />
          <MetricTile
            size="md"
            accent="neutral"
            loading={loading}
            className="col-span-1"
            icon={<Target className="size-4 shrink-0 text-muted-foreground" />}
            label="Avg job"
            value={loading ? '' : formatCurrency(view.stats.avgValue)}
            tooltip="Pipeline value divided by the number of jobs."
          />
          <MetricTile
            size="md"
            accent="primary"
            loading={loading}
            className="col-span-1"
            icon={<Trophy className="size-4 shrink-0 text-primary" />}
            label="Won"
            value={loading ? '' : String(view.stats.wonThisMonth)}
            tooltip="Jobs marked Won since the first of this month."
          />
          <MetricTile
            size="md"
            accent="danger"
            loading={loading}
            className="col-span-1"
            icon={<XCircle className="size-4 shrink-0 text-danger" />}
            label="Lost"
            value={loading ? '' : String(view.stats.lostThisMonth)}
            tooltip="Jobs marked Lost since the first of this month."
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ═══ Tiles ══════════════════════════════════════════════════════════ */

const LIST_ACCENT: Record<MetricAccent, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  primary: 'bg-primary',
  neutral: 'bg-border',
};

/**
 * A bento tile holding a short list of jobs.
 *
 * Deliberately not a link itself: the rows inside are links and nesting
 * anchors is invalid, so the header carries the "View all" link.
 *
 * The list is capped rather than scrolled. An internal scrollbar on a
 * dashboard hides exactly the rows that matter, and the page should be
 * one scroll surface.
 */
function ListTile({
  className,
  accent,
  icon,
  label,
  count,
  countClass,
  loading,
  empty,
  children,
}: {
  className?: string;
  accent: MetricAccent;
  icon: React.ReactNode;
  label: string;
  count: number | null;
  countClass: string;
  loading: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  const isEmpty = !loading && count === 0;
  const hidden = count !== null ? count - LIST_LIMIT : 0;

  return (
    <section
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5',
        className,
      )}
      aria-label={label}
    >
      {/* The nav's active dash, reused as the tile marker. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-5 left-0 w-[3px] rounded-r-full',
          LIST_ACCENT[accent],
        )}
      />

      <div className="mb-3 flex items-center gap-2 pl-3">
        {icon}
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </h2>
        {count !== null && count > 0 && (
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
              countClass,
            )}
          >
            {count}
          </span>
        )}
        <Link
          href="/pipelines"
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-primary transition-colors hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {hidden > 0 ? `View all ${count}` : 'Jobs'}
          <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="flex-1 pl-3">
        {loading ? (
          <div className="flex flex-col gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <div className="size-6 shrink-0 animate-pulse rounded bg-muted" />
                <div className="h-4 w-40 max-w-[50%] animate-pulse rounded bg-muted" />
                <div className="ml-auto h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex h-full min-h-24 flex-col items-center justify-center gap-2 py-6 text-center">
            <CheckCircle2 className="size-5 text-success" />
            <p className="text-sm text-muted-foreground">{empty}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">{children}</div>
        )}
      </div>
    </section>
  );
}

/** One job inside a list tile: make mark, vehicle, customer, figure. */
function JobRow({
  deal,
  badge,
  trailing,
}: {
  deal: Deal;
  badge?: React.ReactNode;
  trailing: React.ReactNode;
}) {
  const brand = brandForContact(deal.contact);
  const customer = deal.contact?.name || deal.contact?.phone || 'No customer';

  return (
    <Link
      href="/pipelines"
      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <BrandBadge brand={brand} height={24} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {vehicleName(deal)}
          </span>
          {badge}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{customer}</span>
      </span>
      {trailing}
    </Link>
  );
}

/**
 * Says which kind of money a row is, since the list mixes both.
 *
 * Same chip vocabulary as the sidebar's role chips (tint plus a hairline
 * border), but the text is `foreground` rather than the semantic hue:
 * warning ink on a warning tint is 3.9:1 in Daylight, under the floor
 * for 9px text. The tint and border carry the distinction instead.
 */
function PaymentKindChip({ payment }: { payment: OutstandingPayment }) {
  const isBalance = payment.kind === 'balance';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
        isBalance
          ? 'border-warning/40 bg-warning-soft text-foreground'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      {isBalance ? 'Balance' : 'Deposit'}
    </span>
  );
}
