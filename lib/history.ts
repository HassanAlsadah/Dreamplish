import type { Dictionary } from "@/lib/i18n/config";
import type { StepKind } from "@/lib/schemas/history";
import type { JobStatus } from "@/lib/types";

export type HistoryEntry = {
  id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  to_stage_id: string | null;
  /** Custom column name, "assessment" for the preset column, or null for a core column. */
  to_stage_label: string | null;
  changed_at: string;
  note: string | null;
  /** A logged Call / Assessment / Interview and its type ("HR call", "Coding test"); null for plain moves. */
  step_kind?: StepKind | null;
  step_type?: string | null;
};

/** Order of the hiring pipeline; Rejected is an outcome, not a step back. */
const RANK: Record<JobStatus, number> = { saved: 0, applied: 1, interview: 2, offer: 3, rejected: 4 };

export type Move = "forward" | "backward" | "sideways" | "round";

type MoveFields = Pick<HistoryEntry, "from_status" | "to_status"> & Partial<Pick<HistoryEntry, "to_stage_id" | "to_stage_label">>;

/**
 * Backward (e.g. Interview → Applied) and sideways (same status, other column) moves get a curved branch.
 * With the previous entry: staying in the same column is another round (straight line), and
 * Assessment → Interview counts as forward.
 */
export function moveKind(entry: MoveFields, prev?: MoveFields): Move {
  const { from_status: from, to_status: to } = entry;
  if (!from || to === "rejected" || from === "rejected") return "forward";
  if (RANK[to] < RANK[from]) return "backward";
  if (RANK[to] === RANK[from]) {
    if (prev && prev.to_status === to && (prev.to_stage_id ?? null) === (entry.to_stage_id ?? null)) return "round";
    if (prev?.to_stage_label === "assessment" && !entry.to_stage_id) return "forward";
    return "sideways";
  }
  return "forward";
}

/**
 * Round number for each entry. Steps count per kind (2nd Interview step = round 2); plain entries
 * count repeats in the same column in a row.
 */
export function roundNumbers(entries: HistoryEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  const perKind = new Map<StepKind, number>();
  entries.forEach((e, i) => {
    if (e.step_kind) {
      const n = (perKind.get(e.step_kind) ?? 0) + 1;
      perKind.set(e.step_kind, n);
      out.set(e.id, n);
      return;
    }
    const prev = entries[i - 1];
    out.set(e.id, prev && !prev.step_kind && moveKind(e, prev) === "round" ? (out.get(prev.id) ?? 1) + 1 : 1);
  });
  return out;
}

/** Main label: the step kind for steps ("Call", "Interview"), otherwise the column. */
export function stepOrColumnLabel(entry: HistoryEntry, d: Dictionary) {
  return entry.step_kind ? d.history.kinds[entry.step_kind] : entryLabel(entry, d);
}

export function entryLabel(entry: Pick<HistoryEntry, "to_status" | "to_stage_label">, d: Dictionary) {
  if (entry.to_stage_label === "assessment") return d.stages.assessment;
  if (entry.to_stage_label) return entry.to_stage_label;
  return d.status[entry.to_status];
}

/** Theme colour for a node (CSS variables only). */
export function entryColorVar(entry: Pick<HistoryEntry, "to_status" | "to_stage_label">) {
  return entry.to_stage_label === "assessment" ? "var(--status-assessment)" : `var(--status-${entry.to_status})`;
}

/** "3 days ago" in the active locale; `now` is passed in so server and client render the same text. */
export function relativeTime(iso: string, now: number, intlLocale: string) {
  const diff = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
  return rtf.format(0, "minute");
}
