"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, FoldHorizontal, Hourglass, UnfoldHorizontal } from "lucide-react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore, useTransition, type Dispatch, type SetStateAction } from "react";
import { Toast } from "@/components/ui/toast";
import { moveJob } from "@/lib/actions/jobs";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { fmt, formatDate } from "@/lib/i18n/config";
import { STAGE_HEX, stageLabel, stageOf, type Stage } from "@/lib/stages";
import type { Job } from "@/lib/types";
import { boardCollision, CARD, COL } from "./board-collision";
import { APPLIED_VIA_ICONS } from "./applied-via";
import { DeleteJobIconButton } from "./delete-job-icon-button";

/** Mobile tab ids: dropping a card on a tab moves it to that column. */
const TAB = "tab:";

/*
 * Collapsed columns, remembered in this browser (a per-viewer convenience). Rejected starts
 * collapsed so the first column isn't the one you look at least. Stored as the list of ids the
 * user changed from the default, so new columns follow the default.
 */
const COLLAPSE_KEY = "dreamplish-collapsed-columns";
const collapseListeners = new Set<() => void>();
function readCollapsed(): string {
  try {
    return localStorage.getItem(COLLAPSE_KEY) ?? "";
  } catch {
    return "";
  }
}
function useCollapsedColumns(stages: Stage[]) {
  const raw = useSyncExternalStore(
    (cb) => {
      collapseListeners.add(cb);
      return () => collapseListeners.delete(cb);
    },
    readCollapsed,
    () => "",
  );
  const toggled = new Set(raw ? raw.split(",") : []);
  const byDefault = (s: Stage) => s.is_core && s.category === "rejected";
  const isCollapsed = (s: Stage) => byDefault(s) !== toggled.has(s.id);
  const toggle = (s: Stage) => {
    const next = new Set(toggled);
    if (next.has(s.id)) next.delete(s.id);
    else next.add(s.id);
    try {
      localStorage.setItem(COLLAPSE_KEY, [...next].filter((id) => stages.some((st) => st.id === id)).join(","));
    } catch {
      // private mode: the toggle just won't be remembered
    }
    collapseListeners.forEach((cb) => cb());
  };
  return { isCollapsed, toggle };
}

/** Position between neighbours so only the moved row is written. */
function positionBetween(prev?: Job, next?: Job) {
  if (prev && next) return (prev.position + next.position) / 2;
  if (prev) return prev.position + 1;
  if (next) return next.position - 1;
  return 0;
}

