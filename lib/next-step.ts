import { fmt, type Dictionary } from "@/lib/i18n/config";
import { FOLLOW_UP_DAYS } from "@/lib/insights";
import type { Stage } from "@/lib/stages";
import type { Job } from "@/lib/types";

export type Step = { text: string; action?: { label: string; href: string } };

/**
 * The one thing to do next for this job, in priority order. Pure so it can be tested; the page
 * passes how many days have passed since anything happened.
 */
export function nextStep({
  job,
  stage,
  idleDays,
  hasAnalysis,
  d,
}: {
  job: Job;
  stage: Stage | undefined;
  idleDays: number;
  hasAnalysis: boolean;
  d: Dictionary;
}): Step | null {
  const base = `/jobs/${job.id}`;
  const n = d.nextStep;
  if (job.status === "rejected") return { text: n.rejected };
  if (job.status === "offer") return { text: n.offer };
  if (!job.job_description?.trim()) return { text: n.noDescription, action: { label: n.findIt, href: base } };
  // Not applied yet: the match and a tailored CV are worth most now, before the CV is sent.
  if (job.status === "saved") {
    return hasAnalysis
      ? { text: n.savedMatched, action: { label: n.tailor, href: `${base}?tab=match` } }
      : { text: n.saved, action: { label: n.checkMatch, href: `${base}?tab=match` } };
  }
  if (job.status === "interview" && stage?.preset === "assessment") {
    return { text: n.assessment, action: { label: n.checkMatch, href: `${base}?tab=match` } };
  }
  if (job.status === "interview") return { text: n.interview, action: { label: n.prepare, href: `${base}?tab=prep` } };
  if (idleDays >= FOLLOW_UP_DAYS) return { text: fmt(n.followUp, { days: idleDays }) };
  if (!hasAnalysis) return { text: fmt(n.waitingMatch, { days: idleDays }), action: { label: n.checkMatch, href: `${base}?tab=match` } };
  return { text: fmt(n.waiting, { days: idleDays }) };
}
