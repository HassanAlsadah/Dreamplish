export type Importance = "must" | "nice";
export type Seniority = "junior" | "mid" | "senior" | "lead" | "unknown";

export type Requirement = {
  name: string;
  kind: "skill" | "tool";
  importance: Importance;
  /** Verbatim line from the job description. */
  jdQuote: string;
  matched: boolean;
  /** Verbatim line from the CV that proves the match. */
  cvEvidence: string | null;
  /** "Any one of" options, e.g. ["Python", "C", "Java"] for "at least one of Python, C or Java". */
  alternatives?: string[];
  /** Which option the CV showed, for "any one of" requirements. */
  matchedVia?: string;
  /** How the match was established: found in the CV, or passed in the skill check. */
  verifiedBy?: "cv" | "test" | "self";
};

export type SkillQuestion = {
  skill: string;
  question: string;
  options: string[];
  /** Server-only — stripped before anything reaches the browser. */
  answerIndex?: number;
  explanation?: string;
};

export type SelfAssessment = "yes" | "no" | "unsure";

export type SkillCheck = {
  status: "pending" | "done" | "skipped";
  /** What the user said about each gap before any questions. */
  assessment?: Record<string, SelfAssessment>;
  questions: SkillQuestion[];
  /** Filled after grading: what the user picked and whether it was right. */
  results?: Array<{ skill: string; chosen: number; correct: boolean; answerIndex: number; explanation: string }>;
};

export type JobAnalysis = {
  seniority: { level: Seniority; evidence: string };
  requirements: Requirement[];
  /** 0–100, computed by the app (must-haves 70%, nice-to-haves 30%). Null when no CV. */
  score: number | null;
  cvUsed: boolean;
  generatedAt: string;
  /** Quiz on the gaps, taken before the report is shown. */
  skillCheck?: SkillCheck | null;
};

export type TailoredCv = {
  text: string;
  changes: string[];
  considerAdding: string[];
  /** Numbers in the tailored CV that don't appear in the original — the user should check them. */
  warnings: string[];
  /** "docx": text is one line per paragraph of the user's original Word file (keeps its formatting). */
  mode?: "text" | "docx";
  paragraphCount?: number;
  /** CV lines reworded to mirror the job description's wording. */
  paraphrases?: Array<{ original: string; rewritten: string; jdTerms: string[] }>;
  generatedAt: string;
  editedAt?: string;
};

export type InterviewQuestion = {
  category: "role" | "behavioral" | "company";
  question: string;
  why: string;
  /** Suggested answer, first person; based on the CV when possible. */
  suggestedAnswer?: string;
  /** Verbatim CV phrase the answer draws on ("" when it's a general approach). */
  cvBasis?: string;
};
export type TalkingPoint = { point: string; cvEvidence: string; companyFact: string };

export type InterviewPrep = {
  questions: InterviewQuestion[];
  talkingPoints: TalkingPoint[];
  usedBrief: boolean;
  generatedAt: string;
};

export type CareerErrorCode =
  | "no_job_description"
  | "no_cv"
  | "daily_limit"
  | "no_gaps"
  | "need_report"
  | "bad_answers"
  | "not_found"
  | "not_configured"
  | "rate_limited"
  | "timeout"
  | "invalid_output"
  | "provider_error";

export function scoreLabel(score: number): "strong" | "good" | "partial" | "low" {
  return score >= 75 ? "strong" : score >= 55 ? "good" : score >= 35 ? "partial" : "low";
}

/** Match report is ready: analysis exists and the skill check was finished or skipped. */
export function reportReady(a: JobAnalysis | null | undefined): boolean {
  if (!a) return false;
  const hasGaps = a.cvUsed && a.requirements.some((r) => !r.matched);
  return !hasGaps || a.skillCheck?.status === "done" || a.skillCheck?.status === "skipped";
}

/** Skills the user confirmed (said yes, or passed the test) that their CV doesn't show yet. */
export function confirmedSkills(a: JobAnalysis | null | undefined): string[] {
  // "Any one of" requirements are skipped: we don't know which option the user has, and
  // "C, Java or Python (any one)" shouldn't be pasted into a CV.
  return (
    a?.requirements
      .filter((r) => (r.verifiedBy === "test" || r.verifiedBy === "self") && !(r.alternatives && r.alternatives.length > 1))
      .map((r) => r.name) ?? []
  );
}
