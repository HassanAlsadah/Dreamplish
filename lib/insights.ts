import { stageOf, type Stage } from "@/lib/stages";
import type { AppliedVia, Job, JobStatus } from "@/lib/types";

/*
 * Dashboard insights, computed from the jobs and their status history (no extra data collected).
 * Pure functions so they can be tested; `now` is passed in.
 */

export type HistoryLite = {
  job_id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  to_stage_label: string | null;
  step_kind?: "call" | "assessment" | "interview" | null;
  step_type?: string | null;
  changed_at: string;
};

const DAY = 86_400_000;
export const FOLLOW_UP_DAYS = 14;
export const WEEKS = 8;

/** A reply from the employer: a call, an assessment, an interview, an offer or a rejection. */
const isReply = (h: HistoryLite) =>
  Boolean(h.step_kind) || (h.from_status !== null && (h.to_status === "interview" || h.to_status === "offer" || h.to_status === "rejected"));
/** Reached an interview (an assessment alone doesn't count). */
const isInterview = (h: HistoryLite) =>
  h.step_kind === "interview" || h.to_status === "offer" || (h.to_status === "interview" && h.to_stage_label !== "assessment" && h.step_kind !== "assessment" && h.step_kind !== "call");

/** When the application happened: Date applied, or when the job was added. */
const appliedTime = (job: Job) => Date.parse(job.date_applied ? `${job.date_applied}T12:00:00Z` : job.created_at);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Days each job at Applied has gone without any change (from Date applied or its last history row),
 * for jobs waiting at least FOLLOW_UP_DAYS. Used by the insights panel and the board cards.
 */
export function waitingDays(jobs: Job[], history: HistoryLite[], now: number): Map<string, number> {
  const last = new Map<string, number>();
  for (const h of history) last.set(h.job_id, Math.max(last.get(h.job_id) ?? 0, Date.parse(h.changed_at)));
  const out = new Map<string, number>();
  for (const job of jobs) {
    if (job.status !== "applied") continue;
    const days = Math.floor((now - Math.max(appliedTime(job), last.get(job.id) ?? 0)) / DAY);
    if (days >= FOLLOW_UP_DAYS) out.set(job.id, days);
  }
  return out;
}

export type Insights = {
  pipeline: { stage: Stage; count: number }[];
  active: number;
  applications: number;
  replied: number;
  interviewed: number;
  /** null with no applications (no misleading 0%). */
  replyRate: number | null;
  interviewRate: number | null;
  medianDaysToReply: number | null;
  replySample: number;
  followUps: { job: Job; days: number }[];
  followUpTotal: number;
  weeks: { start: number; count: number }[];
  channels: { via: AppliedVia; total: number; replied: number; rate: number }[];
  recent: { job: Job; entry: HistoryLite }[];
};

export function computeInsights({ jobs, history, stages, now }: { jobs: Job[]; history: HistoryLite[]; stages: Stage[]; now: number }): Insights {
  const byJob = new Map<string, HistoryLite[]>();
  for (const h of [...history].sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at))) {
    const list = byJob.get(h.job_id) ?? [];
    list.push(h);
    byJob.set(h.job_id, list);
  }

  // Board columns in order, with how many jobs are in each (empty columns too, so the board's shape shows).
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const st = stageOf(job, stages);
    if (st) counts.set(st.id, (counts.get(st.id) ?? 0) + 1);
  }
  const pipeline = stages.filter((s) => !s.hidden || counts.get(s.id)).map((stage) => ({ stage, count: counts.get(stage.id) ?? 0 }));

  const applied = jobs.filter((j) => j.status !== "saved");
  const repliedJobs = new Set<string>();
  const interviewedJobs = new Set<string>();
  const daysToReply: number[] = [];
  for (const job of applied) {
    const rows = byJob.get(job.id) ?? [];
    const firstReply = rows.find(isReply);
    const stage = stageOf(job, stages);
    const nowReplied = job.status === "interview" || job.status === "offer" || job.status === "rejected";
    if (firstReply || nowReplied) repliedJobs.add(job.id);
    if (rows.some(isInterview) || job.status === "offer" || (job.status === "interview" && stage?.preset !== "assessment")) {
      interviewedJobs.add(job.id);
    }
    if (firstReply) {
      const days = (Date.parse(firstReply.changed_at) - appliedTime(job)) / DAY;
      if (days >= 0) daysToReply.push(days);
    }
  }

  // Waiting on a reply: still at Applied, with nothing new for two weeks or more.
  const waitingMap = waitingDays(jobs, history, now);
  const waiting = jobs
    .filter((j) => waitingMap.has(j.id))
    .map((job) => ({ job, days: waitingMap.get(job.id)! }))
    .sort((a, b) => b.days - a.days);

  // Applications per 7 days, oldest first, the last bucket ending today.
  const end = now;
  const weeks = Array.from({ length: WEEKS }, (_, i) => ({ start: end - (WEEKS - i) * 7 * DAY, count: 0 }));
  for (const job of applied) {
    const t = appliedTime(job);
    const index = WEEKS - 1 - Math.floor((end - t) / (7 * DAY));
    if (index >= 0 && index < WEEKS && t <= end) weeks[index].count++;
  }

  // Reply rate by how you applied.
  const byChannel = new Map<AppliedVia, { total: number; replied: number }>();
  for (const job of applied) {
    if (!job.applied_via) continue;
    const c = byChannel.get(job.applied_via) ?? { total: 0, replied: 0 };
    c.total++;
    if (repliedJobs.has(job.id)) c.replied++;
    byChannel.set(job.applied_via, c);
  }
  const channels = [...byChannel]
    .map(([via, c]) => ({ via, ...c, rate: c.replied / c.total }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total);

  // Latest steps and replies.
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const recent = [...history]
    .filter((h) => (h.step_kind || isReply(h)) && jobById.has(h.job_id))
    .sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at))
    .slice(0, 5)
    .map((entry) => ({ job: jobById.get(entry.job_id)!, entry }));

  const rate = (n: number) => (applied.length ? n / applied.length : null);
  return {
    pipeline,
    active: jobs.filter((j) => j.status === "applied" || j.status === "interview").length,
    applications: applied.length,
    replied: repliedJobs.size,
    interviewed: interviewedJobs.size,
    replyRate: rate(repliedJobs.size),
    interviewRate: rate(interviewedJobs.size),
    medianDaysToReply: median(daysToReply),
    replySample: daysToReply.length,
    followUps: waiting.slice(0, 5),
    followUpTotal: waiting.length,
    weeks,
    channels,
    recent,
  };
}
