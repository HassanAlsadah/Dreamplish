import "server-only";
import { classifyAiError } from "@/lib/ai/gemini";
import { redactCv } from "@/lib/ai/redact";
import { getBriefView } from "@/lib/briefing/service";
import { getJob, getProfile, getUser } from "@/lib/dal";
import { getLocale } from "@/lib/i18n/server";
import { takeQuota } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { analyzeJob } from "./analyze";
import { prepareInterview } from "./prep";
import { createSkillCheck, finishSkillCheck, gapsToAssess, gradeSkillCheck, publicAnalysis } from "./skill-check";
import { readDocxParagraphs } from "./docx";
import { tailorCv, tailorDocx } from "./tailor";
import { reportReady, type CareerErrorCode, type InterviewPrep, type JobAnalysis, type SelfAssessment, type TailoredCv } from "./types";

type Result<T> = { data?: T; error?: CareerErrorCode };

async function context(jobId: string) {
  const user = await getUser();
  if (!user) return null;
  const [job, profile] = await Promise.all([getJob(jobId), getProfile()]);
  if (!job) return null;
  const cv = profile?.cv_text?.trim() || null;
  return { user, job, profile, cv };
}

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { data: await fn() };
  } catch (e) {
    const err = classifyAiError(e);
    console.error(`career tool failed (${err.code}):`, err.message);
    return { error: err.code };
  }
}

export async function runAnalyze(jobId: string): Promise<Result<JobAnalysis>> {
  const ctx = await context(jobId);
  if (!ctx) return { error: "not_found" };
  const jd = ctx.job.job_description?.trim();
  if (!jd) return { error: "no_job_description" };
  if (!(await takeQuota(ctx.user, "analyze"))) return { error: "daily_limit" };

  const redacted = ctx.cv ? redactCv(ctx.cv, ctx.profile?.name ?? null) : null;
  const result = await run(() => analyzeJob({ jobDescription: jd, cv: redacted?.text ?? null }));
  if (!result.data) return result;

  // Evidence was quoted from the redacted CV; show the user their real details.
  const analysis: JobAnalysis = {
    ...result.data,
    requirements: result.data.requirements.map((r) => ({
      ...r,
      cvEvidence: r.cvEvidence && redacted ? redacted.restore(r.cvEvidence) : r.cvEvidence,
    })),
  };
  await saveAnalysis(jobId, analysis);
  return { data: analysis };
}

async function loadAnalysis(jobId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("analysis").eq("id", jobId).maybeSingle();
  return data?.analysis ?? null;
}

async function saveAnalysis(jobId: string, analysis: JobAnalysis) {
  const supabase = await createClient();
  await supabase.from("jobs").update({ analysis }).eq("id", jobId);
}

/**
 * Step 1 of the skill check: the user says yes / no / not sure for each gap.
 * "Not sure" skills get verification questions; if there are none, the check finishes right away.
 */
export async function startSkillCheck(
  jobId: string,
  assessment: Record<string, SelfAssessment>,
): Promise<Result<JobAnalysis>> {
  const ctx = await context(jobId);
  if (!ctx) return { error: "not_found" };
  const analysis = await loadAnalysis(jobId);
  if (!analysis) return { error: "not_found" };
  if (analysis.skillCheck?.status === "pending" && analysis.skillCheck.questions.length) {
    return { data: publicAnalysis(analysis)! };
  }
  const gaps = gapsToAssess(analysis);
  if (gaps.length === 0) return { error: "no_gaps" };
  if (gaps.some((g) => !assessment[g.name])) return { error: "bad_answers" };
  const clean = Object.fromEntries(gaps.map((g) => [g.name, assessment[g.name]])) as Record<string, SelfAssessment>;

  const unsure = gaps.filter((g) => clean[g.name] === "unsure").map((g) => g.name);
  if (unsure.length === 0) {
    const done = finishSkillCheck(analysis, { status: "done", questions: [], assessment: clean }, new Set());
    await saveAnalysis(jobId, done);
    return { data: done };
  }

  // Counted against the same daily allowance as analysis.
  if (!(await takeQuota(ctx.user, "analyze"))) return { error: "daily_limit" };

  const locale = await getLocale();
  const result = await run(() => createSkillCheck(analysis, ctx.job.title, locale, unsure));
  if (!result.data) return { error: result.error };
  if (result.data.questions.length === 0) {
    console.error("skill check: model returned no usable questions");
    return { error: "invalid_output" };
  }

  const updated: JobAnalysis = { ...analysis, skillCheck: { ...result.data, assessment: clean } };
  await saveAnalysis(jobId, updated);
  return { data: publicAnalysis(updated)! };
}

export async function submitSkillCheck(jobId: string, answers: number[] | null): Promise<Result<JobAnalysis>> {
  const ctx = await context(jobId);
  if (!ctx) return { error: "not_found" };
  const analysis = await loadAnalysis(jobId);
  if (!analysis) return { error: "not_found" };

  let updated: JobAnalysis;
  if (answers === null) {
    // Skip: show the report as-is.
    updated = { ...analysis, skillCheck: { status: "skipped", questions: [] } };
  } else {
    const check = analysis.skillCheck;
    if (!check || check.status !== "pending" || answers.length !== check.questions.length) return { error: "bad_answers" };
    updated = gradeSkillCheck(analysis, answers);
  }
  await saveAnalysis(jobId, updated);
  return { data: updated };
}

