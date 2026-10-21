import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { HistoryLite } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/schemas/common";
import { defaultStages, type Stage } from "@/lib/stages";
import type { Job, Profile } from "@/lib/types";

// One literal (not concatenated) so the query result is typed from it.
const JOB_COLUMNS =
  "id, title, link, status, date_applied, notes, job_description, position, stage_id, stage_detail, applied_via, applied_via_detail, created_at, updated_at, company:companies(id, name, website)";
const PROFILE_COLUMNS = "id, name, cv_text, cv_file_path, cv_file_name, cv_file_type";
const STAGE_COLUMNS = "id, name, name_i18n, preset, category, color, position, is_core, hidden";

/** Verified current user (hits Supabase Auth), or null. Deduped per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** The signed-in user and a Supabase client acting as them (RLS applies), or null when signed out. */
export async function getUserClient() {
  const user = await getUser();
  if (!user) return null;
  return { user, supabase: await createClient() };
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
  if (error) console.error("getProfile failed", error.message);
  return data ?? { id: user.id, name: (user.user_metadata?.name as string | undefined) ?? null, cv_text: null };
});

export async function listJobs(): Promise<Job[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load jobs: ${error.message}`);
  return data ?? [];
}

/**
 * Status history for the dashboard insights, and the time it was read, so relative dates render the
 * same on the server and in the browser.
 */
export async function listHistory(): Promise<{ history: HistoryLite[]; now: number }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_status_history")
    .select("job_id, from_status, to_status, to_stage_label, changed_at, step_kind, step_type")
    .order("changed_at", { ascending: false })
    .limit(3000);
  if (error) console.error("listHistory failed", error.message);
  return { history: data ?? [], now: Date.now() };
}

/** The user's board columns in order. Creates the default columns the first time. */
export const listStages = cache(async (): Promise<Stage[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const load = () => supabase.from("board_stages").select(STAGE_COLUMNS).order("position");
  const { data, error } = await load();
  if (error) throw new Error(`Failed to load board columns: ${error.message}`);
  if (data.length) return data;

  const { data: created, error: insertError } = await supabase
    .from("board_stages")
    .insert(defaultStages().map((s) => ({ ...s, user_id: user.id })))
    .select(STAGE_COLUMNS);
  if (!insertError && created) return created.sort((a, b) => a.position - b.position);
  // A parallel request may have created them already.
  const { data: again, error: againError } = await load();
  if (againError || !again.length) throw new Error(`Failed to create board columns: ${(insertError ?? againError)?.message}`);
  return again;
});

/** A job checked before applying (status Saved), with its match score once Match & CV has run. */
export type Draft = { id: string; title: string; company: string; score: number | null };

/** "Checked, not applied" on the dashboard, most recently touched first. */
export async function listDrafts(): Promise<Draft[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, company:companies(name), score:analysis->score")
    .eq("status", "saved")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to load checked jobs: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company?.name ?? "",
    score: typeof row.score === "number" ? row.score : null,
  }));
}

export async function getJob(id: string): Promise<Job | null> {
  await requireUser();
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load job: ${error.message}`);
  return data;
}
