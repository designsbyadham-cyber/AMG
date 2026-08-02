"use client";

import type { Deal, PipelineStage } from "@/types";
import { SERVICE_TYPE_COLORS, getServiceTypes } from "@/lib/services";
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

function formatCurrency(value: number, currency?: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || "?").trim();
  if (!source) return "?";
  return source.charAt(0).toUpperCase();
}

function getDateStatus(dateStr: string, status?: string): "overdue" | "today" | "future" {
  if (status === "won" || status === "lost") return "future";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  if (date < today) return "overdue";
  if (date.getTime() === today.getTime()) return "today";
  return "future";
}

/**
 * Quality-check state derived from where the job sits relative to the
 * "QC" stage. Returns null when the pipeline has no QC stage, so the
 * block hides rather than showing a meaningless badge.
 */
function getQcState(deal: Deal, stages: PipelineStage[]) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const qcIndex = ordered.findIndex((s) => s.name.trim().toLowerCase() === "qc");
  if (qcIndex === -1) return null;
  const currentIndex = ordered.findIndex((s) => s.id === deal.stage_id);
  if (currentIndex === -1) return null;

  if (deal.status === "lost") {
    return { label: "Rejected", cls: "bg-red-500/10 text-red-500", done: false };
  }
  if (currentIndex > qcIndex) {
    return { label: "QC Verified", cls: "bg-emerald-500/10 text-emerald-500", done: true };
  }
  if (currentIndex === qcIndex) {
    return { label: "In Quality Check", cls: "bg-cyan-500/10 text-cyan-500", done: false };
  }
  return { label: "QC Pending", cls: "bg-muted text-muted-foreground", done: false };
}

export function DealCard({
  deal,
  stage,
  stages = [],
  addedBy,
  onEdit,
  isOverlay,
}: DealCardProps) {
  const c = deal.contact;

  // Vehicle identity: "Ferrari F8" + "(2022)"
  const vehicleName = [c?.car_brand, c?.car_model].filter(Boolean).join(" ");
  const hasVehicle = !!vehicleName;
  const headline = hasVehicle ? vehicleName : deal.title;
  const secondaryLabel = hasVehicle ? deal.title : null;

  const contactName = c?.name || null;
  const contactPhone = c?.phone || null;
  const contactDisplay = contactName || contactPhone || "No contact";

  const services = getServiceTypes(c);
  const assigneeLabel = deal.assignee?.full_name || null;
  const photo = deal.image_urls?.[0] ?? null;

  // Progress through the pipeline (position of this stage in the flow).
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const currentIndex = ordered.findIndex((s) => s.id === deal.stage_id);
  const totalStages = ordered.length;
  const progressPct =
    totalStages > 1 && currentIndex >= 0
      ? Math.round((currentIndex / (totalStages - 1)) * 100)
      : null;

  const qc = getQcState(deal, stages);
  const dueDate = deal.delivery_date ?? deal.expected_close_date ?? null;

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
      {/* Stage colour accent — full-width top bar, clipped to the card's
          rounded corners by overflow-hidden. */}
      <span
        aria-hidden
        className="h-1 w-full shrink-0"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      <div className="flex flex-col gap-3 p-3">
        {/* ── Vehicle photo ───────────────────────────────────────────
            Portrait 3:4, centred, capped at 160px wide so it reads as a
            feature image without dominating the card. Falls back to a
            placeholder tile when the job has no photo attached. */}
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

          {/* Won / lost badge overlays the photo's top-right corner */}
          {deal.status === "won" && (
            <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
              <Check className="size-3" />
              Won
            </span>
          )}
          {deal.status === "lost" && (
            <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
              <X className="size-3" />
              Lost
            </span>
          )}
        </div>

        {/* ── Vehicle + job title ─────────────────────────────────── */}
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

        {/* ── Customer ────────────────────────────────────────────── */}
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

        {/* ── Services ────────────────────────────────────────────── */}
        {services.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {services.map((s) => (
              <span
                key={s}
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  SERVICE_TYPE_COLORS[s] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* ── Quality check ───────────────────────────────────────── */}
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

        {/* ── Progress ────────────────────────────────────────────── */}
        {progressPct !== null && (
          <div className="border-t border-border/50 pt-2.5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Progress
              </p>
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                {currentIndex + 1}/{totalStages}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progress: ${stage?.name ?? "unknown stage"}`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: stage?.color ?? "#94a3b8",
                }}
              />
            </div>
            <p className="mt-1 text-[11px] font-medium text-foreground">{stage?.name}</p>
          </div>
        )}

        {/* ── Dates (stacked rows: label left, value right) ────────── */}
        {(deal.start_date || dueDate) && (
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
            {dueDate &&
              (() => {
                const ds = getDateStatus(dueDate, deal.status);
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
                          ? "text-red-400"
                          : ds === "today"
                            ? "text-amber-400"
                            : "text-primary"
                      }`}
                    >
                      {formatDate(dueDate)}
                    </span>
                  </div>
                );
              })()}
          </div>
        )}

        {/* ── Value ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Value
          </span>
          <span className="text-sm font-bold text-foreground">
            {formatCurrency(deal.value, deal.currency)}
          </span>
        </div>

        {/* ── People: performed by + added by ─────────────────────── */}
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