/** The user's stored Word CV as paragraphs, or null (no file, not Word, or unreadable). */
export async function originalDocxParagraphs(type: string | null | undefined, path: string | null | undefined) {
  const file = await originalDocx(type, path);
  if (!file) return null;
  try {
    const paragraphs = await readDocxParagraphs(file);
    return paragraphs.some((p) => p.trim()) ? paragraphs : null;
  } catch (e) {
    console.error("could not read stored Word CV", e);
    return null;
  }
}

export async function originalDocx(type: string | null | undefined, path: string | null | undefined) {
  if (type !== "docx" || !path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("cvs").download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function runTailor(jobId: string): Promise<Result<TailoredCv>> {
  const ctx = await context(jobId);
  if (!ctx) return { error: "not_found" };
  const { cv, job, profile } = ctx;
  if (!cv) return { error: "no_cv" };

  const analysis = await loadAnalysis(jobId);
  // Tailoring builds on the match report (incl. skills the user confirmed), so it must exist first.
  if (!analysis?.cvUsed || !reportReady(analysis)) return { error: "need_report" };
  if (!(await takeQuota(ctx.user, "tailor"))) return { error: "daily_limit" };

  // Word CV on file → tailor inside the original document so its formatting is kept.
  const paragraphs = await originalDocxParagraphs(profile?.cv_file_type, profile?.cv_file_path);
  const target = { jobTitle: job.title, company: job.company.name, jobDescription: job.job_description, analysis };
  const result = await run(() =>
    paragraphs
      ? tailorDocx({ ...target, paragraphs, fullName: profile?.name ?? null })
      : tailorCv({ ...target, redacted: redactCv(cv, profile?.name ?? null) }),
  );
  if (!result.data) return result;
  const supabase = await createClient();
  await supabase.from("jobs").update({ tailored_cv: result.data }).eq("id", jobId);
  return result;
}

export async function saveTailoredEdit(jobId: string, text: string): Promise<Result<TailoredCv>> {
  const ctx = await context(jobId);
  if (!ctx) return { error: "not_found" };
  const supabase = await createClient();
  const { data: row } = await supabase.from("jobs").select("tailored_cv").eq("id", jobId).single();
  const current = row?.tailored_cv ?? null;
  if (!current) return { error: "not_found" };
  const updated: TailoredCv = { ...current, text, editedAt: new Date().toISOString() };
  await supabase.from("jobs").update({ tailored_cv: updated }).eq("id", jobId);
  return { data: updated };
}

export async function runPrep(jobId: string): Promise<Result<InterviewPrep>> {
  const ctx = await context(jobId);
  if (!ctx) return { error: "not_found" };
  if (!(await takeQuota(ctx.user, "prep"))) return { error: "daily_limit" };

  const { view } = await getBriefView(ctx.job.company.id);
  const briefFacts =
    view?.status === "ready" || view?.sections
      ? [
          view?.summary?.text,
          ...(view?.sections?.news.items ?? []).map((i) => i.text),
          ...(view?.sections?.projects.items ?? []).map((i) => (i.name ? `${i.name}: ${i.text}` : i.text)),
          ...(view?.sections?.values.items ?? []).map((i) => i.text),
        ].filter((f): f is string => Boolean(f))
      : [];

  const redacted = ctx.cv ? redactCv(ctx.cv, ctx.profile?.name ?? null) : null;
  const locale = await getLocale();
  const result = await run(() =>
    prepareInterview({
      jobTitle: ctx.job.title,
      company: ctx.job.company.name,
      jobDescription: ctx.job.job_description,
      cv: redacted?.text ?? null,
      briefFacts,
      locale,
    }),
  );
  if (!result.data) return result;

  const restore = (s: string | undefined) => (s && redacted ? redacted.restore(s) : s);
  const prep: InterviewPrep = {
    ...result.data,
    questions: result.data.questions.map((q) => ({
      ...q,
      suggestedAnswer: restore(q.suggestedAnswer),
      cvBasis: restore(q.cvBasis),
    })),
    talkingPoints: result.data.talkingPoints.map((t) => ({
      ...t,
      point: redacted ? redacted.restore(t.point) : t.point,
      cvEvidence: redacted ? redacted.restore(t.cvEvidence) : t.cvEvidence,
    })),
  };
  const supabase = await createClient();
  await supabase.from("interview_preps").upsert(
    {
      job_id: jobId,
      questions: prep.questions,
      talking_points: prep.talkingPoints,
      locale,
      generated_at: prep.generatedAt,
    },
    { onConflict: "job_id" },
  );
  return { data: prep };
}

export async function getCareerData(jobId: string) {
  const supabase = await createClient();
  const [{ data: job }, { data: prep }] = await Promise.all([
    supabase.from("jobs").select("analysis, tailored_cv").eq("id", jobId).maybeSingle(),
    supabase.from("interview_preps").select("questions, talking_points, generated_at").eq("job_id", jobId).maybeSingle(),
  ]);
  return {
    analysis: publicAnalysis(job?.analysis ?? null),
    tailored: job?.tailored_cv ?? null,
    prep: prep
      ? ({
          questions: prep.questions,
          talkingPoints: prep.talking_points,
          usedBrief: true,
          generatedAt: prep.generated_at,
        } as InterviewPrep)
      : null,
  };
}
