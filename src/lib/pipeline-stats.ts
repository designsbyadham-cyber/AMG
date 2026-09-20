import type { Deal, PipelineStage } from '@/types';
import { dueDate as getDueDate } from '@/lib/jobs';

/**
 * The pipeline numbers, computed once and shared.
 *
 * The Jobs screen and the dashboard show the same six figures, so they
 * read from here rather than each doing their own arithmetic — two
 * implementations of "pipeline value" is two chances to disagree, and a
 * dashboard that contradicts the page it links to is worse than no
 * dashboard.
 */

export interface PipelineStats {
  /** Deals that are not Lost. Won deals still count. */
  totalCount: number;
  totalValue: number;
  avgValue: number;
  /** Expected revenue: each open deal's value x its stage probability. */
  weightedValue: number;
  wonThisMonth: number;
  lostThisMonth: number;
}

/**
 * Value x probability, where probability rises with stage position:
 * first stage ~10%, interpolating to 90% just before the end, final
 * stage (Won) = 100%.
 */
function stageProbability(stage: PipelineStage, ordered: PipelineStage[]): number {
  const n = ordered.length;
  if (n <= 1) return 1;
  const index = ordered.findIndex((s) => s.id === stage.id);
  if (index < 0) return 0;
  if (index === n - 1) return 1;
  const slots = n - 1;
  if (slots <= 1) return 0.1;
  return 0.1 + (index / (slots - 1)) * 0.8;
}

export function computePipelineStats(
  deals: Deal[],
  stages: PipelineStage[],
): PipelineStats {
  const active = deals.filter((d) => d.status !== 'lost');
  const open = active.filter((d) => d.status !== 'won');

  const totalCount = active.length;
  const totalValue = active.reduce((sum, d) => sum + Number(d.value || 0), 0);

  // Probability is relative to a deal's *own* pipeline. Ranking a stage
  // against a merged list would distort every figure the moment a
  // second pipeline exists.
  const byPipeline = new Map<string, PipelineStage[]>();
  for (const s of stages) {
    const list = byPipeline.get(s.pipeline_id) ?? [];
    list.push(s);
    byPipeline.set(s.pipeline_id, list);
  }
  for (const list of byPipeline.values()) list.sort((a, b) => a.position - b.position);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const weightedValue = open.reduce((sum, d) => {
    const stage = stageById.get(d.stage_id);
    if (!stage) return sum;
    const ordered = byPipeline.get(stage.pipeline_id) ?? [];
    return sum + Number(d.value || 0) * stageProbability(stage, ordered);
  }, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = (d: Deal) => {
    const ts = d.updated_at ?? d.created_at;
    return ts ? new Date(ts) >= monthStart : false;
  };

  return {
    totalCount,
    totalValue,
    avgValue: totalCount > 0 ? totalValue / totalCount : 0,
    weightedValue,
    wonThisMonth: deals.filter((d) => d.status === 'won' && thisMonth(d)).length,
    lostThisMonth: deals.filter((d) => d.status === 'lost' && thisMonth(d)).length,
  };
}

/** Whole days a job is past its due date. Never negative. */
export function daysOverdue(deal: Deal, now = new Date()): number {
  const due = getDueDate(deal);
  if (!due) return 0;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return 0;
  d.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86_400_000));
}

/** Open jobs past their due date, worst first. */
export function overdueJobs(deals: Deal[], now = new Date()): Deal[] {
  return deals
    .filter((d) => d.status !== 'won' && d.status !== 'lost' && daysOverdue(d, now) > 0)
    .sort((a, b) => daysOverdue(b, now) - daysOverdue(a, now));
}

export type PaymentKind = 'deposit' | 'balance';

export interface OutstandingPayment {
  deal: Deal;
  kind: PaymentKind;
  /** What the customer still owes, in full. */
  amount: number;
}

/** The deposit a job was quoted, whether or not it was collected. */
function depositAmount(deal: Deal): number {
  return (Number(deal.value || 0) * (deal.deposit_percentage ?? 0)) / 100;
}

/**
 * True once the work itself is finished — the last stage of the deal's
 * own pipeline, or the one before it.
 *
 * Keyed on stage *position*, not the literal name "Collected", because
 * stage names are user-editable in pipeline settings and this should
 * survive a rename.
 */
function isFinished(deal: Deal, byPipeline: Map<string, PipelineStage[]>): boolean {
  for (const ordered of byPipeline.values()) {
    const index = ordered.findIndex((s) => s.id === deal.stage_id);
    if (index < 0) continue;
    return index >= ordered.length - 2;
  }
  return false;
}

/**
 * Money that is genuinely late, of two kinds:
 *
 *  - `balance` — the car is finished and still in the shop, and the
 *    full balance is outstanding. This is the alarming one.
 *  - `deposit` — a live job that was booked without ever taking the
 *    deposit.
 *
 * A job mid-build is *supposed* to have a balance outstanding, so those
 * are deliberately excluded: listing them would bury the rows where
 * money is actually overdue.
 *
 * `collected_at` is what marks a balance settled. The schema has
 * `deposit_paid` but no `balance_paid`, and `collected_at` is stamped
 * when a job reaches the final stage (see pipelines/page.tsx), so
 * "finished but not yet handed over" is the only bounded definition
 * available without a migration. A deal that qualifies as both kinds
 * appears once, as `balance` — which already contains the unpaid
 * deposit.
 */
export function paymentsDue(
  deals: Deal[],
  stages: PipelineStage[],
): OutstandingPayment[] {
  const byPipeline = new Map<string, PipelineStage[]>();
  for (const s of stages) {
    const list = byPipeline.get(s.pipeline_id) ?? [];
    list.push(s);
    byPipeline.set(s.pipeline_id, list);
  }
  for (const list of byPipeline.values()) list.sort((a, b) => a.position - b.position);

  const out: OutstandingPayment[] = [];

  for (const deal of deals) {
    if (deal.status === 'lost') continue;

    // A finished job is judged on its balance and nothing else. It must
    // not fall through to the deposit check below: a car that has been
    // collected is settled, and reporting its old unpaid deposit would
    // put a closed job back on the dashboard forever.
    if (isFinished(deal, byPipeline)) {
      if (deal.collected_at) continue;
      const amount =
        Number(deal.value || 0) - (deal.deposit_paid ? depositAmount(deal) : 0);
      if (amount > 0) out.push({ deal, kind: 'balance', amount });
      continue;
    }

    if (deal.status !== 'won' && !deal.deposit_paid) {
      const amount = depositAmount(deal);
      if (amount > 0) out.push({ deal, kind: 'deposit', amount });
    }
  }

  return out.sort((a, b) => b.amount - a.amount);
}
