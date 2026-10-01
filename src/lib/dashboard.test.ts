import { describe, expect, it } from 'vitest';

import type { Contact, Deal, PipelineStage } from '@/types';
import {
  bookedAt,
  completedAt,
  csvCell,
  dealsBookedIn,
  formatRange,
  jobsNeedingInfo,
  jobsToCsv,
  percentChange,
  resolvePeriod,
  revenueIn,
  revenueSeries,
  spanOf,
} from '@/lib/dashboard';

/**
 * Pins the dashboard's period maths. The failure modes worth guarding:
 * a job counted in the wrong window (or two windows), a "vs. last
 * period" percentage invented from a zero base, the revenue line not
 * ending on the headline figure, and an export that runs a customer's
 * text as a spreadsheet formula.
 */

/** Local wall-clock time, as the browser would read it. */
const at = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m - 1, d, h);
const NOW = at(2026, 10, 1, 15);

function contact(over: Partial<Contact> = {}): Contact {
  return {
    id: 'c1',
    user_id: 'u1',
    phone: '+971500000000',
    name: 'Sara',
    car_brand: 'Porsche',
    car_model: '911',
    plate_number: 'D 12345',
    service_types: ['Tinting'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function deal(over: Partial<Deal> & { id: string }): Deal {
  return {
    user_id: 'u1',
    pipeline_id: 'p1',
    stage_id: 's0',
    contact_id: 'c1',
    title: 'Job',
    value: 1000,
    created_at: at(2026, 9, 20).toISOString(),
    contact: contact(),
    ...over,
  } as Deal;
}

describe('resolvePeriod', () => {
  it('ends at tomorrow midnight so today is inside the window', () => {
    const { current, previous } = resolvePeriod('30d', NOW);
    expect(current!.end).toEqual(at(2026, 10, 2, 0));
    expect(current!.start).toEqual(at(2026, 9, 2, 0));
    // The previous window is the same length and ends where this starts.
    expect(previous!.end).toEqual(current!.start);
    expect(previous!.start).toEqual(at(2026, 8, 3, 0));
  });

  it('has nothing to compare against for "All time"', () => {
    expect(resolvePeriod('all', NOW)).toEqual({
      current: null,
      previous: null,
    });
  });

  it('labels the window with its first and last day', () => {
    const { current } = resolvePeriod('30d', NOW);
    expect(formatRange(current!)).toBe('Sep 2, 2026 – Oct 1, 2026');
  });
});

describe('bookedAt', () => {
  it('reads a date-only Entry Date as local midnight, not UTC', () => {
    const d = bookedAt(
      deal({
        id: 'a',
        start_date: '2026-09-14',
        created_at: '2026-09-20T08:00:00Z',
      })
    );
    expect(d).toEqual(at(2026, 9, 14, 0));
  });

  it('takes the Entry Date for jobs imported after the fact', () => {
    const d = bookedAt(
      deal({
        id: 'a',
        start_date: '2026-03-01',
        created_at: '2026-09-20T08:00:00Z',
      })
    );
    expect(d).toEqual(at(2026, 3, 1, 0));
  });

  it('takes the logged date when the car is booked in for the future', () => {
    const logged = at(2026, 9, 20);
    const d = bookedAt(
      deal({
        id: 'a',
        start_date: '2026-12-01',
        created_at: logged.toISOString(),
      })
    );
    expect(d).toEqual(logged);
  });

  it('survives a malformed date rather than throwing', () => {
    expect(bookedAt(deal({ id: 'a', start_date: 'not a date' }))).toEqual(
      at(2026, 9, 20)
    );
  });
});

describe('dealsBookedIn', () => {
  it('puts each job in exactly one of two adjacent windows', () => {
    const { current, previous } = resolvePeriod('7d', NOW);
    const boundary = deal({
      id: 'edge',
      created_at: current!.start.toISOString(),
    });
    const before = deal({
      id: 'before',
      created_at: new Date(current!.start.getTime() - 1).toISOString(),
    });

    expect(dealsBookedIn([boundary, before], current).map((d) => d.id)).toEqual(
      ['edge']
    );
    expect(
      dealsBookedIn([boundary, before], previous).map((d) => d.id)
    ).toEqual(['before']);
  });

  it('returns everything for "All time"', () => {
    const deals = [
      deal({ id: 'a' }),
      deal({ id: 'b', created_at: '2020-01-01T00:00:00Z' }),
    ];
    expect(dealsBookedIn(deals, null)).toHaveLength(2);
  });
});

describe('percentChange', () => {
  it('measures change against the previous figure', () => {
    expect(percentChange(115, 100)).toBeCloseTo(15);
    expect(percentChange(90, 100)).toBeCloseTo(-10);
  });

  it('refuses to invent a percentage from a zero base', () => {
    expect(percentChange(500, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
  });
});

describe('revenue', () => {
  const won = deal({
    id: 'won',
    status: 'won',
    value: 4000,
    updated_at: at(2026, 9, 25).toISOString(),
  });
  const collected = deal({
    id: 'col',
    value: 6000,
    collected_at: at(2026, 9, 28).toISOString(),
  });
  const open = deal({ id: 'open', value: 9999 });
  const lost = deal({
    id: 'lost',
    status: 'lost',
    value: 7777,
    collected_at: at(2026, 9, 28).toISOString(),
  });

  it('counts collected and won jobs, never open or lost ones', () => {
    expect(completedAt(open)).toBeNull();
    expect(completedAt(lost)).toBeNull();
    expect(revenueIn([won, collected, open, lost], null)).toBe(10_000);
  });

  it('dates a job by its collection, even if it was marked won later', () => {
    const both = deal({
      id: 'both',
      status: 'won',
      collected_at: at(2026, 9, 10).toISOString(),
      updated_at: at(2026, 9, 30).toISOString(),
    });
    expect(completedAt(both)).toEqual(at(2026, 9, 10));
  });

  it('builds a running total that ends on the headline figure', () => {
    const { current } = resolvePeriod('30d', NOW);
    const { points, granularity } = revenueSeries(
      [won, collected, open, lost],
      current,
      NOW
    );

    expect(granularity).toBe('day');
    expect(points).toHaveLength(30);
    expect(points.at(-1)!.total).toBe(
      revenueIn([won, collected, open, lost], current)
    );
    const sep25 = points.find((p) => p.label === 'Sep 25')!;
    expect(sep25.amount).toBe(4000);
    // Running total never goes down.
    for (let i = 1; i < points.length; i++) {
      expect(points[i].total).toBeGreaterThanOrEqual(points[i - 1].total);
    }
  });

  it('switches to weeks and months for longer windows', () => {
    expect(
      revenueSeries([won], resolvePeriod('90d', NOW).current, NOW).granularity
    ).toBe('week');
    expect(
      revenueSeries([won], resolvePeriod('12m', NOW).current, NOW).granularity
    ).toBe('month');
  });

  it('starts "All time" at the first month anything was earned', () => {
    const old = deal({
      id: 'old',
      collected_at: at(2026, 6, 15).toISOString(),
    });
    const { points } = revenueSeries([old, collected], null, NOW);
    expect(points[0].label).toBe('Jun 2026');
    expect(points.at(-1)!.total).toBe(7000);
  });

  it('returns no points when nothing has been earned', () => {
    expect(revenueSeries([open], null, NOW).points).toEqual([]);
  });
});

describe('spanOf', () => {
  it('runs from the first booking to today', () => {
    const span = spanOf(
      [deal({ id: 'a', start_date: '2026-02-03' }), deal({ id: 'b' })],
      NOW
    );
    expect(formatRange(span!)).toBe('Feb 3, 2026 – Oct 1, 2026');
  });

  it('is null with no jobs', () => {
    expect(spanOf([], NOW)).toBeNull();
  });
});

describe('jobsNeedingInfo', () => {
  it('flags only the details a job cannot run without', () => {
    const thin = deal({
      id: 'thin',
      // Email, VIN and year are missing too, but must not be listed.
      contact: contact({
        plate_number: null,
        service_types: [],
        car_brand: null,
        car_model: null,
      }),
    });
    const [row] = jobsNeedingInfo([thin]);
    expect(row.missing).toEqual(['Vehicle', 'Services', 'Plate']);
  });

  it('ignores jobs with a complete record, and finished jobs', () => {
    const gaps = contact({ plate_number: null });
    const deals = [
      deal({ id: 'complete' }),
      deal({ id: 'won', status: 'won', contact: gaps }),
      deal({ id: 'lost', status: 'lost', contact: gaps }),
      deal({
        id: 'collected',
        collected_at: at(2026, 9, 1).toISOString(),
        contact: gaps,
      }),
    ];
    expect(jobsNeedingInfo(deals)).toEqual([]);
  });

  it('flags a job whose customer was deleted', () => {
    const [row] = jobsNeedingInfo([
      deal({ id: 'orphan', contact_id: null, contact: undefined }),
    ]);
    expect(row.missing).toEqual(['Customer']);
  });

  it('lists the jobs missing the most first', () => {
    const one = deal({ id: 'one', contact: contact({ plate_number: null }) });
    const three = deal({
      id: 'three',
      contact: contact({
        plate_number: null,
        name: undefined,
        service_types: [],
      }),
    });
    expect(jobsNeedingInfo([one, three]).map((r) => r.deal.id)).toEqual([
      'three',
      'one',
    ]);
  });
});

describe('export', () => {
  it('neutralises text a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(
      `"'=HYPERLINK(""http://x"")"`
    );
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('-2+3')).toBe(`"'-2+3"`);
    expect(csvCell('+cmd|calc')).toBe(`"'+cmd|calc"`);
  });

  it('leaves phone numbers and plain numbers readable', () => {
    expect(csvCell('+971 50 123 4567')).toBe('"+971 50 123 4567"');
    expect(csvCell(-250)).toBe('"-250"');
    expect(csvCell(null)).toBe('""');
  });

  it('writes one row per job with stage names and bare numbers', () => {
    const stages: PipelineStage[] = [
      {
        id: 's0',
        pipeline_id: 'p1',
        name: 'Booked In',
        position: 0,
        color: '#000',
        created_at: '',
      },
    ];
    const csv = jobsToCsv(
      [
        deal({
          id: 'a',
          value: 27000,
          deposit_percentage: 30,
          deposit_paid: true,
          delivery_date: '2026-10-05',
        }),
      ],
      stages
    );
    expect(csv.startsWith('﻿')).toBe(true);
    const [header, row] = csv.slice(1).split('\r\n');
    expect(header).toContain('"Value (AED)"');
    expect(row).toBe(
      '"2026-09-20","Porsche 911","Sara","+971500000000","D 12345","Booked In","open","27000","30","Yes","2026-10-05",""'
    );
  });
});
