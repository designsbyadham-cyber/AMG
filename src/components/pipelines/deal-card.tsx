"use client";

import type { Deal, PipelineStage } from "@/types";
import { JobCardBody } from "./job-card-body";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  stages: PipelineStage[];
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

/**
 * A job on the Kanban board. Same body as the log row, in its compact
 * treatment for a ~300px column.
 */
export function DealCard({ deal, stage, stages, onEdit, isOverlay }: DealCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!isOverlay) onEdit(deal);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!isOverlay) onEdit(deal);
        }
      }}
      className={`group relative flex w-full cursor-pointer flex-col rounded-2xl border border-border bg-card p-4 text-left transition-colors ${
        isOverlay ? "shadow-lg" : "hover:border-foreground/20"
      }`}
    >
      <JobCardBody deal={deal} stage={stage} stages={stages} compact />
    </div>
  );
}
