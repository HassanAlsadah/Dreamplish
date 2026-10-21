import type { Dictionary } from "@/lib/i18n/config";
import type { Job, JobStatus } from "@/lib/types";

export const STAGE_COLORS = ["gray", "blue", "teal", "green", "amber", "orange", "red", "purple", "pink"] as const;
export type StageColor = (typeof STAGE_COLORS)[number];

/** Swatch colours: theme variables, so each has a light and a dark version (see globals.css). */
export const STAGE_HEX: Record<StageColor, string> = {
  gray: "var(--stage-gray)",
  blue: "var(--stage-blue)",
  teal: "var(--stage-teal)",
  green: "var(--stage-green)",
  amber: "var(--stage-amber)",
  orange: "var(--stage-orange)",
  red: "var(--stage-red)",
  purple: "var(--stage-purple)",
  pink: "var(--stage-pink)",
};

export const MAX_STAGES = 12;

/** A custom name in both languages. */
export type StageNameI18n = { en?: string; ar?: string };

export type Stage = {
  id: string;
  name: string | null;
  /** Translations of `name`: null = not translated yet; {} = translation failed. */
  name_i18n?: StageNameI18n | null;
  preset: "assessment" | null;
  category: JobStatus;
  color: StageColor;
  position: number;
  is_core: boolean;
  hidden: boolean;
};

const CORE_COLOR: Record<JobStatus, StageColor> = {
  saved: "gray",
  applied: "blue",
  interview: "amber",
  offer: "green",
  rejected: "red",
};

/**
 * Columns every user starts with. Rejected comes first; Application, Assessment, Interview, Offer and
 * Rejected are the fixed set the email feature uses. Saved (jobs not applied to yet) starts hidden —
 * users can show it from "Customize board".
 */
export function defaultStages(): Array<Omit<Stage, "id">> {
  return [
    { name: null, preset: null, category: "rejected", color: CORE_COLOR.rejected, position: 0, is_core: true, hidden: false },
    { name: null, preset: null, category: "saved", color: CORE_COLOR.saved, position: 1, is_core: true, hidden: true },
    { name: null, preset: null, category: "applied", color: CORE_COLOR.applied, position: 2, is_core: true, hidden: false },
    { name: null, preset: "assessment", category: "interview", color: "purple", position: 3, is_core: false, hidden: false },
    { name: null, preset: null, category: "interview", color: CORE_COLOR.interview, position: 4, is_core: true, hidden: false },
    { name: null, preset: null, category: "offer", color: CORE_COLOR.offer, position: 5, is_core: true, hidden: false },
  ];
}

/** Fixed columns (core five + Assessment): can't be deleted. */
export const isFixedStage = (s: Pick<Stage, "is_core" | "preset">) => s.is_core || s.preset === "assessment";

/** The columns email updates use: Rejected, Application, Assessment, Interview, Offer (not Saved). */
export const isEmailStage = (s: Pick<Stage, "is_core" | "preset" | "category">) =>
  isFixedStage(s) && s.category !== "saved";

export function stageLabel(stage: Pick<Stage, "name" | "preset" | "category"> & Pick<Partial<Stage>, "name_i18n">, d: Dictionary) {
  const name = stage.name?.trim();
  if (name) return stage.name_i18n?.[d.meta.lang === "ar" ? "ar" : "en"]?.trim() || name;
  if (stage.preset === "assessment") return d.stages.assessment;
  return d.status[stage.category];
}

/**
 * Status for a manual column, so filters and scores stay meaningful without asking the user:
 * the nearest fixed column to its left (Rejected doesn't count — it's first on the board).
 */
export function inferCategory(stages: Pick<Stage, "id" | "is_core" | "preset" | "category">[], index: number): JobStatus {
  for (let i = index - 1; i >= 0; i--) {
    const s = stages[i];
    if (isFixedStage(s) && s.category !== "rejected") return s.category;
  }
  return "saved";
}

/** The column a job sits in: its stage, or the core stage of its status. */
export function stageOf(job: Pick<Job, "status"> & { stage_id?: string | null }, stages: Stage[]): Stage | undefined {
  return (
    (job.stage_id ? stages.find((s) => s.id === job.stage_id) : undefined) ??
    stages.find((s) => s.is_core && s.category === job.status)
  );
}

export const isAssessmentStage = (s: Pick<Stage, "preset">) => s.preset === "assessment";