export function KanbanBoard({
  jobs,
  allJobs,
  stages,
  onJobsChange,
  stageFilter,
  onDelete,
  waiting,
}: {
  jobs: Job[];
  allJobs: Job[];
  /** The user's board columns, in order. */
  stages: Stage[];
  onJobsChange: Dispatch<SetStateAction<Job[]>>;
  /** Show only this column ("" = all visible columns). */
  stageFilter: string;
  onDelete: (job: Job) => void;
  /** Days without a reply, for jobs at Applied waiting two weeks or more. */
  waiting?: Map<string, number>;
}) {
  const { d } = useI18n();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { isCollapsed, toggle } = useCollapsedColumns(stages);
  const reduced = Boolean(useReducedMotion());
  const [mobileStage, setMobileStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const justDragged = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const columns = stageFilter ? stages.filter((s) => s.id === stageFilter) : stages.filter((s) => !s.hidden);
  const inColumn = (stageId: string) =>
    jobs.filter((j) => stageOf(j, stages)?.id === stageId).sort((a, b) => a.position - b.position);
  const activeJob = activeId ? jobs.find((j) => j.id === activeId) : undefined;
  // Column widths: collapsed → a slim strip; empty → narrower; otherwise an equal share.
  const template = columns
    .map((c) => (isCollapsed(c) ? "52px" : inColumn(c.id).length ? "minmax(170px,1fr)" : "minmax(130px,0.6fr)"))
    .join(" ");
  // Phones: the chosen column, else the first active column with jobs (not Rejected), else any with jobs.
  const withJobs = columns.filter((c) => inColumn(c.id).length);
  const mobileId =
    mobileStage && columns.some((c) => c.id === mobileStage)
      ? mobileStage
      : (withJobs.find((c) => c.category !== "rejected")?.id ?? withJobs[0]?.id ?? columns[0]?.id);
  const hiddenCount = stageFilter
    ? 0
    : jobs.filter((j) => {
        const st = stageOf(j, stages);
        return !st || st.hidden;
      }).length;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id).slice(CARD.length));
    justDragged.current = true;
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setTimeout(() => (justDragged.current = false), 0);
    if (!over) return;

    const id = String(active.id).slice(CARD.length);
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    const overId = String(over.id);
    let target: Stage | undefined;
    let beforeId: string | null = null;
    if (overId.startsWith(COL) || overId.startsWith(TAB)) {
      target = stages.find((s) => s.id === overId.slice(overId.startsWith(COL) ? COL.length : TAB.length));
    } else {
      const overJob = jobs.find((j) => j.id === overId.slice(CARD.length));
      if (!overJob || overJob.id === id) return;
      target = stageOf(overJob, stages);
      beforeId = overJob.id;
    }
    if (!target) return;

    const column = inColumn(target.id).filter((j) => j.id !== id);
    const index = beforeId ? column.findIndex((j) => j.id === beforeId) : column.length;
    const position = positionBetween(column[index - 1], column[index]);
    if (stageOf(job, stages)?.id === target.id && job.position === position) return;

    // The job takes on the status its new column counts as; core columns are stored as stage_id null.
    const moved = { status: target.category, stage_id: target.is_core ? null : target.id, position };
    const snapshot = allJobs;
    onJobsChange((prev) => prev.map((j) => (j.id === id ? { ...j, ...moved } : j)));
    startTransition(async () => {
      const result = await moveJob({ id, stageId: target.id, position }).catch(() => ({ ok: false }));
      if (!result.ok) {
        onJobsChange(snapshot);
        setError(d.dashboard.moveFailed);
      }
    });
  }

  return (
    <DndContext
      id="kanban"
      sensors={sensors}
      collisionDetection={boardCollision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{ screenReaderInstructions: { draggable: d.dashboard.dragHint } }}
    >
      {hiddenCount > 0 && <p className="mb-2 text-xs text-muted">{fmt(d.stages.hiddenInfo, { count: hiddenCount })}</p>}
      {/* Phones: one column at a time, picked from tabs. Dropping a card on a tab moves it there. */}
      {columns.length > 1 && (
        <div role="tablist" aria-label={d.stages.column} className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:hidden">
          {columns.map((stage) => (
            <MobileTab
              key={stage.id}
              stage={stage}
              label={stageLabel(stage, d)}
              count={inColumn(stage.id).length}
              selected={stage.id === mobileId}
              onSelect={() => setMobileStage(stage.id)}
            />
          ))}
        </div>
      )}
      {/* Columns are only as tall as their cards (all stretch while dragging, for easy drops); empty
          columns are narrower and any column can be collapsed. The board scrolls sideways if needed. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div
          className={cn("grid gap-3 max-sm:grid-cols-1!", activeId ? "items-stretch" : "items-start", columns.length === 1 && "grid-cols-1 sm:max-w-sm")}
          style={columns.length > 1 ? { gridTemplateColumns: template } : undefined}
        >
          {columns.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              label={stageLabel(stage, d)}
              emptyLabel={d.dashboard.columnEmpty}
              collapsed={columns.length > 1 && isCollapsed(stage)}
              onToggle={() => toggle(stage)}
              className={cn(columns.length > 1 && stage.id !== mobileId && "max-sm:hidden")}
            >
              {inColumn(stage.id).map((job, index) => (
                <DraggableCard
                  index={index}
                  key={job.id}
                  job={job}
                  hidden={job.id === activeId}
                  justDragged={justDragged}
                  onDelete={onDelete}
                  waitingDays={waiting?.get(job.id)}
                  tint={STAGE_HEX[stage.color]}
                />
              ))}
            </Column>
          ))}
        </div>
      </div>

      {/* On drop, the lifted card glides into its new place (none with reduced motion). */}
      <DragOverlay dropAnimation={reduced ? null : { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {activeJob ? <CardBody job={activeJob} lifted tint={STAGE_HEX[stageOf(activeJob, stages)?.color ?? "gray"]} /> : null}
      </DragOverlay>
      <Toast message={error} onClose={() => setError(null)} tone="danger" />
    </DndContext>
  );
}

function Column({
  stage,
  label,
  emptyLabel,
  collapsed,
  onToggle,
  className,
  children,
}: {
  stage: Stage;
  label: string;
  emptyLabel: string;
  /** Slim strip on tablet/desktop (phones always show the column in full). */
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode[];
}) {
  const { d } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: `${COL}${stage.id}` });
  const dot = <span aria-hidden className="inline-block size-3 shrink-0 rounded-full" style={{ background: STAGE_HEX[stage.color] }} />;
  const count = <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-muted tabular-nums">{children.length}</span>;
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        // Colour top edge in the column's colour; while a card is over it, the column tints too.
        "flex min-h-28 flex-col gap-3 rounded-3xl border border-t-[3px] p-3 [transition-property:background-color,border-color] duration-150",
        collapsed && "sm:items-center sm:px-1.5",
        isOver ? "border-[color:var(--tint)] bg-[color-mix(in_oklab,var(--tint)_9%,var(--surface-2))]" : "border-border bg-surface-2",
        className,
      )}
      style={{ "--tint": STAGE_HEX[stage.color], borderTopColor: STAGE_HEX[stage.color] } as React.CSSProperties}
    >
      {/* Collapsed (tablet/desktop): name written vertically, count, and a button to open it. */}
      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-label={fmt(d.dashboard.expandColumn, { name: label })}
          title={fmt(d.dashboard.expandColumn, { name: label })}
          className="hidden flex-1 flex-col items-center gap-2 rounded-2xl py-1 text-muted hover:text-fg sm:flex"
        >
          <UnfoldHorizontal className="size-4" />
          {dot}
          {count}
          <span className="text-[13px] font-semibold text-fg [writing-mode:vertical-rl]" dir="auto">
            {label}
          </span>
        </button>
      )}
      <div className={cn("flex flex-1 flex-col gap-3", collapsed && "sm:hidden")}>
        <header className="flex items-center gap-1.5 px-1.5 pt-1">
          {dot}
          <h2 className="min-w-0 truncate text-[13px] font-semibold" dir="auto" title={label}>
            {label}
          </h2>
          <span className="ms-auto">{count}</span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded
            aria-label={fmt(d.dashboard.collapseColumn, { name: label })}
            title={fmt(d.dashboard.collapseColumn, { name: label })}
            className="hidden size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-fg sm:inline-flex"
          >
            <FoldHorizontal className="size-3.5" />
          </button>
        </header>
        {children.length ? (
          children
        ) : (
          <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}

/** Phone column picker; also a drop target, so a card can be dragged onto another column's tab. */
function MobileTab({
  stage,
  label,
  count,
  selected,
  onSelect,
}: {
  stage: Stage;
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${TAB}${stage.id}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
        selected ? "border-fg bg-fg text-bg" : "border-border bg-surface text-muted",
        isOver && "border-accent",
      )}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: STAGE_HEX[stage.color] }} />
      <span dir="auto">{label}</span>
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function DraggableCard({
  job,
  hidden,
  justDragged,
  onDelete,
  waitingDays,
  tint,
  index,
}: {
  job: Job;
  waitingDays?: number;
  tint?: string;
  /** Position in its column: cards stagger in (and a dropped card settles into place). */
  index: number;
  hidden: boolean;
  justDragged: React.RefObject<boolean>;
  onDelete: (job: Job) => void;
}) {
  const drag = useDraggable({ id: `${CARD}${job.id}` });
  const drop = useDroppable({ id: `${CARD}${job.id}` });
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      {...drag.listeners}
      style={{ "--i": index } as React.CSSProperties}
      {...drag.attributes}
      className={cn(
        // Keyboard focus (cards can be picked up with Space / Enter) shows a clear ring.
        "rise-in relative touch-manipulation rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2",
        hidden && "opacity-30",
        drop.isOver && !hidden && "before:absolute before:inset-x-2 before:-top-2 before:h-0.5 before:rounded before:bg-accent",
      )}
      onClickCapture={(e) => {
        if (justDragged.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <CardBody job={job} onDelete={onDelete} waitingDays={waitingDays} tint={tint} />
    </div>
  );
}

function CardBody({
  job,
  lifted,
  onDelete,
  waitingDays,
  tint,
}: {
  job: Job;
  lifted?: boolean;
  onDelete?: (job: Job) => void;
  waitingDays?: number;
  /** The column's colour: the hover lift and the dragged card's glow use it. */
  tint?: string;
}) {
  const { d, locale } = useI18n();
  const Via = job.applied_via ? APPLIED_VIA_ICONS[job.applied_via] : null;
  return (
    <article
      className={cn(
        "cursor-grab rounded-2xl border border-border bg-surface p-3.5 shadow-[var(--shadow-card)] active:cursor-grabbing",
        // Picked up: tilted, a little larger, glowing in its column's colour.
        lifted ? "scale-[1.03] rotate-[1.5deg] shadow-[var(--shadow-pop),0_18px_36px_-16px_var(--tint)] motion-reduce:scale-100 motion-reduce:rotate-0" : "card-lift",
      )}
      style={tint ? ({ "--tint": tint } as React.CSSProperties) : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/jobs/${job.id}`} className="block min-w-0 text-[15px] leading-snug font-semibold break-words hover:underline" draggable={false} dir="auto">
          {job.company.name}
        </Link>
        {onDelete && !lifted && <DeleteJobIconButton job={job} onDelete={onDelete} className="-me-2 -mt-1.5" />}
      </div>
      <p className="mt-0.5 text-sm leading-snug break-words text-muted" dir="auto">
        {job.title}
      </p>
      {job.stage_detail && (
        <p className="mt-1.5 inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted" dir="auto">
          {job.stage_detail}
        </p>
      )}
      {(job.date_applied || Via || waitingDays) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {job.date_applied && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {formatDate(job.date_applied, locale)}
            </span>
          )}
          {Via && job.applied_via && (
            <span className="inline-flex items-center" title={d.appliedVia[job.applied_via]}>
              <Via className="size-3.5" aria-hidden />
              <span className="sr-only">{d.appliedVia[job.applied_via]}</span>
            </span>
          )}
          {waitingDays ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-interview/15 px-2 py-0.5 font-medium text-fg">
              <Hourglass className="size-3" aria-hidden />
              {fmt(d.dashboard.waiting, { days: waitingDays })}
            </span>
          ) : null}
        </div>
      )}
    </article>
  );
}
