"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserClient } from "@/lib/dal";
import { checkJobSchema, jobSchema, localDateSchema, moveJobSchema, type JobInput } from "@/lib/schemas/job";
import { fieldErrors, isUuid } from "@/lib/schemas/common";
import type { ActionState, JobStatus } from "@/lib/types";

const FIELDS = ["company", "companyWebsite", "title", "link", "status", "stage", "dateApplied", "notes", "jobDescription", "appliedVia", "appliedViaDetail"] as const;
type RawJobForm = Record<(typeof FIELDS)[number], string>;
type Supabase = Awaited<ReturnType<typeof createClient>>;
type ResolvedStage = { stageId: string | null; status: JobStatus };

function readForm(formData: FormData): RawJobForm {
  return Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")])) as RawJobForm;
}

/**
 * A board column id → where the job goes. Core columns are stored as stageId null (the job's status
 * decides the column); a custom column is stored by id and sets the status it counts as.
 */
async function resolveStage(supabase: Supabase, stageId: string): Promise<ResolvedStage | null> {
  if (!isUuid(stageId)) return null;
  const { data } = await supabase.from("board_stages").select("id, category, is_core").eq("id", stageId).maybeSingle();
  if (!data) return null;
  return { stageId: data.is_core ? null : data.id, status: data.category };
}

type ParsedJobForm =
  | { ok: true; supabase: Supabase; userId: string; input: JobInput; stage: ResolvedStage | null; raw: RawJobForm }
  | { ok: false; state: ActionState };

/** Shared first half of create and update: read and validate the form, with the column deciding the status. */
async function parseJobForm(formData: FormData): Promise<ParsedJobForm> {
  const raw = readForm(formData);
  const session = await getUserClient();
  if (!session) return { ok: false, state: { ok: false, error: "unauthorized", values: raw } };
  const { user, supabase } = session;
  const stage = await resolveStage(supabase, raw.stage);
  const parsed = jobSchema.safeParse(stage ? { ...raw, status: stage.status } : raw);
  if (!parsed.success) return { ok: false, state: { ok: false, error: "fixFields", fieldErrors: fieldErrors(parsed.error), values: raw } };
  return { ok: true, supabase, userId: user.id, input: parsed.data, stage, raw };
}

async function companyIdFor(supabase: Supabase, input: JobInput): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_or_create_company", { p_name: input.company, p_website: input.companyWebsite ?? undefined });
  if (error || !data) console.error("get_or_create_company failed", error);
  return data ?? null;
}

/** The job columns the form edits. The how-you-applied detail only makes sense with a channel. */
const formColumns = (input: JobInput, companyId: string, stage: ResolvedStage | null) => ({
  company_id: companyId,
  title: input.title,
  link: input.link,
  status: input.status,
  date_applied: input.dateApplied,
  notes: input.notes,
  job_description: input.jobDescription,
  applied_via: input.appliedVia,
  applied_via_detail: input.appliedVia ? input.appliedViaDetail : null,
  ...(stage ? { stage_id: stage.stageId } : {}),
});

/** New jobs go to the top of their column. */
async function topPosition(supabase: Supabase, status: JobStatus) {
  const { data } = await supabase
    .from("jobs")
    .select("position")
    .eq("status", status)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? data.position - 1 : 0;
}

/** Whether a job moves to another column (then the email's interview/assessment type no longer applies). */
const changesColumn = (current: { status: JobStatus; stage_id: string | null }, next: { status: JobStatus; stage: ResolvedStage | null }) =>
  current.status !== next.status || (next.stage !== null && current.stage_id !== next.stage.stageId);

export async function createJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const form = await parseJobForm(formData);
  if (!form.ok) return form.state;
  const { supabase, userId, input, stage, raw } = form;

  const companyId = await companyIdFor(supabase, input);
  if (!companyId) return { ok: false, error: "generic", values: raw };

  const { error } = await supabase.from("jobs").insert({
    ...formColumns(input, companyId, stage),
    user_id: userId,
    position: await topPosition(supabase, input.status),
  });
  if (error) {
    console.error("insert job failed", error);
    return { ok: false, error: "generic", values: raw };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?saved=1");
}

