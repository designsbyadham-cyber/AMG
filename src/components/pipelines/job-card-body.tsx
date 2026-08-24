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
  getProgress,
  vehicleName,
} from "@/lib/jobs";
import { AlertTriangle, Calendar, Car, Check, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The inside of a job card, shared by the vertical log and the Kanban
 * board so the two cannot drift apart.
 *
 * Three bands, per the reference:
 *   1. chips — services on the left, stage on the right
 *   2. body  — make mark stacked *above* the vehicle name on the left,
 *              photo on the right
 *   3. money — value on the left, progress on the right
 *
 * The mark sits above the name rather than beside it because the logo
 * set mixes circles, wide ovals and wordmarks. Inline, a wide mark
 * either squashes the name or gets squashed itself; stacked, its width
 * is free and only its height has to agree with the other cards.
 */

interface JobCardBodyProps {
  deal: Deal;
  stage: PipelineStage | null;
  stages: PipelineStage[];
  /** Narrower treatment for the board's ~300px columns. */
  compact?: boolean;
}

export function JobCardBody({ deal, stage, stages, compact }: JobCardBodyProps) {
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
    <>
      {/* ── 1. Chips ─────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-start gap-2">
        {services.map((s) => (
          <ServiceChip key={s} service={s} />
        ))}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
          />
          {stage?.name ?? "No stage"}
        </span>
      </div>

      {/* ── 2. Identity left, photo right ────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <BrandBadge brand={brand} height={compact ? 48 : 64} />

          <h3
            className={cn(
              "mt-2 font-bold leading-tight text-foreground",
              compact ? "text-sm" : "text-lg",
            )}
          >
            <span className="break-words">{headline}</span>
            {c?.car_year && (
              <span className="ml-1.5 font-medium text-muted-foreground">{c.car_year}</span>
            )}
            {deal.status === "won" && (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 align-middle text-[10px] font-semibold text-success">
                <Check className="size-3" />
                Won
              </span>
            )}
            {deal.status === "lost" && (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 align-middle text-[10px] font-semibold text-danger">
                <X className="size-3" />
                Lost
              </span>
            )}
          </h3>

          {description && (
            <p
              className="mt-1 line-clamp-2 text-sm text-muted-foreground"
              title={description}
            >
              {description}
            </p>
          )}

          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            <span className="truncate">{c?.name || c?.phone || "No customer"}</span>
          </p>

          {c?.plate_number && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">{c.plate_number}</p>
          )}
        </div>

        {/* Photo. Fixed box on both axes — no aspect ratio that a failed
            width override could inflate into a full-page slab. */}
        <div
          className={cn(
            "shrink-0 overflow-hidden rounded-xl bg-muted",
            compact ? "size-16" : "h-24 w-24 sm:h-28 sm:w-28",
          )}
        >
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
              <Car className={compact ? "size-6" : "size-8"} />
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Value left, progress right ────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={cn(
            "font-bold tabular-nums text-foreground",
            compact ? "text-base" : "text-xl",
          )}
        >
          {formatCurrency(deal.value, deal.currency)}
        </span>

        {due && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium tabular-nums",
              dueStatus === "overdue"
                ? "text-danger"
                : dueStatus === "today"
                  ? "text-warning"
                  : "text-muted-foreground",
            )}
          >
            {dueStatus === "overdue" ? (
              <AlertTriangle className="size-3.5" />
            ) : (
              <Calendar className="size-3.5" />
            )}
            {formatDate(due)}
          </span>
        )}

        {progress && (
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "h-2 overflow-hidden rounded-full bg-muted",
                compact ? "w-14" : "w-24",
              )}
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
    </>
  );
}
