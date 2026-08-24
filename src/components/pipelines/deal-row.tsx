"use client";

import type { ReactNode } from "react";
import type { Deal, PipelineStage } from "@/types";
import { JobCardBody } from "./job-card-body";

interface DealRowProps {
  deal: Deal;
  stage: PipelineStage | null;
  stages: PipelineStage[];
  onOpen: (deal: Deal) => void;
  /**
   * Grip element wired to the drag listeners. Kept as a dedicated handle
   * (rather than making the whole row draggable) so touch users can still
   * scroll the list vertically by swiping the row body.
   */
  dragHandle?: ReactNode;
  /** True while this row is the one being dragged. */
  isDragging?: boolean;
}

/**
 * A job in the vertical log. Nothing but a shell around `JobCardBody`,
 * which the Kanban card also uses — that is what keeps the two views
 * from drifting apart.
 */
export function DealRow({
  deal,
  stage,
  stages,
  onOpen,
  dragHandle,
  isDragging,
}: DealRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(deal)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(deal);
        }
      }}
      className={`group relative w-full cursor-pointer rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/20 sm:p-5 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {/* Grip floats top-centre so it never competes with the chips. */}
      {dragHandle && (
        <div className="absolute left-1/2 top-1 z-10 -translate-x-1/2">{dragHandle}</div>
      )}

      <JobCardBody deal={deal} stage={stage} stages={stages} />
    </div>
  );
}
