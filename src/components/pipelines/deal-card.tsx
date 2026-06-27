"use client";

import type { Deal, PipelineStage } from "@/types";
import { AlertTriangle, Calendar, Check, X } from "lucide-react";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
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
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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

export function DealCard({ deal, stage, onEdit, isOverlay }: DealCardProps) {
  const c = deal.contact;

  // Build vehicle identity line: "Toyota Camry 2021 · ABC-1234"
  const vehicleParts = [c?.car_brand, c?.car_model, c?.car_year].filter(Boolean).join(" ");
  const hasVehicle = !!vehicleParts;
  const vehicleLine = hasVehicle
    ? [vehicleParts, c?.plate_number].filter(Boolean).join(" · ")
    : null;

  // Primary header = vehicle if available, otherwise job title
  const primaryHeader = vehicleLine ?? deal.title;
  // Secondary label = job title only when vehicle line is the primary
  const secondaryLabel = hasVehicle ? deal.title : null;

  const contactName = c?.name || null;
  const contactPhone = c?.phone || null;
  // Show phone alongside name only when both exist (avoids duplicating phone-only contacts)
  const showPhone = !!(contactName && contactPhone);
  const contactDisplay = contactName || contactPhone || "No contact";

  const assigneeLabel = deal.assignee?.full_name || null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { if (!isOverlay) onEdit(deal); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!isOverlay) onEdit(deal);
        }
      }}
      className={`group relative w-full cursor-pointer rounded-xl border border-border/50 bg-white pl-4 pr-3 py-3 text-left shadow-sm transition-all ${
        isOverlay
          ? "shadow-xl"
          : "hover:-translate-y-0.5 hover:border-border hover:bg-white hover:shadow-lg"
      }`}
    >
      {/* Stage colour accent bar */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      {/* Line 1 — Vehicle identity (or title fallback) + status badge */}
      <div className="flex items-start justify-between gap-2">
        <h4
          className="flex-1 truncate text-sm font-semibold leading-snug text-foreground"
          title={primaryHeader}
        >
          {primaryHeader}
        </h4>
        {deal.status === "won" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Check className="h-3 w-3" />
            Won
          </span>
        )}
        {deal.status === "lost" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            <X className="h-3 w-3" />
            Lost
          </span>
        )}
      </div>

      {/* Line 2 — Job title (secondary, only when vehicle line is primary) */}
      {secondaryLabel && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={secondaryLabel}>
          {secondaryLabel}
        </p>
      )}

      {/* Line 3 — Contact row */}
      <div className="mt-2 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-foreground">
          {initials(c?.name, c?.phone)}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {contactDisplay}
          {showPhone && (
            <span className="text-muted-foreground/60"> · {contactPhone}</span>
          )}
        </span>
      </div>

      {/* Line 4 — Value + date + assignee */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-foreground">
          {formatCurrency(deal.value, deal.currency)}
        </span>
        <div className="flex items-center gap-2">
          {(deal.delivery_date ?? deal.expected_close_date) && (() => {
            const displayDate = (deal.delivery_date ?? deal.expected_close_date)!;
            const ds = getDateStatus(displayDate, deal.status);
            return (
              <span
                className={`flex items-center gap-1 text-[11px] ${
                  ds === "overdue"
                    ? "text-red-400"
                    : ds === "today"
                      ? "text-amber-400"
                      : "text-muted-foreground"
                }`}
              >
                {ds === "overdue" ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <Calendar className="h-3 w-3" />
                )}
                {formatDate(displayDate)}
              </span>
            );
          })()}
          {assigneeLabel && (
            <span
              title={assigneeLabel}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
            >
              {initials(assigneeLabel)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
