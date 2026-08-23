'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Contact, Deal } from '@/types';
import { getContactStatus, relativeDay, daysAgo } from '@/lib/call-log';
import { ArrowRight } from 'lucide-react';

type DashDeal = Pick<Deal, 'id' | 'value' | 'status'>;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function DashboardPage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [deals, setDeals] = useState<DashDeal[] | null>(null);

  const load = useCallback(async () => {
    const db = createClient();
    const [contactsRes, dealsRes] = await Promise.all([
      db.from('contacts').select('*').order('created_at', { ascending: true }),
      db.from('deals').select('id, value, status'),
    ]);
    setContacts((contactsRes.data ?? []) as Contact[]);
    setDeals((dealsRes.data ?? []) as DashDeal[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const stats = useMemo(() => {
    if (!contacts || !deals) return null;
    const byStatus = { not_contacted: 0, follow_up: 0, contacted: 0 };
    const leads = { hot: 0, warm: 0, cold: 0 };
    for (const c of contacts) {
      byStatus[getContactStatus(c)]++;
      if (c.lead_status) leads[c.lead_status]++;
    }
    const openDeals = deals.filter((d) => d.status !== 'won' && d.status !== 'lost');

    const followUps = contacts
      .filter((c) => getContactStatus(c) === 'follow_up')
      .sort((a, b) =>
        (a.next_follow_up_at ?? '9999-12-31').localeCompare(b.next_follow_up_at ?? '9999-12-31'),
      )
      .slice(0, 6);
    const toContact = contacts
      .filter((c) => getContactStatus(c) === 'not_contacted')
      .slice(0, 6);

    return {
      total: contacts.length,
      byStatus,
      leads,
      openJobs: openDeals.length,
      pipelineValue: openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0),
      followUps,
      toContact,
    };
  }, [contacts, deals]);

  const loading = stats === null;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where AMG Operations stands right now.
        </p>
      </header>

      {/* The four numbers worth acting on, as one quiet band rather than
          four competing cards. */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          <Figure
            label="To contact"
            value={loading ? null : stats.byStatus.not_contacted.toLocaleString()}
            href="/call-log"
          />
          <Figure
            label="Follow-ups"
            value={loading ? null : stats.byStatus.follow_up.toLocaleString()}
            href="/call-log"
          />
          <Figure
            label="Open jobs"
            value={loading ? null : stats.openJobs.toLocaleString()}
            href="/pipelines"
          />
          <Figure
            label="Pipeline value"
            value={loading ? null : formatCurrency(stats.pipelineValue)}
            href="/pipelines"
          />
        </dl>
      </section>

      {/* The work itself. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AttentionList
          title="Follow-ups due"
          empty="No follow-ups scheduled."
          loading={loading}
          rows={(stats?.followUps ?? []).map((c) => ({
            id: c.id,
            primary: c.name || c.phone,
            secondary: [c.car_brand, c.car_model].filter(Boolean).join(' ') || c.phone,
            meta: c.next_follow_up_at ? relativeDay(c.next_follow_up_at) : null,
          }))}
        />
        <AttentionList
          title="Next to contact"
          empty="Everyone has been reached."
          loading={loading}
          rows={(stats?.toContact ?? []).map((c) => ({
            id: c.id,
            primary: c.name || c.phone,
            secondary: [c.car_brand, c.car_model].filter(Boolean).join(' ') || c.phone,
            meta: { label: `Added ${daysAgo(c.created_at)}`, overdue: false },
          }))}
        />
      </div>

      {/* Standing totals: true, but rarely acted on — so they sit last
          and quiet instead of taking a card each. */}
      {!loading && (
        <p className="text-sm text-muted-foreground">
          <Link href="/contacts" className="font-medium text-foreground hover:underline">
            {stats.total.toLocaleString()} customers
          </Link>
          {' · '}
          {stats.leads.hot} hot · {stats.leads.warm} warm · {stats.leads.cold} cold
          {' · '}
          {stats.byStatus.contacted.toLocaleString()} already contacted
        </p>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="border-b border-border px-5 py-4 transition-colors hover:bg-muted/50 [&:nth-child(-n+2)]:border-b sm:border-b-0 sm:border-r sm:last:border-r-0"
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
        {value ?? <span className="inline-block h-7 w-16 animate-pulse rounded bg-muted" />}
      </dd>
    </Link>
  );
}

interface AttentionRow {
  id: string;
  primary: string;
  secondary: string;
  meta: { label: string; overdue: boolean } | null;
}

function AttentionList({
  title,
  empty,
  rows,
  loading,
}: {
  title: string;
  empty: string;
  rows: AttentionRow[];
  loading: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Link
          href="/call-log"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Call log
          <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-3 w-12 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <Link
                key={r.id}
                href="/call-log"
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.primary}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.secondary}</p>
                </div>
                {r.meta && (
                  <span
                    className={`shrink-0 text-xs font-medium tabular-nums ${
                      r.meta.overdue ? 'text-danger' : 'text-muted-foreground'
                    }`}
                  >
                    {r.meta.label}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
