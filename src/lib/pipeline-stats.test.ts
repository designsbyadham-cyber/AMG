import { describe, expect, it } from 'vitest';

import type { Deal, PipelineStage } from '@/types';
import { formatCurrency } from '@/lib/jobs';
import {
  computePipelineStats,
  daysOverdue,
  overdueJobs,
  paymentsDue,
} from '@/lib/pipeline-stats';

/**
 * These pin the two things the dashboard rewrite depends on:
 *
 *  1. `computePipelineStats` reproduces the numbers the Jobs metrics
 *     band used to compute privately, so lifting the maths out did not
 *     change what anyone sees.
 *  2. `paymentsDue` only ever lists money that is genuinely late. Its
 *     failure mode is listing every job mid-build, which would bury the
 *     rows that matter.
 */

const ISO = (d: string) => new Date(d).toISOString();

function stage(
  id: string,
  position: number,
  pipeline_id = 'p1',
): PipelineStage {
  return {
    id,
    pipeline_id,
    name: `Stage ${position}`,
    position,
    color: '#000000',
    created_at: ISO('2025-01-01'),
  };
}

function deal(over: Partial<Deal> & { id: string; stage_id: string }): Deal {
  return {
    user_id: 'u1',
    pipeline_id: 'p1',
    contact_id: 'c1',
    title: 'Job',
    value: 1000,
    created_at: ISO('2025-01-01'),
    ...over,
  } as Deal;
}

/** A 5-stage pipeline: positions 0..4, so "finished" is 3 or 4. */
const STAGES = [stage('s0', 0), stage('s1', 1), stage('s2', 2), stage('s3', 3), stage('s4', 4)];

describe('computePipelineStats', () => {
  it('counts and sums everything that is not lost', () => {
    const deals = [
      deal({ id: 'a', stage_id: 's0', value: 1000 }),
      deal({ id: 'b', stage_id: 's2', value: 3000 }),
      deal({ id: 'c', stage_id: 's4', value: 5000, status: 'won' }),
      deal({ id: 'd', stage_id: 's1', value: 9999, status: 'lost' }),
    ];
    const s = computePipelineStats(deals, STAGES);

    expect(s.totalCount).toBe(3);
    expect(s.totalValue).toBe(9000);
    expect(s.avgValue).toBe(3000);
  });

  it('weights open deals by stage position, and excludes won and lost', () => {
    // 5 stages: index 0 -> 0.10, index 2 -> 0.10 + (2/3)*0.8 = 0.6333…,
    // final index -> 1.0 but won deals are not "open" so drop out.
    const deals = [
      deal({ id: 'a', stage_id: 's0', value: 1000 }),
      deal({ id: 'b', stage_id: 's2', value: 3000 }),
      deal({ id: 'c', stage_id: 's4', value: 5000, status: 'won' }),
      deal({ id: 'd', stage_id: 's1', value: 9999, status: 'lost' }),
    ];
    const s = computePipelineStats(deals, STAGES);

    const expected = 1000 * 0.1 + 3000 * (0.1 + (2 / 3) * 0.8);
    expect(s.weightedValue).toBeCloseTo(expected, 6);
  });

  it('ranks a stage against its own pipeline, not a merged list', () => {
    // Two 2-stage pipelines. Merged and sorted by position they would
    // interleave and the first stage of pipeline 2 would be scored as
    // though it were late in a 4-stage run. Grouped correctly, a
    // 2-stage pipeline's first stage is 0.1 and its last is 1.0.
    const stages = [
      stage('a0', 0, 'p1'),
      stage('a1', 1, 'p1'),
      stage('b0', 0, 'p2'),
      stage('b1', 1, 'p2'),
    ];
    const deals = [
      deal({ id: 'x', pipeline_id: 'p1', stage_id: 'a0', value: 1000 }),
      deal({ id: 'y', pipeline_id: 'p2', stage_id: 'b0', value: 1000 }),
    ];

    const s = computePipelineStats(deals, stages);
    expect(s.weightedValue).toBeCloseTo(200, 6);
  });

  it('returns zeroes rather than NaN when there are no deals', () => {
    const s = computePipelineStats([], STAGES);
    expect(s).toEqual({
      totalCount: 0,
      totalValue: 0,
      avgValue: 0,
      weightedValue: 0,
      wonThisMonth: 0,
      lostThisMonth: 0,
    });
  });

  it('counts won and lost only within the current month', () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 2).toISOString();
    const lastYear = ISO('2020-03-05');

    const deals = [
      deal({ id: 'a', stage_id: 's4', status: 'won', updated_at: thisMonth }),
      deal({ id: 'b', stage_id: 's4', status: 'won', updated_at: lastYear }),
      deal({ id: 'c', stage_id: 's1', status: 'lost', updated_at: thisMonth }),
    ];
    const s = computePipelineStats(deals, STAGES);

    expect(s.wonThisMonth).toBe(1);
    expect(s.lostThisMonth).toBe(1);
  });
});

