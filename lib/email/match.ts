import { companyMentions, sameKindOfJob } from "@/lib/briefing/providers/structure";
import type { JobStatus } from "@/lib/types";
import type { EmailKind } from "./classify";
import type { GraphMessage } from "./outlook";

export type JobLite = {
  id: string;
  title: string;
  status: JobStatus;
  company: { name: string };
  /** Board column (null = the core column of its status) and the current interview/assessment type. */
  stage_id?: string | null;
  stage_detail?: string | null;
};

const STATUS_FOR: Record<EmailKind, JobStatus> = {
  applied: "applied",
  interview: "interview",
  assessment: "interview",
  offer: "offer",
  rejected: "rejected",
};
const RANK: Record<JobStatus, number> = { saved: 0, applied: 1, interview: 2, offer: 3, rejected: 3 };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, "");

/** "HungerStation | هنقرستيشن" → "HungerStation" (bilingual company names in LinkedIn emails). */
export function cleanCompany(name: string) {
  return name.split(/\s+[|｜]\s+/)[0].trim().slice(0, 200);
}

/** Same company, allowing for extra words ("HungerStation" vs "HungerStation KSA"). */
export function sameCompany(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y && (x.includes(y) || y.includes(x))) || companyMentions(a)(b);
}

/** The user's job this email is about: same company, and the same kind of role if both are known. */
export function findJob(jobs: JobLite[], company: string, role: string): JobLite | null {
  if (!company) return null;
  const matches = jobs.filter((j) => sameCompany(j.company.name, company));
  if (!matches.length) return null;
  if (!role) return matches.length === 1 ? matches[0] : null;
  return matches.find((j) => norm(j.title) === norm(role)) ?? matches.find((j) => sameKindOfJob(j.title, role)) ?? null;
}

/**
 * Which round column a job is in: the fixed Assessment or Interview column, or null for anything
 * else (other statuses, or the user's own columns, which email never touches).
 */
export function roundColumn(job: Pick<JobLite, "status" | "stage_id">, assessmentStageId?: string | null): "assessment" | "interview" | null {
  if (job.status !== "interview") return null;
  if (!job.stage_id) return "interview";
  return assessmentStageId && job.stage_id === assessmentStageId ? "assessment" : null;
}

/** Same interview/assessment type, ignoring case and punctuation. */
export const sameDetail = (a?: string | null, b?: string | null) => norm(a ?? "") === norm(b ?? "");

/**
 * What to suggest: a new job, a status change, a new round, or nothing. Status never moves
 * backwards (e.g. Offer → Applied), and a finished application (offer/rejected) isn't reopened.
 *
 * Rounds: for a job already in the Assessment or Interview column, an interview/assessment email
 * is suggested when it moves the job between those two columns, or names a type the job doesn't
 * have yet (e.g. "HR interview" → "Technical interview"). The same type again is most likely a
 * reminder or reschedule, so it's skipped.
 */
export function decide(
  job: JobLite | null,
  kind: EmailKind,
  detail = "",
  assessmentStageId?: string | null,
): { action: "create" | "update" | "none"; status: JobStatus; round?: boolean } {
  const status = STATUS_FOR[kind];
  if (!job) return { action: "create", status };
  if (job.status === "offer" || job.status === "rejected") return { action: "none", status };
  if (status === "rejected" || RANK[status] > RANK[job.status]) return { action: "update", status };

  const column = roundColumn(job, assessmentStageId);
  if (column && (kind === "interview" || kind === "assessment")) {
    if (kind !== column) return { action: "update", status };
    if (detail.trim() && !sameDetail(detail, job.stage_detail)) return { action: "update", status, round: true };
  }
  return { action: "none", status };
}

const VIA_LINKEDIN = /linkedin/i;
const VIA_JOB_BOARD = /indeed|bayt|naukrigulf|glassdoor|gulftalent|monster|jooble|wuzzuf|tanqeeb/i;
const VIA_ATS = /greenhouse|lever\.co|workday|myworkday|smartrecruiters|taleo|icims|successfactors|jobvite|ashbyhq|workable|bamboohr|recruitee|teamtailor|breezy|oraclecloud|zohorecruit/i;

/**
 * How the user applied, from a received email: a LinkedIn confirmation → LinkedIn; a job board →
 * job board; a hiring system or the company's own address → company website. Null when unclear.
 */
export function appliedViaFor(m: Pick<GraphMessage, "from">, jobLink: string | null, company: string): "linkedin" | "job_board" | "company_website" | null {
  const address = m.from?.emailAddress?.address ?? "";
  const from = `${address} ${m.from?.emailAddress?.name ?? ""}`;
  if (VIA_LINKEDIN.test(from) || (jobLink && /linkedin\.com/i.test(jobLink))) return "linkedin";
  if (VIA_JOB_BOARD.test(from)) return "job_board";
  if (VIA_ATS.test(from) || (jobLink && VIA_ATS.test(jobLink))) return "company_website";
  const domain = address.split("@")[1] ?? "";
  if (domain && sameCompany(domain.split(".").slice(0, -1).join(" "), company)) return "company_website";
  return null;
}
