"use client";

import type { ReactNode } from "react";
import type { Deal, PipelineStage } from "@/types";
import { getServiceTypes } from "@/lib/services";
import { brandForContact } from "@/lib/car-brands";
import { BrandBadge } from "@/components/ui/brand-badge";
import { ServiceChip } from "@/components/ui/service-chip";
import {
  dueDate as getDueDate,
  formatCurrency,
  formatDate,
  getDateStatus,
  getProgress,
  vehicleName,
} from "@/lib/jobs";
import { AlertTriangle, Calendar, Car, Check, User, X } from "lucide-react";

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
 * A job in the log, laid out the way the reference card is:
 * tinted chips on top, then a large make mark beside the vehicle name,
 * then a supporting line, then a rule, then the numbers.
 *
 * The make is deliberately large. It is the fastest way to identify a
 * job at a glance — faster than reading the model name — so it gets the
 * weight of a feature image rather than the weight of a favicon.
 */
export function DealRow({
  deal,
  stage,
  stages,
  onOpen,
  dragHandle,
  isDragging,
}: DealRowProps) {
  const c = deal.contact;
  const brand = brandForContact(c);
  const headline = vehicleName(deal);
  const description = deal.title !== headline ? deal.title : deal.notes;

  const services = getServiceTypes(c);
  const photo = deal.image_urls?.[0] ?? null;
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
      className={`group relative w-full cursor-pointer rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/20 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {/* Grip sits top-left; the status chip owns top-right. */}
      {dragHandle && (
        <div className="absolute left-2 top-2 z-10 rounded-md bg-background/80 backdrop-blur-sm md:static md:z-auto md:bg-transparent md:backdrop-blur-none">
          {dragHandle}
        </div>
      )}

      {/* ── Chips row — services left, status right ─────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2 max-md:mt-6">
        {services.map((s) => (
          <ServiceChip key={s} service={s} />
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-foreground">
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
          />
          {stage?.name ?? "No stage"}
        </span>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Photo */}
        <div className="w-full shrink-0 md:w-28">
          <div className="aspect-[16/9] overflow-hidden rounded-lg bg-muted md:aspect-[4/3]">
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
                <Car className="size-8" />
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* ── Make mark + vehicle, the reference's icon-beside-title ── */}
          <div className="flex items-center gap-3">
            <BrandBadge brand={brand} size={56} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3
                  className="truncate text-lg font-semibold leading-tight text-foreground"
                  title={headline}
                >
                  {headline}
                </h3>
                {c?.car_year && (
                  <span className="text-sm text-muted-foreground">{c.car_year}</span>
                )}
                {deal.status === "won" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success">
                    <Check className="size-3" />
                    Won
                  </span>
                )}
                {deal.status === "lost" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                    <X className="size-3" />
                    Lost
                  </span>
                )}
              </div>

              {description && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground" title={description}>
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Customer + plate */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{c?.name || c?.phone || "No customer"}</span>
            </span>
            {c?.plate_number && (
              <span className="font-mono text-xs">{c.plate_number}</span>
            )}
          </div>

          {/* ── The rule, then the numbers ──────────────────────── */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
            <span className="text-base font-semibold tabular-nums text-foreground">
              {formatCurrency(deal.value, deal.currency)}
            </span>

            {due && (
              <>
                <span aria-hidden className="text-muted-foreground/40">
                  •
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium tabular-nums ${
                    dueStatus === "overdue"
                      ? "text-danger"
                      : dueStatus === "today"
                        ? "text-warning"
                        : "text-muted-foreground"
                  }`}
                >
                  {dueStatus === "overdue" ? (
                    <AlertTriangle className="size-3.5" />
                  ) : (
                    <Calendar className="size-3.5" />
                  )}
                  {formatDate(due)}
                </span>
              </>
            )}

            {progress && (
              <span className="ml-auto flex items-center gap-2">
                <span
                  className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={progress.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progress: ${stage?.name ?? "unknown stage"}`}
                >
                  <span
                    className="block h-full rounded-full transition-all"
                    style={{
                      width: `${progress.pct}%`,
                      backgroundColor: stage?.color ?? "#94a3b8",
                    }}
                  />
                </span>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {progress.step}/{progress.total}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
