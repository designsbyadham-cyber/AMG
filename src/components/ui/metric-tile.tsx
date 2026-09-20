"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * A single figure with its label — the Jobs metrics band's tile, lifted
 * out so the dashboard renders the identical thing rather than a
 * lookalike. Paired with `computePipelineStats`, that makes it
 * structurally impossible for the two screens to disagree about either
 * the number or the way it looks.
 *
 * Defaults reproduce the Jobs band exactly: no accent bar, `sm` size,
 * `bg-muted/50` chip. The dashboard opts into `accent` and `lg`.
 */

export type MetricAccent = "primary" | "danger" | "warning" | "neutral";

const ACCENT_BAR: Record<MetricAccent, string> = {
  primary: "bg-primary",
  danger: "bg-danger",
  warning: "bg-warning",
  neutral: "bg-border",
};

interface MetricTileProps {
  icon?: ReactNode;
  label: string;
  value: string;
  tooltip?: string;
  /**
   * Draws the nav's accent dash on the left edge. Off by default so the
   * Jobs band stays exactly as it was.
   */
  accent?: MetricAccent;
  /**
   * `sm` is the Jobs band's chip. `md` and `lg` are the dashboard's
   * bento treatments, both on the job-card shell.
   *
   * `md` exists because the narrow bento tiles are one sixth of a
   * 1152px grid — about 120px of content width once padding is off —
   * and a currency figure like "AED 3,000" set at `lg` overflows that.
   * Size follows the slot, not the importance of the number.
   */
  size?: "sm" | "md" | "lg";
  /** Renders a skeleton bar in place of the figure. */
  loading?: boolean;
  className?: string;
}

export function MetricTile({
  icon,
  label,
  value,
  tooltip,
  accent,
  size = "sm",
  loading = false,
  className,
}: MetricTileProps) {
  const bento = size !== "sm";
  const lg = size === "lg";

  return (
    <div
      className={cn(
        "relative",
        bento
          ? // Same shell as a job card (deal-row.tsx), so a tile and a
            // job read as the same kind of object.
            "flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5"
          : "rounded-lg bg-muted/50 p-3",
        // Floor the height so the tiles keep their proportions when the
        // list tile beside them is showing its empty state.
        lg ? "min-h-[7rem]" : bento ? "min-h-[6rem]" : null,
        className,
      )}
    >
      {accent && (
        // The nav's active dash (sidebar.tsx): 3px, rounded on the open
        // side, flush to the left edge. Inset vertically so it reads as
        // a marker rather than as a coloured border on the card.
        <span
          aria-hidden
          className={cn(
            "absolute left-0 w-[3px] rounded-r-full",
            bento ? "inset-y-5" : "inset-y-2",
            ACCENT_BAR[accent],
          )}
        />
      )}

      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
          accent && (bento ? "pl-3" : "pl-2"),
        )}
      >
        {icon}
        <span className="min-w-0 truncate">{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`How ${label} is calculated`}
                  className="ml-auto shrink-0 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
                />
              }
            >
              <Info className="h-3 w-3" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-left">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <p
        className={cn(
          "font-semibold tabular-nums text-foreground",
          lg
            ? "mt-6 text-2xl leading-none"
            : bento
              ? "mt-4 text-lg leading-none"
              : "mt-1 text-base",
          accent && (bento ? "pl-3" : "pl-2"),
        )}
      >
        {loading ? (
          // A skeleton, not a placeholder glyph: it holds the figure's
          // height so nothing jumps when the number arrives.
          <span
            aria-hidden
            className={cn(
              "block animate-pulse rounded bg-muted",
              lg ? "h-7 w-24" : bento ? "h-5 w-20" : "h-5 w-16",
            )}
          />
        ) : (
          value
        )}
      </p>
    </div>
  );
}
