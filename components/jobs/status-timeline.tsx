"use client";

import { Pencil, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { entryColorVar, entryLabel, moveKind, relativeTime, roundNumbers, stepOrColumnLabel, type HistoryEntry } from "@/lib/history";
import { useI18n } from "@/lib/i18n/client";
import { fmt, getDir, intlTag } from "@/lib/i18n/config";
import { timeline } from "@/lib/motion";
import { cn } from "@/lib/cn";
import type { JobStatus } from "@/lib/types";
import { AddStepDialog } from "./add-step-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EditChangeDateDialog } from "./edit-change-date-dialog";
import { TimelineConnector, type ConnectorPoint } from "./timeline-connector";
import { TimelineNode } from "./timeline-node";
import { TimelineTooltip } from "./timeline-tooltip";

const GUTTER = 32;
const COMPACT_VISIBLE = 4;

/**
 * Commit-graph style status history: an ordered list (oldest first), one node per change,
 * joined by a line that draws itself. Only nodes that weren't shown before animate, so a new
 * status extends the line without replaying the rest.
 */
export function StatusTimeline({
  entries,
  jobId,
  jobCreatedAt,
  currentStatus,
  now,
  compact = false,
}: {
  entries: HistoryEntry[];
  jobId: string;
  jobCreatedAt: string;
  /** Used for the empty state (a single node for where the job is now). */
  currentStatus: JobStatus;
  /** Render time from the server, so relative times match between server and browser. */
  now: number;
  compact?: boolean;
}) {
  const { d, locale } = useI18n();
  const rtl = getDir(locale) === "rtl";
  const reduced = Boolean(useReducedMotion());
  const listRef = useRef<HTMLOListElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const prevLastY = useRef<number | null>(null);
  const [geometry, setGeometry] = useState<{ points: ConnectorPoint[]; height: number; startOffset: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [addingStep, setAddingStep] = useState(false);

  // Empty state: one node for the job's current status.
  const all: HistoryEntry[] = entries.length
    ? entries
    : [{ id: "empty", from_status: null, to_status: currentStatus, to_stage_id: null, to_stage_label: null, changed_at: jobCreatedAt, note: null }];
  const shown = compact && !expanded && all.length > COMPACT_VISIBLE ? all.slice(-COMPACT_VISIBLE) : all;
  // Previous entry and round number come from the full list, so the compact view counts correctly.
  const prevOf = new Map(all.map((e, i) => [e.id, all[i - 1]]));
  const rounds = roundNumbers(all);
  const moveOf = (e: HistoryEntry) => moveKind(e, prevOf.get(e.id));

  // Which nodes are new: on first load all of them (staggered); after that only ones that
  // weren't in the previous list. Updated during render when the list changes (no effect).
  const shownKey = shown.map((e) => e.id).join(",");
  const [track, setTrack] = useState<{ key: string; before: string[] | null }>({ key: shownKey, before: null });
  if (track.key !== shownKey) setTrack({ key: shownKey, before: track.key.split(",") });
  const firstRender = track.before === null;
  const before = new Set(track.before ?? []);
  const newIds = new Set(shown.filter((e) => firstRender || !before.has(e.id)).map((e) => e.id));
  const newOrder = shown.filter((e) => newIds.has(e.id)).map((e) => e.id);

  // Measure node centres so the SVG line passes exactly through them (again whenever the list resizes).
  const measure = useEffectEvent((list: HTMLElement) => {
    const top = list.getBoundingClientRect().top;
    const points = shown.map((e, i) => {
      const el = nodeRefs.current.get(e.id);
      const r = el?.getBoundingClientRect();
      return { y: r ? r.top - top + r.height / 2 : i * 56 + 14, move: i === 0 ? ("forward" as const) : moveOf(e) };
    });
    const lastY = points.at(-1)?.y ?? 0;
    // A longer line than before = new node(s): extend from where the old line ended.
    const startOffset = prevLastY.current && lastY > prevLastY.current ? 1 - prevLastY.current / lastY : 1;
    setGeometry((g) => {
      const same = g && g.points.length === points.length && g.points.every((p, i) => Math.abs(p.y - points[i].y) < 1);
      return same ? g : { points, height: list.offsetHeight, startOffset: g ? startOffset : 1 };
    });
    prevLastY.current = lastY;
  });
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    measure(list);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure(list)) : null;
    ro?.observe(list);
    return () => ro?.disconnect();
  }, [shownKey]);

  const dateFmt = new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "medium", timeStyle: "short" });
  const full = (iso: string) => dateFmt.format(new Date(iso));

  return (
    <section aria-label={d.history.title}>
      <h2 className={cn("mb-3 font-semibold", compact ? "text-sm" : "text-base")}>{d.history.title}</h2>
      {compact && all.length > COMPACT_VISIBLE && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mb-2 text-xs text-accent hover:underline">
          {expanded ? d.history.showLess : fmt(d.history.showAll, { count: all.length })}
        </button>
      )}
      <ol ref={listRef} aria-label={d.history.listLabel} className="relative">
        {geometry && (
          <TimelineConnector
            points={geometry.points}
            x={GUTTER / 2}
            width={GUTTER}
            height={geometry.height}
            rtl={rtl}
            startOffset={geometry.startOffset}
            reduced={reduced}
            key={geometry.points.length}
          />
        )}
        {shown.map((entry, i) => {
          const current = i === shown.length - 1;
          const isNew = newIds.has(entry.id);
          const order = newOrder.indexOf(entry.id);
          // First load: after the line starts drawing, one by one. Later: after the line extends.
          const delay = !isNew ? 0 : firstRender ? timeline.nodesStart + order * timeline.nodeStagger : timeline.lineExtend.duration;
          const round = rounds.get(entry.id) ?? 1;
          const main = stepOrColumnLabel(entry, d);
          const label = round > 1 ? `${main} · ${fmt(d.history.round, { n: round })}` : main;
          // For steps, the column it happened in when that isn't obvious from the label (e.g. a Call in "Called").
          const column = entryLabel(entry, d);
          const inColumn = entry.step_kind && column !== main ? fmt(d.history.inColumn, { column }) : null;
          const accessible = [label, entry.step_type].filter(Boolean).join(" — ");
          const rel = relativeTime(entry.changed_at, now, intlTag(locale));
          const move = i === 0 ? "forward" : moveOf(entry);
          const tipId = `tip-${jobId}-${entry.id}-${compact ? "c" : "f"}`;
          const fromLabel = entry.from_status ? fmt(d.history.from, { status: d.status[entry.from_status] }) : null;

          return (
            <li key={entry.id} className={cn("group relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3", compact ? "pb-3" : "pb-5", current && "pb-0")}>
              <div className="relative flex justify-center pt-0.5">
                <TimelineNode
                  entry={entry}
                  current={current}
                  isNew={isNew}
                  delay={delay}
                  reduced={reduced}
                  label={`${accessible}, ${rel} (${full(entry.changed_at)})${current ? `, ${d.history.current}` : ""}`}
                  describedBy={openId === entry.id ? tipId : undefined}
                  onOpen={() => setOpenId(entry.id)}
                  onClose={() => setOpenId((v) => (v === entry.id ? null : v))}
                  buttonRef={(el) => {
                    if (el) nodeRefs.current.set(entry.id, el);
                    else nodeRefs.current.delete(entry.id);
                  }}
                />
                {!compact && (
                  <TimelineTooltip id={tipId} open={openId === entry.id} reduced={reduced}>
                    <p className="font-semibold" style={{ color: entryColorVar(entry) }} dir="auto">
                      {label}
                    </p>
                    {entry.step_type && (
                      <p className="font-medium" dir="auto">
                        {entry.step_type}
                      </p>
                    )}
                    <p className="mt-0.5 text-muted" suppressHydrationWarning>
                      {full(entry.changed_at)} · {rel}
                    </p>
                    {inColumn && <p className="mt-1 text-xs text-muted">{inColumn}</p>}
                    {fromLabel && move !== "round" && <p className="mt-1 text-xs text-muted">{fromLabel}</p>}
                    {move !== "forward" && (
                      <p className="mt-1 text-xs text-muted">
                        {move === "backward" ? d.history.backward : move === "round" ? d.history.newRound : d.history.sideways}
                      </p>
                    )}
                    {entry.note && (
                      <p className="mt-2 border-s-2 border-border ps-2 text-xs italic" dir="auto">
                        {entry.note}
                      </p>
                    )}
                  </TimelineTooltip>
                )}
              </div>

              {/* Same details as the card, always readable (no hover needed). */}
              <motion.div
                className="min-w-0"
                initial={isNew ? { opacity: 0, y: reduced ? 0 : 4 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? { ...timeline.reduced, delay } : { ...timeline.label, delay: delay + timeline.labelDelay }}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("truncate font-medium", current ? "text-[15px]" : "text-sm")} dir="auto">
                    {label}
                  </span>
                  {current && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">{d.history.current}</span>
                  )}
                  {entry.id !== "empty" && (
                    <button
                      type="button"
                      onClick={() => setEditing(entry)}
                      aria-label={`${d.history.edit}: ${label}`}
                      title={d.history.edit}
                      className="ms-auto rounded-full p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <Pencil className="size-3" />
                    </button>
                  )}
                </div>
                {entry.step_type && (
                  <span className="block truncate text-xs" dir="auto">
                    {entry.step_type}
                  </span>
                )}
                <time dateTime={entry.changed_at} title={full(entry.changed_at)} className="block text-xs text-muted" suppressHydrationWarning>
                  {rel}
                  <span className="sr-only">, {full(entry.changed_at)}</span>
                </time>
                {!compact && entry.note && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted italic" dir="auto">
                    {entry.note}
                  </p>
                )}
              </motion.div>
            </li>
          );
        })}
      </ol>

      {/* Log a Call / Assessment / Interview in any phase. */}
      <button
        type="button"
        onClick={() => setAddingStep(true)}
        className={cn(
          "mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-fg",
          compact && "mt-2",
        )}
      >
        <Plus className="size-3.5" />
        {d.history.addStep}
      </button>

      <AddStepDialog
        open={addingStep}
        jobId={jobId}
        jobCreatedAt={jobCreatedAt}
        currentStatus={currentStatus}
        inAssessment={all.at(-1)?.to_stage_label === "assessment"}
        onClose={() => setAddingStep(false)}
      />
      <EditChangeDateDialog entry={editing} jobId={jobId} jobCreatedAt={jobCreatedAt} onClose={() => setEditing(null)} />
    </section>
  );
}

export function StatusTimelineSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-hidden>
      <Skeleton className="mb-3 h-4 w-28" />
      {Array.from({ length: compact ? 2 : 3 }, (_, i) => (
        <div key={i} className="flex gap-3 pb-5">
          <div className="flex w-8 justify-center">
            <Skeleton className="size-5 rounded-full" />
          </div>
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
