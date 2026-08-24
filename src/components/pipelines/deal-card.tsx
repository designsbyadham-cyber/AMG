"use client";

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
  vehicleName,
} from "@/lib/jobs";
import { AlertTriangle, Calendar, Car, Check, User, X } from "lucide-react";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

/**
 * Compact job card for the drag-and-drop board.
 *
 * Carries the same fields as the log row and no more, so the two views
 * agree on what a job is. Everything cut from here — who added it, the
 * quality-check state, the progress bar, the entry date — is still one
 * click away in the job panel.
 */
export function DealCard({ deal, stage, onEdit, isOverlay }: DealCardProps) {
  const c = deal.contact;
  const brand = brandForContact(c);
  const headline = vehicleName(deal);

  const contactDisplay = c?.name || c?.phone || "No contact";
  const services = getServiceTypes(c);
  const photo = deal.image_urls?.[0] ?? null;
  const due = getDueDate(deal);
  const dueStatus = due ? getDateStatus(due, deal.status) : null;

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
      className={`group relative flex w-full cursor-pointer flex-col rounded-xl border border-border bg-card p-3 text-left transition-colors ${
        isOverlay ? "shadow-lg" : "hover:border-foreground/20"
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <div className="aspect-[16/10] overflow-hidden rounded-lg bg-muted">
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
                <Car className="size-7" />
              </div>
            )}
          </div>

          {deal.status === "won" && (
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-success px-2 py-0.5 text-[10px] font-semibold text-white">
              <Check className="size-3" />
              Won
            </span>
          )}
          {deal.status === "lost" && (
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-danger px-2 py-0.5 text-[10px] font-semibold text-white">
              <X className="size-3" />
              Lost
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <BrandBadge brand={brand} size={44} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold leading-snug text-foreground" title={headline}>
            {headline}
            {c?.car_year ? (
              <span className="ml-1 font-normal text-muted-foreground">{c.car_year}</span>
            ) : null}
            </h4>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="size-3 shrink-0" />
              <span className="truncate">{contactDisplay}</span>
            </p>
          </div>
        </div>

        {services.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {services.map((s) => (
              <ServiceChip key={s} service={s} />
            ))}
          </div>
        )}

        {/* The rule, then the numbers. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[10px] font-semibold text-foreground">
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
            />
            {stage?.name ?? "No stage"}
          </span>

          {due && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${
                dueStatus === "overdue"
                  ? "text-danger"
                  : dueStatus === "today"
                    ? "text-warning"
                    : "text-muted-foreground"
              }`}
            >
              {dueStatus === "overdue" ? (
                <AlertTriangle className="size-3" />
              ) : (
                <Calendar className="size-3" />
              )}
              {formatDate(due)}
            </span>
          )}

          <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(deal.value, deal.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
