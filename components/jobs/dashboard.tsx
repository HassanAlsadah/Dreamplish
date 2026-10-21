"use client";

import { Briefcase, Columns3, LayoutGrid, List, Plus, ScanSearch, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { stageLabel, stageOf, type Stage } from "@/lib/stages";
import { waitingDays, type HistoryLite } from "@/lib/insights";
import type { Job } from "@/lib/types";
import { BoardCustomizer } from "./board-customizer";
import { InsightsPanel } from "./insights-panel";
import { Toast } from "@/components/ui/toast";
import { useStageNameTranslations } from "./use-stage-name-translations";
import { UNDO_MS, useUndoableDelete } from "./use-undoable-delete";
import { KanbanBoard } from "./kanban-board";
import { JobList } from "./job-list";

export type View = "kanban" | "list";

function syncUrl(next: { view: View; q: string; stage: string }) {
  const params = new URLSearchParams();
  if (next.view !== "kanban") params.set("view", next.view);
  if (next.q) params.set("q", next.q);
  if (next.stage) params.set("stage", next.stage);
  const qs = params.toString();
  // Native history keeps the filters shareable without a server round trip.
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export function Dashboard({
  jobs: initialJobs,
  initialView,
  initialQuery,
  initialStage,
  stages,
  inbox,
  drafts,
  history,
  now,
  initialDelete,
}: {
  /** "From your inbox" suggestions (shown when Outlook is connected). */
  inbox?: React.ReactNode;
  /** "Checked, not applied": jobs checked with Match & CV before applying. */
  drafts?: React.ReactNode;
  jobs: Job[];
  initialView: View;
  initialQuery: string;
  /** Board column to filter by ("" = all). */
  initialStage: string;
  stages: Stage[];
  /** Status history for the insights panel, and the server's time (same relative dates on both sides). */
  history: HistoryLite[];
  now: number;
  /** A job to delete on arrival (the job page's Delete), with the same Undo toast. */
  initialDelete?: string;
}) {
  const { d } = useI18n();
  const [jobs, setJobs] = useState(initialJobs);
  const [view, setView] = useState<View>(initialView);
  const [q, setQ] = useState(initialQuery);
  const [stage, setStage] = useState(initialStage);
  const [customizing, setCustomizing] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  useStageNameTranslations(stages);

  const { hiddenIds, undoJob, requestDelete, undo, dismissUndo } = useUndoableDelete({
    initial: initialDelete ? initialJobs.find((j) => j.id === initialDelete) : undefined,
    onDeleted: (id) => setJobs((prev) => prev.filter((j) => j.id !== id)),
    onFailed: () => setNotice({ text: d.dashboard.deleteFailed, tone: "danger" }),
  });
  // Checked-but-not-applied jobs live in their own strip, so they stay off the board, list and insights
  // unless the user has chosen to show the Saved column.
  const savedHidden = stages.find((s) => s.is_core && s.category === "saved")?.hidden ?? true;
  const visibleJobs = useMemo(
    () => jobs.filter((j) => !hiddenIds.has(j.id) && !(savedHidden && j.status === "saved")),
    [jobs, hiddenIds, savedHidden],
  );
  const waiting = useMemo(() => waitingDays(jobs, history, now), [jobs, history, now]);

  // Arriving from the job page's Delete: drop ?delete= from the address.
  const cleanUrl = useEffectEvent(() => {
    if (initialDelete) syncUrl({ view: initialView, q: initialQuery, stage: initialStage });
  });
  useEffect(() => cleanUrl(), []);

  // Server data wins whenever it changes (after revalidation).
  const [prevInitial, setPrevInitial] = useState(initialJobs);
  if (prevInitial !== initialJobs) {
    setPrevInitial(initialJobs);
    setJobs(initialJobs);
  }

  const update = (patch: Partial<{ view: View; q: string; stage: string }>) => {
    const next = { view, q, stage, ...patch };
    if (patch.view !== undefined) setView(patch.view);
    if (patch.q !== undefined) setQ(patch.q);
    if (patch.stage !== undefined) setStage(patch.stage);
    syncUrl(next);
  };

  // Keyboard shortcuts: / search, N new job, B board, L list (not while typing).
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, select, [contenteditable=true], dialog[open]")) return;
    const key = e.key.toLowerCase();
    if (key === "/") {
      e.preventDefault();
      searchRef.current?.focus();
    } else if (key === "n") router.push("/jobs/new");
    else if (key === "b") update({ view: "kanban" });
    else if (key === "l") update({ view: "list" });
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    return visibleJobs.filter(
      (j) =>
        (!stage || stageOf(j, stages)?.id === stage) &&
        (!needle ||
          j.title.toLocaleLowerCase().includes(needle) ||
          j.company.name.toLocaleLowerCase().includes(needle)),
    );
  }, [visibleJobs, q, stage, stages]);

  const hasFilters = Boolean(q.trim() || stage);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{d.dashboard.title}</h1>
          <p className="mt-1.5 text-muted">{d.dashboard.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/jobs/check" variant="secondary">
            <ScanSearch className="size-4" />
            {d.check.button}
          </ButtonLink>
          <Button variant="secondary" onClick={() => setCustomizing(true)}>
            <Columns3 className="size-4" />
            {d.stages.customize}
          </Button>
        </div>
      </div>

      {inbox}
      {drafts}

      {visibleJobs.length === 0 ? (
        <BoardEmpty />
      ) : (
        // Board on the left, insights on the right on wide screens; below the board on smaller ones.
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            {/* One compact toolbar: search, column, view, and the count. Labels are for screen readers. */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-56 flex-1">
                <span className="sr-only">{d.dashboard.searchLabel}</span>
                <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input
                  ref={searchRef}
                  type="search"
                  name="q"
                  value={q}
                  onChange={(e) => update({ q: e.target.value })}
                  placeholder={d.dashboard.searchPlaceholder}
                  className="h-11 rounded-full ps-10 pe-10 text-sm"
                  maxLength={100}
                  aria-keyshortcuts="/"
                />
                <kbd
                  aria-hidden
                  className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border px-1.5 text-[11px] text-muted sm:block"
                >
                  /
                </kbd>
              </label>
              <label className="w-full sm:w-52">
                <span className="sr-only">{d.stages.column}</span>
                <Select value={stage} onChange={(e) => update({ stage: e.target.value })} className="h-11 rounded-full text-sm">
                  <option value="">{d.stages.allColumns}</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {stageLabel(s, d)}
                      {s.hidden ? ` (${d.stages.hidden})` : ""}
                    </option>
                  ))}
                </Select>
              </label>
              <div role="radiogroup" aria-label={d.dashboard.viewLabel} className="flex h-11 rounded-full border border-border bg-surface p-1">
                {(
                  [
                    ["kanban", LayoutGrid, d.dashboard.kanban, "B"],
                    ["list", List, d.dashboard.list, "L"],
                  ] as const
                ).map(([value, Icon, label, key]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={view === value}
                    aria-keyshortcuts={key}
                    aria-label={label}
                    title={`${label} (${key})`}
                    onClick={() => update({ view: value })}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-full px-3.5 text-sm transition-colors",
                      view === value ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                    <span aria-hidden className="hidden sm:inline">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
              <p className="w-full text-xs text-muted lg:ms-2 lg:w-auto" aria-live="polite">
                {fmt(d.dashboard.count, { count: filtered.length })}
                {view === "kanban" && <span className="hidden sm:inline"> · {d.dashboard.dragHint}</span>}
              </p>
            </div>

            {filtered.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 p-10 text-center">
                <h2 className="text-lg font-semibold">{d.dashboard.noResultsTitle}</h2>
                <p className="text-muted">{d.dashboard.noResultsBody}</p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => update({ q: "", stage: "" })}
                    className="mt-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-surface-2"
                  >
                    {d.dashboard.clearFilters}
                  </button>
                )}
              </Card>
            ) : view === "kanban" ? (
              <KanbanBoard
                jobs={filtered}
                stages={stages}
                onJobsChange={setJobs}
                allJobs={jobs}
                stageFilter={stage}
                onDelete={requestDelete}
                waiting={waiting}
              />
            ) : (
              <JobList jobs={filtered} stages={stages} onDelete={requestDelete} waiting={waiting} />
            )}
          </div>
          <aside className="xl:sticky xl:top-6">
            <InsightsPanel jobs={visibleJobs} history={history} stages={stages} now={now} />
          </aside>
        </div>
      )}
      <Toast message={notice?.text ?? null} tone={notice?.tone} onClose={() => setNotice(null)} />
      <Toast
        message={undoJob ? fmt(d.dashboard.deletedUndo, { job: `${undoJob.title} · ${undoJob.company.name}` }) : null}
        onClose={dismissUndo}
        action={{ label: d.dashboard.undo, onClick: undo }}
        duration={UNDO_MS}
      />
      <BoardCustomizer
        open={customizing}
        onClose={() => setCustomizing(false)}
        stages={stages}
        jobs={jobs}
      />
    </div>
  );
}

/** No jobs yet: the board's one call to action (the dawn button). */
function BoardEmpty() {
  const { d } = useI18n();
  return (
    <Card className="py-6">
      <EmptyState
        icon={Briefcase}
        title={d.dashboard.emptyTitle}
        body={d.dashboard.emptyBody}
        tint="var(--status-applied)"
        action={
          <ButtonLink href="/jobs/new" size="lg" variant="dawn">
            <Plus className="size-4" aria-hidden />
            {d.dashboard.emptyCta}
          </ButtonLink>
        }
      />
    </Card>
  );
}
