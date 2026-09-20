"use client";

import type { Deal, PipelineStage } from "@/types";
import {
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  Trophy,
  XCircle,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MetricTile } from "@/components/ui/metric-tile";
import { computePipelineStats } from "@/lib/pipeline-stats";
import { formatCurrency } from "@/lib/jobs";

interface PipelineAnalyticsProps {
  stages: PipelineStage[];
  deals: Deal[];
}

/**
 * The six pipeline figures.
 *
 * The arithmetic lives in `@/lib/pipeline-stats` and the tile lives in
 * `@/components/ui/metric-tile`, both shared with the dashboard — a
 * dashboard that contradicts the page it links to is worse than no
 * dashboard. This component is now just the selection of which six
 * figures Jobs shows, and their copy.
 */
export function PipelineAnalytics({ stages, deals }: PipelineAnalyticsProps) {
  const stats = computePipelineStats(deals, stages);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card/60 p-4 sm:grid-cols-3 xl:grid-cols-6">
        <MetricTile
          icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
          label="Total Deals"
          value={String(stats.totalCount)}
          tooltip="Count of every deal in this pipeline that isn't marked as Lost. Won deals are still included."
        />
        <MetricTile
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          label="Pipeline Value"
          value={formatCurrency(stats.totalValue)}
          tooltip="Sum of the values of all deals in this pipeline, excluding deals marked as Lost."
        />
        <MetricTile
          icon={<Target className="h-4 w-4 text-muted-foreground" />}
          label="Avg Deal Size"
          value={formatCurrency(stats.avgValue)}
          tooltip="Pipeline Value divided by Total Deals — the average value of a single non-lost deal."
        />
        <MetricTile
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          label="Weighted Value"
          value={formatCurrency(stats.weightedValue)}
          tooltip="Expected revenue: each open deal's value × its stage probability. First stage ≈ 10%, stages progress up to 90%, Won = 100%. Lost deals are excluded."
        />
        <MetricTile
          icon={<Trophy className="h-4 w-4 text-primary" />}
          label="Won This Month"
          value={String(stats.wonThisMonth)}
          tooltip="Deals marked as Won since the first day of the current month."
        />
        <MetricTile
          icon={<XCircle className="h-4 w-4 text-danger" />}
          label="Lost This Month"
          value={String(stats.lostThisMonth)}
          tooltip="Deals marked as Lost since the first day of the current month."
        />
      </div>
    </TooltipProvider>
  );
}
