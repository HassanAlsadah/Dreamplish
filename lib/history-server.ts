import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { HistoryEntry } from "./history";

/** A job's status history, oldest first. Deduped per request. */
export const getJobHistory = cache(async (jobId: string): Promise<{ entries: HistoryEntry[]; now: number }> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_status_history")
    .select("id, from_status, to_status, to_stage_id, to_stage_label, changed_at, note, step_kind, step_type")
    .eq("job_id", jobId)
    .order("changed_at", { ascending: true });
  if (error) console.error("getJobHistory failed", error.message);
  return { entries: data ?? [], now: Date.now() };
});
