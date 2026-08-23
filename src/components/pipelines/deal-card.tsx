"use client";

import type { Deal, PipelineStage } from "@/types";
import { SERVICE_CHIP_CLASS, getServiceTypes } from "@/lib/services";
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
  Check,
  X,
  Car,
  Gauge,
  CircleCheck,
  CircleDashed,
  Clock,
  User,
  UserCog,
} from "lucide-react";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  /** Full ordered stage list — drives the progress bar and QC state. */
  stages?: PipelineStage[];
  /** Display name of the account that created this job. */
  addedBy?: string | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

/**
 * Compact job card for the drag-and-drop board, where each column is
 * only ~260-320px wide. The wide horizontal presentation lives in
 * `deal-row.tsx` for the vertical job log.
 */
export function DealCard({
  deal,
  stage,
  stages = [],
  addedBy,
  onEdit,
  isOverlay,
}: DealCardProps) {
  const c = deal.contact;

  const headline = vehicleName(deal);
  const secondaryLabel = headline !== deal.title ? deal.title : null;

  const contactName = c?.name || null;
  const contactPhone = c?.phone || null;
  const contactDisplay = contactName || contactPhone || "No contact";

  const services = getServiceTypes(c);
  const assigneeLabel = deal.assignee?.full_name || null;
  const photo = deal.image_urls?.[0] ?? null;

  const progress = getProgress(deal, stages);
  const qc = getQcState(deal, stages);
  const due = getDueDate(deal);

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
      className={`group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border/50 bg-card text-left shadow-sm transition-all ${
        isOverlay ? "shadow-xl" : "hover:-translate-y-0.5 hover:border-border hover:shadow-lg"
      }`}
    >
      <div className="flex flex-col gap-3 p-3">
        {/* Vehicle photo — portrait 3:4, centred, capped so it reads as a
            feature image without dominating the narrow column. */}
        <div className="relative mx-auto w-full max-w-[160px]">
          <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border/60 bg-muted">
            {photo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photo}
                alt={headline}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground/40">
                <Car className="size-7" />
                <span className="text-[10px]">No photo</span>
              </div>
            )}
          </div>

          {deal.status === "won" && (
            <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-white shadow">
              <Check className="size-3" />
              Won
            </span>
          )}
          {deal.status === "lost" && (
            <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-[10px] font-semibold text-white shadow">
              <X className="size-3" />
              Lost
            </span>
          )}
        </div>

        {/* Vehicle + job title */}
        <div className="text-center">
          <h4 className="truncate text-sm font-bold leading-snug text-foreground" title={headline}>
            {headline}
            {c?.car_year ? (
              <span className="ml-1 font-medium text-muted-foreground">({c.car_year})</span>
            ) : null}
          </h4>
          {secondaryLabel && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={secondaryLabel}>
              {secondaryLabel}
            </p>
          )}
          {(c?.plate_number || deal.odometer != null) && (
            <p className="mt-1 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
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
        </div>

        {/* Customer */}
        <div className="flex items-center gap-2 border-t border-border/50 pt-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-foreground">
            {initials(c?.name, c?.phone)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{contactDisplay}</p>
            {contactName && contactPhone && (
              <p className="truncate text-[11px] text-muted-foreground">{contactPhone}</p>
            )}
          </div>
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {services.map((s) => (
              <span
                key={s}
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  SERVICE_CHIP_CLASS
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Quality check */}
        {qc && (
          <div className="border-t border-border/50 pt-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quality Check
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${qc.cls}`}
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

        {/* Progress */}
        {progress && (
          <div className="border-t border-border/50 pt-2.5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Progress
              </p>
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                {progress.step}/{progress.total}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
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
            <p className="mt-1 text-[11px] font-medium text-foreground">{stage?.name}</p>
          </div>
        )}

        {/* Dates — stacked rows: label left, value right */}
        {(deal.start_date || due) && (
          <div className="space-y-1 border-t border-border/50 pt-2.5">
            {deal.start_date && (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Clock className="size-3" />
                  Entry Date
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-foreground">
                  {formatDate(deal.start_date)}
                </span>
              </div>
            )}
            {due &&
              (() => {
                const ds = getDateStatus(due, deal.status);
                return (
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {ds === "overdue" ? (
                        <AlertTriangle className="size-3" />
                      ) : (
                        <Calendar className="size-3" />
                      )}
                      Est. Completion
                    </span>
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        ds === "overdue"
                          ? "text-danger"
                          : ds === "today"
                            ? "text-warning"
                            : "text-primary"
                      }`}
                    >
                      {formatDate(due)}
                    </span>
                  </div>
                );
              })()}
          </div>
        )}

        {/* Value */}
        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Value
          </span>
          <span className="text-sm font-bold text-foreground">
            {formatCurrency(deal.value, deal.currency)}
          </span>
        </div>

        {/* People */}
        {(assigneeLabel || addedBy) && (
          <div className="space-y-1.5 border-t border-border/50 pt-2.5">
            {assigneeLabel && (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <UserCog className="size-3" />
                  Performed By
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {initials(assigneeLabel)}
                  </span>
                  <span className="truncate text-[11px] font-medium text-foreground">
                    {assigneeLabel}
                  </span>
                </span>
              </div>
            )}
            {addedBy && (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <User className="size-3" />
                  Added By
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-foreground">
                    {initials(addedBy)}
                  </span>
                  <span className="truncate text-[11px] font-medium text-foreground">
                    {addedBy}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
