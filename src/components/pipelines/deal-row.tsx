"use client";

import type { ReactNode } from "react";
import type { Deal, PipelineStage } from "@/types";
import { SERVICE_CHIP_CLASS, getServiceTypes } from "@/lib/services";
import { brandForContact } from "@/lib/car-brands";
import { BrandBadge } from "@/components/ui/brand-badge";
import {
  dueDate as getDueDate,
  formatCurrency,
  formatDate,
  getDateStatus,
  vehicleName,
} from "@/lib/jobs";
import { AlertTriangle, Calendar, Car, Check, User, X } from "lucide-react";

interface DealRowProps {
  deal: Deal;
  stage: PipelineStage | null;
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
 * Deliberately sparse. The row used to carry fourteen fields across four
 * columns, which meant nothing was emphasised and nothing was scannable.
 * It now answers only the three questions the log is actually read for:
 * which car, where is it, and what is it worth. Everything else lives one
 * click away in the job panel.
 *
 * Layout is an identity block with the make pinned top-right, a rule, and
 * a footer row for status, due date and value — so the eye lands on the
 * numbers last.
 */
export function DealRow({ deal, stage, onOpen, dragHandle, isDragging }: DealRowProps) {
  const c = deal.contact;
  const brand = brandForContact(c);
  const headline = vehicleName(deal);

  const services = getServiceTypes(c);
  const photo = deal.image_urls?.[0] ?? null;
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
      {/* Grip sits top-left on mobile — the make now occupies top-right.
          On md+ it returns inline at the start of the row. */}
      {dragHandle && (
        <div className="absolute left-2 top-2 z-10 rounded-md bg-background/80 backdrop-blur-sm md:static md:z-auto md:bg-transparent md:backdrop-blur-none">
          {dragHandle}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
        {/* Photo — full-width hero on mobile, small portrait on md+. */}
        <div className="w-full shrink-0 md:w-20">
          <div className="aspect-[16/9] overflow-hidden rounded-lg bg-muted sm:aspect-[3/1] md:aspect-square">
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
                <Car className="size-7 md:size-6" />
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Identity — the make is a quiet corner mark, not a column. */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="truncate text-base font-semibold text-foreground" title={headline}>
                  {headline}
                </h3>
                {c?.car_year && (
                  <span className="text-sm text-muted-foreground">{c.car_year}</span>
                )}
                {deal.status === "won" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                    <Check className="size-3" />
                    Won
                  </span>
                )}
                {deal.status === "lost" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-danger">
                    <X className="size-3" />
                    Lost
                  </span>
                )}
              </div>

              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="size-3.5 shrink-0" />
                <span className="truncate">{c?.name || c?.phone || "No customer"}</span>
              </p>

              {services.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {services.map((s) => (
                    <span
                      key={s}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${SERVICE_CHIP_CLASS}`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <BrandBadge brand={brand} size={48} className="shrink-0 max-md:hidden" />
          </div>

          {/* The rule, then the numbers. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
              />
              {stage?.name ?? "No stage"}
            </span>

            {due && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium tabular-nums ${
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
            )}

            <span className="ml-auto text-base font-semibold tabular-nums text-foreground">
              {formatCurrency(deal.value, deal.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* On mobile the corner mark would collide with the hero photo, so it
          rides in the footer instead. */}
      <BrandBadge
        brand={brand}
        size={32}
        className="absolute right-3 top-3 md:hidden"
      />
    </div>
  );
}
