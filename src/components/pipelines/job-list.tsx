"use client";

import { useMemo, useState } from "react";
import type { Deal, PipelineStage } from "@/types";
import { getServiceTypes } from "@/lib/services";
import { DealRow } from "./deal-row";
import { Input } from "@/components/ui/input";
import { Search, ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JobListProps {
  stages: PipelineStage[];
  deals: Deal[];
  creatorNames?: Record<string, string>;
  onOpenDeal: (deal: Deal) => void;
  onAddDeal: (stageId?: string) => void;
}

/**
 * Vertical job log — one horizontal row per job, newest first, so the
 * page scrolls down instead of sideways. Search matches the vehicle,
 * customer, plate, title and services; the chips filter by stage.
 */
export function JobList({
  stages,
  deals,
  creatorNames,
  onOpenDeal,
  onAddDeal,
}: JobListProps) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const stageById = useMemo(() => {
    const map = new Map<string, PipelineStage>();
    for (const s of stages) map.set(s.id, s);
    return map;
  }, [stages]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deals
      .filter((d) => (stageFilter === "all" ? true : d.stage_id === stageFilter))
      .filter((d) => {
        if (!term) return true;
        const haystack = [
          d.title,
          d.contact?.name,
          d.contact?.phone,
          d.contact?.car_brand,
          d.contact?.car_model,
          d.contact?.plate_number,
          d.notes,
          ...getServiceTypes(d.contact),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => {
        // Newest entry first; fall back to creation time when a job has
        // no entry date set.
        const av = a.start_date ?? a.created_at;
        const bv = b.start_date ?? b.created_at;
        return new Date(bv).getTime() - new Date(av).getTime();
      });
  }, [deals, search, stageFilter]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for car, client, plate, or notes…"
          className="h-11 pl-9"
        />
      </div>

      {/* Stage filter chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setStageFilter("all")}
          className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
            stageFilter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          All Jobs
        </button>
        {sortedStages.map((s) => {
          const active = stageFilter === s.id;
          const count = deals.filter((d) => d.stage_id === s.id).length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStageFilter(s.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
              <span className={active ? "opacity-80" : "text-muted-foreground/60"}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Log header */}
      <div className="flex items-center gap-2 pt-1">
        <ClipboardList className="size-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Log</h2>
        <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {visible.length}
        </span>
      </div>

      {/* Rows — stacked vertically */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16">
          <ClipboardList className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search || stageFilter !== "all"
              ? "No jobs match your filters."
              : "No jobs yet."}
          </p>
          {!search && stageFilter === "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddDeal()}
              className="mt-2"
            >
              <Plus className="size-3.5" />
              Add your first job
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((deal) => (
            <DealRow
              key={deal.id}
              deal={deal}
              stage={stageById.get(deal.stage_id) ?? null}
              stages={sortedStages}
              addedBy={creatorNames?.[deal.user_id] ?? null}
              onOpen={onOpenDeal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
