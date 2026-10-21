import { defaultStages, type Stage } from "@/lib/stages";

/** The five core board columns (Rejected first), as a fresh user has them, minus Assessment. */
export function coreStages(): Stage[] {
  return defaultStages()
    .filter((s) => s.is_core)
    .map((s, i) => ({ ...s, id: `stage-${s.category}`, position: i, hidden: false }));
}
