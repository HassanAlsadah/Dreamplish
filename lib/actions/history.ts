"use server";

import { revalidatePath } from "next/cache";
import { getUserClient } from "@/lib/dal";
import { addStepSchema, changeDateSchema, type StepKind } from "@/lib/schemas/history";
import type { ActionState } from "@/lib/types";

/** The database rejects bad dates with these codes in the message; anything else is a generic failure. */
const dateError = (message: string) =>
  /future_date/.test(message) ? "futureDate" : /before_created/.test(message) ? "beforeCreated" : "generic";

/** When the user's job was added (dates can't be before it without confirming), or null if it isn't theirs. */
async function jobContext(jobId: string) {
  const session = await getUserClient();
  if (!session) return null;
  const { supabase } = session;
  const { data: job } = await supabase.from("jobs").select("created_at").eq("id", jobId).maybeSingle();
  return job ? { supabase, createdAt: job.created_at } : null;
}

function revalidateJob(jobId: string): ActionState {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Change when a status change happened (and its note). Validated here and again in the database. */
export async function setStatusChangeDate(input: {
  id: string;
  jobId: string;
  changedAt: string;
  note?: string;
  confirmBeforeCreated?: boolean;
  localDate?: string;
}): Promise<ActionState> {
  const ctx = await jobContext(input.jobId);
  if (!ctx) return { ok: false, error: "generic" };
  const parsed = changeDateSchema(ctx.createdAt).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "generic" };

  // p_local_date: moving the application point also updates the job's Date applied.
  const { error } = await ctx.supabase.rpc("set_status_change_date", {
    p_id: parsed.data.id,
    p_changed_at: new Date(parsed.data.changedAt).toISOString(),
    p_note: parsed.data.note,
    p_allow_before_created: parsed.data.confirmBeforeCreated,
    p_local_date: parsed.data.localDate,
  });
  if (error) return { ok: false, error: dateError(error.message) };
  return revalidateJob(input.jobId);
}

/**
 * Log a Call / Assessment / Interview step by hand (e.g. after a phone call). Assessment and
 * Interview steps also move the job to that column; the database does both in one transaction.
 */
export async function addJobStep(input: {
  jobId: string;
  kind: StepKind;
  type: string;
  changedAt: string;
  note?: string;
  confirmBeforeCreated?: boolean;
}): Promise<ActionState> {
  const ctx = await jobContext(input.jobId);
  if (!ctx) return { ok: false, error: "generic" };
  const parsed = addStepSchema(ctx.createdAt).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "generic" };

  const { error } = await ctx.supabase.rpc("add_job_step", {
    p_job_id: parsed.data.jobId,
    p_kind: parsed.data.kind,
    p_type: parsed.data.type,
    p_changed_at: new Date(parsed.data.changedAt).toISOString(),
    p_note: parsed.data.note,
    p_allow_before_created: parsed.data.confirmBeforeCreated,
  });
  if (error) return { ok: false, error: dateError(error.message) };
  return revalidateJob(input.jobId);
}
