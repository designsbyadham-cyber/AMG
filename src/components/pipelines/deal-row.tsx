"use client";

import type { Deal, PipelineStage } from "@/types";
import { SERVICE_TYPE_COLORS, getServiceTypes } from "@/lib/services";
import {
  dueDate as getDueDate,
  formatCurrency,
  formatDate,
  getDateStatus,
  getProgress,
  getQcState,
  initials,
  vehicleName,
} from "@/lib/jobs";
import {
  AlertTriangle,
  Calendar,
  Car,
  Check,
  CircleCheck,
  CircleDashed,
  Clock,
  Eye,
  Gauge,
  User,
  X,
} from "lucide-react";

interface DealRowProps {
  deal: Deal;
  stage: PipelineStage | null;
  stages: PipelineStage[];
  addedBy?: string | null;
  onOpen: (deal: Deal) => void;
}

/**
 * Horizontal job row for the vertical job log. Photo on the left, then
 * vehicle/customer, people, status, and dates flowing across the row.
 * Collapses to a stacked layout under `md` so it stays readable on
 * phones without a horizontal scroll.
 */
export function DealRow({ deal, stage, stages, addedBy, onOpen }: DealRowProps) {
  const c = deal.contact;
  const headline = vehicleName(deal);
  const showTitleAsSecondary = headline !== deal.title;

  const services = getServiceTypes(c);
  const assigneeLabel = deal.assignee?.full_name || null;
  const photo = deal.image_urls?.[0] ?? null;
  const qc = getQcState(deal, stages);
  const progress = getProgress(deal, stages);
  const due = getDueDate(deal);

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
      className="group relative w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      {/* Stage colour accent down the left edge, clipped to the rounded corners */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      <div className="flex flex-col gap-4 py-3 pl-4 pr-3 md:flex-row md:items-center">
        {/* ── Photo — portrait 3:4, sized to the row height ───────── */}
        <div className="relative shrink-0 self-start md:self-center">
          <div className="aspect-[3/4] w-20 overflow-hidden rounded-lg border border-border/60 bg-muted sm:w-24">
            {photo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photo}
                alt={headline}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                <Car className="size-6" />
              </div>
            )}
          </div>
        </div>

        {/* ── Info columns ────────────────────────────────────────── */}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr_1.1fr] lg:gap-6">
          {/* Vehicle + customer */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="truncate text-base font-bold text-foreground" title={headline}>
                {headline}
              </h3>
              {c?.car_year && (
                <span className="text-sm font-medium text-muted-foreground">({c.car_year})</span>
              )}
              {deal.status === "won" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                  <Check className="size-3" />
                  Won
                </span>
              )}
              {deal.status === "lost" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                  <X className="size-3" />
                  Lost
                </span>
              )}
            </div>

            {showTitleAsSecondary && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={deal.title}>
                {deal.title}
              </p>
            )}

            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{c?.name || c?.phone || "No customer"}</span>
            </p>

            {(c?.plate_number || deal.odometer != null) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                {c?.plate_number && <span className="font-mono">{c.plate_number}</span>}
                {c?.plate_number && deal.odometer != null && (
                  <span className="text-muted-foreground/40">·</span>
                )}
                {deal.odometer != null && (
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="size-3" />
                    {deal.odometer.toLocaleString()} km
                  </span>
                )}
              </p>
            )}

            {services.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {services.map((s) => (
                  <span
                    key={s}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      SERVICE_TYPE_COLORS[s] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
              <Eye className="size-3" />
              View all details
            </span>
          </div>

          {/* People */}
          <div className="min-w-0 space-y-2.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Performed By
              </p>
              {assigneeLabel ? (
                <span className="mt-1 flex min-w-0 items-center gap-1.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {initials(assigneeLabel)}
                  </span>
                  <span className="truncate text-xs font-medium text-foreground">
                    {assigneeLabel}
                  </span>
                </span>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground/60">Unassigned</p>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Added By
              </p>
              {addedBy ? (
                <span className="mt-1 flex min-w-0 items-center gap-1.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-foreground">
                    {initials(addedBy)}
                  </span>
                  <span className="truncate text-xs font-medium text-foreground">{addedBy}</span>
                </span>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground/60">—</p>
              )}
            </div>
          </div>

          {/* Status: quality check + progress */}
          <div className="min-w-0 space-y-2.5">
            {qc && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quality Check
                </p>
                <span
                  className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${qc.cls}`}
                >
                  {qc.done ? (
                    <CircleCheck className="size-3.5" />
                  ) : (
                    <CircleDashed className="size-3.5" />
                  )}
                  {qc.label}
                </span>
              </div>
            )}

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Progress
                </p>
                {progress && (
                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                    {progress.step}/{progress.total}
                  </span>
                )}
              </div>
              {progress && (
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={progress.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progress: ${stage?.name ?? "unknown stage"}`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress.pct}%`,
                      backgroundColor: stage?.color ?? "#94a3b8",
                    }}
                  />
                </div>
              )}
              <p className="mt-1 truncate text-[11px] font-semibold text-foreground">
                {stage?.name ?? "—"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Dates + value, right rail ───────────────────────────── */}
        <div className="shrink-0 space-y-2 border-border/60 pt-3 md:min-w-[150px] md:border-l md:pl-5 md:pt-0 md:text-right">
          <div>
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:justify-end">
              <Clock className="size-3" />
              Entry Date
            </p>
            <p className="text-sm font-bold tabular-nums text-foreground">
              {deal.start_date ? formatDate(deal.start_date) : "—"}
            </p>
          </div>

          <div>
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:justify-end">
              {due && getDateStatus(due, deal.status) === "overdue" ? (
                <AlertTriangle className="size-3" />
              ) : (
                <Calendar className="size-3" />
              )}
              Est. Completion
            </p>
            {due ? (
              <p
                className={`text-sm font-bold tabular-nums ${
                  getDateStatus(due, deal.status) === "overdue"
                    ? "text-red-400"
                    : getDateStatus(due, deal.status) === "today"
                      ? "text-amber-400"
                      : "text-primary"
                }`}
              >
                {formatDate(due)}
              </p>
            ) : (
              <p className="text-sm font-bold text-muted-foreground/50">—</p>
            )}
          </div>

          <div className="border-t border-border/60 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Value
            </p>
            <p className="text-base font-bold text-foreground">
              {formatCurrency(deal.value, deal.currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