describe('daysOverdue / overdueJobs', () => {
  const now = new Date('2025-06-10T12:00:00Z');

  it('counts whole days past the due date and never goes negative', () => {
    expect(daysOverdue(deal({ id: 'a', stage_id: 's1', delivery_date: '2025-06-04' }), now)).toBe(6);
    expect(daysOverdue(deal({ id: 'b', stage_id: 's1', delivery_date: '2025-06-20' }), now)).toBe(0);
    expect(daysOverdue(deal({ id: 'c', stage_id: 's1' }), now)).toBe(0);
  });

  it('prefers the delivery date over the expected close date', () => {
    const d = deal({
      id: 'a',
      stage_id: 's1',
      delivery_date: '2025-06-08',
      expected_close_date: '2025-01-01',
    });
    expect(daysOverdue(d, now)).toBe(2);
  });

  it('lists only open jobs, worst first', () => {
    const deals = [
      deal({ id: 'mild', stage_id: 's1', delivery_date: '2025-06-09' }),
      deal({ id: 'bad', stage_id: 's1', delivery_date: '2025-06-01' }),
      deal({ id: 'won', stage_id: 's4', delivery_date: '2025-01-01', status: 'won' }),
      deal({ id: 'lost', stage_id: 's1', delivery_date: '2025-01-01', status: 'lost' }),
      deal({ id: 'future', stage_id: 's1', delivery_date: '2025-12-01' }),
    ];

    expect(overdueJobs(deals, now).map((d) => d.id)).toEqual(['bad', 'mild']);
  });
});

describe('paymentsDue', () => {
  it('lists a finished job that has not been handed over as a balance', () => {
    const deals = [
      deal({ id: 'ready', stage_id: 's3', value: 10_000, deposit_percentage: 30, deposit_paid: true }),
    ];
    const [row] = paymentsDue(deals, STAGES);

    expect(row.kind).toBe('balance');
    expect(row.amount).toBe(7000);
  });

  it('charges the whole value when the deposit was never taken', () => {
    const deals = [
      deal({ id: 'ready', stage_id: 's3', value: 10_000, deposit_percentage: 30, deposit_paid: false }),
    ];
    const rows = paymentsDue(deals, STAGES);

    // Qualifies as both kinds; emitted once, as the balance, which
    // already contains the unpaid deposit.
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('balance');
    expect(rows[0].amount).toBe(10_000);
  });

  it('drops a job once the car has been collected', () => {
    const deals = [
      deal({
        id: 'gone',
        stage_id: 's4',
        value: 10_000,
        deposit_percentage: 30,
        collected_at: ISO('2025-06-01'),
      }),
    ];
    expect(paymentsDue(deals, STAGES)).toEqual([]);
  });

  it('lists a live job whose deposit was never collected', () => {
    const deals = [
      deal({ id: 'booked', stage_id: 's1', value: 10_000, deposit_percentage: 25 }),
    ];
    const [row] = paymentsDue(deals, STAGES);

    expect(row.kind).toBe('deposit');
    expect(row.amount).toBe(2500);
  });

  it('ignores a job mid-build whose deposit is already paid', () => {
    const deals = [
      deal({ id: 'building', stage_id: 's1', value: 10_000, deposit_percentage: 25, deposit_paid: true }),
    ];
    expect(paymentsDue(deals, STAGES)).toEqual([]);
  });

  it('ignores lost jobs and jobs with no deposit percentage', () => {
    const deals = [
      deal({ id: 'lost', stage_id: 's1', value: 10_000, deposit_percentage: 50, status: 'lost' }),
      deal({ id: 'nopct', stage_id: 's1', value: 10_000 }),
    ];
    expect(paymentsDue(deals, STAGES)).toEqual([]);
  });

  it('sorts by amount, largest first', () => {
    const deals = [
      deal({ id: 'small', stage_id: 's1', value: 1000, deposit_percentage: 50 }),
      deal({ id: 'big', stage_id: 's3', value: 20_000, deposit_percentage: 10, deposit_paid: true }),
      deal({ id: 'mid', stage_id: 's0', value: 8000, deposit_percentage: 50 }),
    ];
    expect(paymentsDue(deals, STAGES).map((p) => p.deal.id)).toEqual(['big', 'mid', 'small']);
  });

  it('measures "finished" against the deal\'s own pipeline', () => {
    // p2 only has two stages, so its stage 0 is already "finished".
    const stages = [
      stage('a0', 0, 'p1'),
      stage('a1', 1, 'p1'),
      stage('a2', 2, 'p1'),
      stage('b0', 0, 'p2'),
      stage('b1', 1, 'p2'),
    ];
    const deals = [
      deal({ id: 'short', pipeline_id: 'p2', stage_id: 'b0', value: 5000, deposit_percentage: 20, deposit_paid: true }),
    ];
    const [row] = paymentsDue(deals, stages);

    expect(row.kind).toBe('balance');
    expect(row.amount).toBe(4000);
  });
});

describe('formatCurrency', () => {
  it('always renders dirhams and never dollars', () => {
    const out = formatCurrency(27_000);
    expect(out).toContain('AED');
    expect(out).not.toContain('$');
    expect(out).toContain('27,000');
  });

  it('treats a missing value as zero rather than NaN', () => {
    expect(formatCurrency(undefined as unknown as number)).toContain('0');
  });
});
