"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Deal, PipelineStage } from "@/types";
import { getServiceTypes } from "@/lib/services";
import { formatCurrency } from "@/lib/jobs";
import { DealRow } from "./deal-row";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ClipboardList, Plus, GripVertical } from "lucide-react";

interface JobListProps {
  stages: PipelineStage[];
  deals: Deal[];
  onOpenDeal: (deal: Deal) => void;
  onAddDeal: (stageId?: string) => void;
  onDealMoved: (dealId: string, newStageId: string) => void;
}

/**
 * Vertical job log — jobs are grouped into stage sections that stack
 * down the page, so the whole board reads top-to-bottom instead of
 * scrolling sideways. Each job is a horizontal row that can be dragged
 * by its grip into another stage section to change its status.
 *
 * The grip is a dedicated handle rather than the whole row being
 * draggable: dnd-kit needs `touch-action: none` on the draggable, and
 * applying that to the full row would kill vertical touch scrolling.
 */
export function JobList({
  stages,
  deals,
  onOpenDeal,
  onAddDeal,
  onDealMoved,
}: JobListProps) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const stageById = useMemo(() => {
    const map = new Map<string, PipelineStage>();
    for (const s of stages) map.set(s.id, s);
    return map;
  }, [stages]);

  // Search first — the stage filter is applied per-section below so the
  // section counts always reflect the search.
  const searched = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return deals;
    return deals.filter((d) => {
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
    });
  }, [deals, search]);

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const s of sortedStages) map.set(s.id, []);
    for (const d of searched) map.get(d.stage_id)?.push(d);
    // Newest entry first within each stage.
    for (const list of map.values()) {
      list.sort((a, b) => {
        const av = a.start_date ?? a.created_at;
        const bv = b.start_date ?? b.created_at;
        return new Date(bv).getTime() - new Date(av).getTime();
      });
    }
    return map;
  }, [searched, sortedStages]);

  const visibleStages =
    stageFilter === "all"
      ? sortedStages
      : sortedStages.filter((s) => s.id === stageFilter);

  const totalVisible = visibleStages.reduce(
    (n, s) => n + (dealsByStage.get(s.id)?.length ?? 0),
    0,
  );

  const sensors = useSensors(
    // 5px activation distance so a click on the grip still registers as
    // a click rather than an accidental drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const activeDeal = activeDealId
    ? deals.find((d) => d.id === activeDealId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDealId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDealId(null);
    const { active, over } = event;
    if (!over) return;
    const dealId = String(active.id);
    const targetStageId = String(over.id);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === targetStageId) return;
    if (!sortedStages.some((s) => s.id === targetStageId)) return;
    onDealMoved(dealId, targetStageId);
  }

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
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          All Jobs
        </button>
        {sortedStages.map((s) => {
          const active = stageFilter === s.id;
          const count = dealsByStage.get(s.id)?.length ?? 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStageFilter(s.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.name}
              <span className={active ? "opacity-80" : "text-muted-foreground/60"}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Log header */}
      <div className="flex items-center gap-2 pt-1">
        <ClipboardList className="size-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Log</h2>
        {stageFilter === "all" && (
          <span className="text-[11px] text-muted-foreground">
            Drag the grip to change status
          </span>
        )}
        <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {totalVisible}
        </span>
      </div>

      {totalVisible === 0 && search ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16">
          <ClipboardList className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No jobs match your search.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDealId(null)}
        >
          {/* Stage sections stacked vertically */}
          <div className="flex flex-col gap-8">
            {visibleStages.map((stage) => (
              <StageSection
                key={stage.id}
                stage={stage}
                stages={sortedStages}
                deals={dealsByStage.get(stage.id) ?? []}
                onOpenDeal={onOpenDeal}
                onAddDeal={onAddDeal}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
            {activeDeal ? (
              <div className="opacity-95">
                <DealRow
                  deal={activeDeal}
                  stage={stageById.get(activeDeal.stage_id) ?? null}
                  stages={sortedStages}
                  onOpen={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function StageSection({
  stage,
  stages,
  deals,
  onOpenDeal,
  onAddDeal,
}: {
  stage: PipelineStage;
  stages: PipelineStage[];
  deals: Deal[];
  onOpenDeal: (deal: Deal) => void;
  onAddDeal: (stageId?: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const totalValue = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);

  return (
    <section>
      {/* Stage header — the status label for everything beneath it */}
      <div className="mb-3 flex items-center gap-2">
        {/* Colour bar, not a dot — the reference marks each group with a
            short vertical rule in the stage colour. */}
        <span
          aria-hidden
          className="h-4 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
          {stage.name}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {deals.length}
        </span>
        <span className="ml-auto text-xs font-medium text-muted-foreground tabular-nums">
          {formatCurrency(totalValue)}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 rounded-xl transition-all ${
          isOver
            ? "bg-primary/5 outline outline-2 outline-dashed outline-primary outline-offset-4"
            : ""
        }`}
      >
        {deals.length === 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-5">
            <p className="text-xs text-muted-foreground">
              No jobs in {stage.name}. Drop one here to move it.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddDeal(stage.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        ) : (
          deals.map((deal) => (
            <DraggableDealRow
              key={deal.id}
              deal={deal}
              stage={stage}
              stages={stages}
              onOpen={onOpenDeal}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DraggableDealRow({
  deal,
  stage,
  stages,
  onOpen,
}: {
  deal: Deal;
  stage: PipelineStage;
  stages: PipelineStage[];
  onOpen: (deal: Deal) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
  });

  // Only the grip carries the drag listeners + touch-action, so swiping
  // anywhere else on the row still scrolls the page on touch devices.
  const handle = (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      aria-label={`Drag ${deal.title} to another status`}
      onClick={(e) => e.stopPropagation()}
      style={{ touchAction: "none" }}
      className="flex shrink-0 cursor-grab items-center justify-center rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing md:self-stretch md:p-0.5"
    >
      <GripVertical className="size-4" />
    </span>
  );

  return (
    <DealRow
      deal={deal}
      stage={stage}
      stages={stages}
      onOpen={onOpen}
      dragHandle={handle}
      isDragging={isDragging}
    />
  );
}
