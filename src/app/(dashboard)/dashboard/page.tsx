"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  MessageSquare,
  Wrench,
  CheckCircle2,
  CalendarCheck,
  ClipboardCheck,
  ExternalLink,
} from 'lucide-react'

import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadPipelineDonut,
  loadQualityCheckDue,
  loadResponseTime,
} from '@/lib/dashboard/queries'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PipelineDonutData,
  QualityCheckDueItem,
  ResponseTimeSummary,
} from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

type RangeDays = 7 | 30 | 90

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [qcDue, setQcDue] = useState<QualityCheckDueItem[] | null>(null)
  const [qcLoading, setQcLoading] = useState(true)

  const [range, setRange] = useState<RangeDays>(30)
  const [series, setSeries] = useState<Record<RangeDays, ConversationsSeriesPoint[] | null>>({
    7: null,
    30: null,
    90: null,
  })
  const [seriesLoading, setSeriesLoading] = useState(true)

  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [responseTimeLoading, setResponseTimeLoading] = useState(true)

  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  const loadAll = useCallback(() => {
    const db = createClient()

    void loadMetrics(db)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false))

    void loadQualityCheckDue(db)
      .then((q) => setQcDue(q))
      .catch((err) => console.error('[dashboard] qc failed:', err))
      .finally(() => setQcLoading(false))

    void loadConversationsSeries(db, 30)
      .then((s) => setSeries((prev) => ({ ...prev, 30: s })))
      .catch((err) => console.error('[dashboard] series failed:', err))
      .finally(() => setSeriesLoading(false))

    void loadPipelineDonut(db)
      .then((p) => setPipeline(p))
      .catch((err) => console.error('[dashboard] pipeline failed:', err))
      .finally(() => setPipelineLoading(false))

    void loadResponseTime(db)
      .then((r) => setResponseTime(r))
      .catch((err) => console.error('[dashboard] response time failed:', err))
      .finally(() => setResponseTimeLoading(false))

    void loadActivity(db, 50)
      .then((a) => setActivity(a))
      .catch((err) => console.error('[dashboard] activity failed:', err))
      .finally(() => setActivityLoading(false))
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleRangeChange = useCallback(
    (r: RangeDays) => {
      setRange(r)
      if (series[r] !== null) return
      setSeriesLoading(true)
      const db = createClient()
      loadConversationsSeries(db, r)
        .then((s) => setSeries((prev) => ({ ...prev, [r]: s })))
        .catch((err) => console.error('[dashboard] series failed:', err))
        .finally(() => setSeriesLoading(false))
    },
    [series],
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live overview of AMG Operations — messages, jobs, and quality checks.
        </p>
      </div>

      {/* AMG Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title="Unanswered Messages"
              value={metrics.unansweredMessages.toLocaleString()}
              icon={MessageSquare}
              subtitle="Open conversations with unread messages"
            />
            <MetricCard
              title="Jobs Booked Today"
              value={metrics.jobsBookedToday.toLocaleString()}
              icon={CalendarCheck}
              subtitle="New service jobs created today"
            />
            <MetricCard
              title="In Workshop"
              value={metrics.inWorkshop.toLocaleString()}
              icon={Wrench}
              subtitle="Jobs currently in progress"
            />
            <MetricCard
              title="Cars Ready"
              value={metrics.carsReady.toLocaleString()}
              icon={CheckCircle2}
              subtitle="Completed jobs awaiting collection"
            />
          </>
        )}
      </div>

      {/* Quality Check Due section */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <ClipboardCheck className="size-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground">
            Quality Check Due
          </h2>
          <span className="ml-auto text-xs text-muted-foreground">10 days post-collection</span>
        </div>

        {qcLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !qcDue || qcDue.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <CheckCircle2 className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No quality checks due today.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {qcDue.map((item) => {
              const vehicle = [item.carBrand, item.carModel].filter(Boolean).join(' ') || null
              const daysAgo = Math.floor(
                (Date.now() - new Date(item.collectedAt).getTime()) / (1000 * 60 * 60 * 24),
              )
              return (
                <div key={item.dealId} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.contactName || item.contactPhone || 'Unknown customer'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[vehicle, item.plateNumber].filter(Boolean).join(' · ') || 'No vehicle info'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">Collected {daysAgo}d ago</p>
                  </div>
                  {item.conversationId && (
                    <Link
                      href={`/inbox?c=${item.conversationId}`}
                      className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      <ExternalLink className="size-3" />
                      Message
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <QuickActions />

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="h-full lg:col-span-3">
          <ConversationsChart
            series={series}
            loading={seriesLoading}
            range={range}
            onRangeChange={handleRangeChange}
          />
        </div>
        <div className="h-full lg:col-span-2">
          <PipelineDonut data={pipeline} loading={pipelineLoading} />
        </div>
      </div>

      {/* Response time */}
      <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />

      {/* Activity feed */}
      <ActivityFeed items={activity} loading={activityLoading} />
    </div>
  )
}
