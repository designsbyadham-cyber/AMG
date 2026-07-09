'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Contact, Deal } from '@/types';
import { LEAD_STATUS_META } from '@/lib/lead-status';
import { getContactStatus, relativeDay, daysAgo } from '@/lib/call-log';
import { MetricCard } from '@/components/dashboard/metric-card';
import { SkeletonCard } from '@/components/dashboard/skeleton';
import {
  Users,
  PhoneOff,
  CalendarClock,
  PhoneCall,
  Briefcase,
  DollarSign,
  Flame,
  ArrowRight,
  Clock,
} from 'lucide-react';

type DashDeal = Pick<Deal, 'id' | 'value' | 'status'>;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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
    const pipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

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
      pipelineValue,
      followUps,
      toContact,
    };
  }, [contacts, deals]);

  const loading = stats === null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live snapshot of AMG Operations.
        </p>
      </div>

      {/* Primary metrics — customers + call buckets */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <Link href="/contacts" className="block">
              <MetricCard
                title="Total Customers"
                value={stats.total.toLocaleString()}
                icon={Users}
                subtitle="Everyone in your list"
              />
            </Link>
            <Link href="/call-log" className="block">
              <MetricCard
                title="To Contact"
                value={stats.byStatus.not_contacted.toLocaleString()}
                icon={PhoneOff}
                subtitle="Not reached out yet"
              />
            </Link>
            <Link href="/call-log" className="block">
              <MetricCard
                title="Follow-ups"
                value={stats.byStatus.follow_up.toLocaleString()}
                icon={CalendarClock}
                subtitle="Awaiting a callback"
              />
            </Link>
            <Link href="/call-log" className="block">
              <MetricCard
                title="Contacted"
                value={stats.byStatus.contacted.toLocaleString()}
                icon={PhoneCall}
                subtitle="Reached by call or message"
              />
            </Link>
          </>
        )}
      </div>

      {/* Secondary metrics — jobs + leads */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <Link href="/pipelines" className="block">
              <MetricCard
                title="Open Jobs"
                value={stats.openJobs.toLocaleString()}
                icon={Briefcase}
                subtitle="Active in the pipeline"
              />
            </Link>
            <Link href="/pipelines" className="block">
              <MetricCard
                title="Pipeline Value"
                value={formatCurrency(stats.pipelineValue)}
                icon={DollarSign}
                subtitle="Open job value"
              />
            </Link>
            {/* Leads breakdown */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-muted-foreground">Leads</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Flame className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {(['hot', 'warm', 'cold'] as const).map((k) => (
                  <div
                    key={k}
                    className={`flex-1 rounded-lg px-2 py-2 text-center ${LEAD_STATUS_META[k].badge}`}
                  >
                    <p className="text-lg font-bold tabular-nums leading-none">
                      {stats.leads[k]}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide">
                      {LEAD_STATUS_META[k].label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Actionable lists — follow-ups due + next to contact */}
      {!loading && (stats.followUps.length > 0 || stats.toContact.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AttentionList
            title="Follow-ups due"
            icon={<CalendarClock className="size-4 text-blue-500" />}
            empty="No follow-ups scheduled."
            rows={stats.followUps.map((c) => ({
              id: c.id,
              primary: c.name || c.phone,
              secondary: [c.car_brand, c.car_model].filter(Boolean).join(' ') || c.phone,
              meta: c.next_follow_up_at ? relativeDay(c.next_follow_up_at) : null,
            }))}
          />
          <AttentionList
            title="Next to contact"
            icon={<Clock className="size-4 text-amber-500" />}
            empty="Everyone has been reached."
            rows={stats.toContact.map((c) => ({
              id: c.id,
              primary: c.name || c.phone,
              secondary: [c.car_brand, c.car_model].filter(Boolean).join(' ') || c.phone,
              meta: { label: `Added ${daysAgo(c.created_at)}`, overdue: false },
            }))}
          />
        </div>
      )}
    </div>
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
  icon,
  empty,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  rows: AttentionRow[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        {icon}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Link
          href="/call-log"
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Call Log
          <ArrowRight className="size-3" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <Link
              key={r.id}
              href="/call-log"
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{r.primary}</p>
                <p className="truncate text-xs text-muted-foreground">{r.secondary}</p>
              </div>
              {r.meta && (
                <span
                  className={`shrink-0 text-xs font-medium ${r.meta.overdue ? 'text-red-400' : 'text-muted-foreground'}`}
                >
                  {r.meta.label}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