export async function updateJob(jobId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const form = await parseJobForm(formData);
  if (!form.ok) return form.state;
  const { supabase, input, stage, raw } = form;

  const { data: current } = await supabase.from("jobs").select("status, stage_id").eq("id", jobId).maybeSingle();
  if (!current) return { ok: false, error: "generic", values: raw };
  const companyId = await companyIdFor(supabase, input);
  if (!companyId) return { ok: false, error: "generic", values: raw };

  const { error } = await supabase
    .from("jobs")
    .update({
      ...formColumns(input, companyId, stage),
      ...(current.status !== input.status ? { position: await topPosition(supabase, input.status) } : {}),
      ...(changesColumn(current, { status: input.status, stage }) ? { stage_detail: null } : {}),
    })
    .eq("id", jobId);
  if (error) {
    console.error("update job failed", error);
    return { ok: false, error: "generic", values: raw };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, message: "updated", values: raw };
}

/**
 * "Check a job": save a job the user hasn't applied to yet (a draft, status Saved) and open its
 * Match & CV tab, so the match and a tailored CV come before the application.
 */
export async function checkJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    company: String(formData.get("company") ?? ""),
    title: String(formData.get("title") ?? ""),
    link: String(formData.get("link") ?? ""),
    jobDescription: String(formData.get("jobDescription") ?? ""),
  };
  const session = await getUserClient();
  if (!session) return { ok: false, error: "unauthorized", values: raw };
  const parsed = checkJobSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "fixFields", fieldErrors: fieldErrors(parsed.error), values: raw };
  const { user, supabase } = session;
  const input = parsed.data;

  const { data: companyId, error: companyError } = await supabase.rpc("get_or_create_company", { p_name: input.company });
  if (companyError || !companyId) return { ok: false, error: "generic", values: raw };
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      company_id: companyId,
      title: input.title,
      link: input.link,
      job_description: input.jobDescription,
      status: "saved",
      position: await topPosition(supabase, "saved"),
    })
    .select("id")
    .single();
  if (error || !job) {
    console.error("insert draft job failed", error);
    return { ok: false, error: "generic", values: raw };
  }

  revalidatePath("/dashboard");
  redirect(`/jobs/${job.id}?tab=match`);
}

/**
 * "I applied" on a draft: it moves to the Application column (top), dated on the day the user
 * picked in their own time zone unless it already has a date. Its match and tailored CV stay.
 */
export async function markApplied(jobId: string, localDate: string): Promise<ActionState> {
  if (!isUuid(jobId)) return { ok: false, error: "generic" };
  const date = localDateSchema.safeParse(localDate);
  if (!date.success) return { ok: false, error: date.error.issues[0]?.message ?? "invalidDate" };
  const session = await getUserClient();
  if (!session) return { ok: false, error: "unauthorized" };
  const { supabase } = session;

  const { data: current } = await supabase.from("jobs").select("status, date_applied").eq("id", jobId).maybeSingle();
  if (!current) return { ok: false, error: "generic" };
  if (current.status !== "saved") return { ok: true }; // already applied (e.g. a second click)

  const { error, count } = await supabase
    .from("jobs")
    .update(
      { status: "applied", stage_id: null, date_applied: current.date_applied ?? date.data, position: await topPosition(supabase, "applied") },
      { count: "exact" },
    )
    .eq("id", jobId);
  if (error || !count) {
    console.error("mark applied failed", error);
    return { ok: false, error: "generic" };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

/** Delete a job (the dashboard calls this after its Undo toast has gone). */
export async function removeJob(jobId: string): Promise<ActionState> {
  const session = await getUserClient();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!isUuid(jobId)) return { ok: false, error: "generic" };
  const { supabase } = session;
  // RLS limits this to the user's own jobs; count 0 means not found / not theirs.
  const { error, count } = await supabase.from("jobs").delete({ count: "exact" }).eq("id", jobId);
  if (error || count === 0) {
    console.error("remove job failed", error);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Kanban drag & drop: move to a column and/or change the order. */
export async function moveJob(input: { id: string; stageId: string; position: number }): Promise<ActionState> {
  const parsed = moveJobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };

  const session = await getUserClient();
  if (!session) return { ok: false, error: "unauthorized" };
  const { supabase } = session;
  const stage = await resolveStage(supabase, parsed.data.stageId);
  if (!stage) return { ok: false, error: "generic" };
  const { data: current } = await supabase.from("jobs").select("status, stage_id").eq("id", parsed.data.id).maybeSingle();
  if (!current) return { ok: false, error: "generic" };

  const { error, count } = await supabase
    .from("jobs")
    .update(
      {
        status: stage.status,
        stage_id: stage.stageId,
        position: parsed.data.position,
        ...(changesColumn(current, { status: stage.status, stage }) ? { stage_detail: null } : {}),
      },
      { count: "exact" },
    )
    .eq("id", parsed.data.id);
  if (error || count === 0) {
    console.error("move job failed", error);
    return { ok: false, error: "generic" };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
