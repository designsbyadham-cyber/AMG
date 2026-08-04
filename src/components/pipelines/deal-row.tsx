"use client";

import type { ReactNode } from "react";
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
 * A job in the log.
 *
 * Two shapes from one DOM tree:
 *  - **Mobile** stacks into a card — big hero photo, then the facts in
 *    priority order (identity → status → money/dates → people). The
 *    `order-*` utilities drive that sequence; `contents` on the middle
 *    wrapper lets its children take part in the same flex ordering.
 *  - **`md`+** lays the same blocks out horizontally: small portrait
 *    photo, three info columns, and a right rail for dates and value.
 */
export function DealRow({
  deal,
  stage,
  stages,
  addedBy,
  onOpen,
  dragHandle,
  isDragging,
}: DealRowProps) {
  const c = deal.contact;
  const headline = vehicleName(deal);
  const showTitleAsSecondary = headline !== deal.title;

  const services = getServiceTypes(c);
  const assigneeLabel = deal.assignee?.full_name || null;
  const photo = deal.image_urls?.[0] ?? null;
  const qc = getQcState(deal, stages);
  const progress = getProgress(deal, stages);
  const due = getDueDate(deal);
  const dueStatus = due ? getDateStatus(due, deal.status) : null;

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
      className={`group relative w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {/* Stage colour accent down the left edge, clipped to the rounded corners */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      {/* Grip floats over the photo on mobile so it doesn't eat a row of
          its own; on md+ it sits inline at the start of the row. */}
      {dragHandle && (
        <div className="absolute right-2 top-2 z-10 rounded-md bg-background/80 backdrop-blur-sm md:static md:z-auto md:bg-transparent md:backdrop-blur-none">
          {dragHandle}
        </div>
      )}

      <div className="flex flex-col gap-4 py-3 pl-4 pr-3 md:flex-row md:items-center">
        {/* ── Photo — full-width hero on mobile, small portrait on md+ ── */}
        <div className="order-1 w-full shrink-0 md:order-none md:w-24">
          <div className="aspect-[16/10] overflow-hidden rounded-lg border border-border/60 bg-muted sm:aspect-[2/1] md:aspect-[3/4]">
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
                <Car className="size-8 md:size-6" />
              </div>
            )}
          </div>
        </div>

        {/* `contents` on mobile so the three blocks below order themselves
            against the photo and the dates rail; a real grid on md+. */}
        <div className="contents md:grid md:min-w-0 md:flex-1 md:grid-cols-[1.4fr_1fr_1.1fr] md:gap-6">
          {/* Identity — vehicle, customer, services */}
          <div className="order-2 min-w-0 md:order-none">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3
                className="truncate text-lg font-bold text-foreground md:text-base"
                title={headline}
              >
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

          {/* People — least critical, so it sinks to the bottom on mobile */}
          <div className="order-5 min-w-0 space-y-2.5 border-t border-border/60 pt-3 md:order-none md:border-t-0 md:pt-0">
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

          {/* Status — stage, quality check, progress */}
          <div className="order-3 min-w-0 space-y-2.5 border-t border-border/60 pt-3 md:order-none md:border-t-0 md:pt-0">
            <div className="flex flex-wrap items-center gap-2 md:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:mb-1">
                Status
              </p>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{
                  backgroundColor: `${stage?.color ?? "#94a3b8"}1f`,
                  color: stage?.color ?? "#94a3b8",
                }}
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
                />
                {stage?.name ?? "No stage"}
              </span>

              {qc && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold md:hidden ${qc.cls}`}
                >
                  {qc.done ? (
                    <CircleCheck className="size-3.5" />
                  ) : (
                    <CircleDashed className="size-3.5" />
                  )}
                  {qc.label}
                </span>
              )}
            </div>

            {/* On md+ the quality check gets its own labelled block; on
                mobile it rides alongside the status pill above. */}
            {qc && (
              <div className="max-md:hidden">
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
            </div>
          </div>
        </div>

        {/* ── Money + dates — a three-up stat strip on mobile, a right
            rail on md+. Sits above "people" on mobile by design. ── */}
        <div className="order-4 grid shrink-0 grid-cols-3 gap-3 border-t border-border/60 pt-3 md:order-none md:block md:min-w-[150px] md:space-y-2 md:border-l md:border-t-0 md:pl-5 md:pt-0 md:text-right">
          <div>
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="size-3" />
              Entry
            </p>
            <p className="text-sm font-bold tabular-nums text-foreground">
              {deal.start_date ? formatDate(deal.start_date) : "—"}
            </p>
          </div>

          <div>
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {dueStatus === "overdue" ? (
                <AlertTriangle className="size-3" />
              ) : (
                <Calendar className="size-3" />
              )}
              Due
            </p>
            {due ? (
              <p
                className={`text-sm font-bold tabular-nums ${
                  dueStatus === "overdue"
                    ? "text-red-400"
                    : dueStatus === "today"
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

          <div className="md:border-t md:border-border/60 md:pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Value
            </p>
            <p className="text-base font-bold text-foreground md:text-base">
              {formatCurrency(deal.value, deal.currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
