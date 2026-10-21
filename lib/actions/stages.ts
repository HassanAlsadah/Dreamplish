"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserClient } from "@/lib/dal";
import { translateStageName } from "@/lib/stage-names";
import { inferCategory, isFixedStage, MAX_STAGES, STAGE_COLORS, type StageNameI18n } from "@/lib/stages";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, JobStatus } from "@/lib/types";
import { isUuid } from "@/lib/schemas/common";

const name = z.string().trim().min(1, "required").max(40, "tooLong");
const createSchema = z.object({ name, color: z.enum(STAGE_COLORS) });
const updateSchema = z.object({
  id: z.uuid(),
  name: name.nullable().optional(),
  color: z.enum(STAGE_COLORS).optional(),
  hidden: z.boolean().optional(),
});

const done = (): ActionState => {
  revalidatePath("/dashboard");
  return { ok: true };
};

type Row = { id: string; category: JobStatus; position: number; is_core: boolean; preset: "assessment" | null };

/** Keeps each manual column's (hidden) status in line with where it sits, and its jobs' status too. */
async function syncManualCategories(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("board_stages").select("id, category, position, is_core, preset").order("position");
  const rows = (data ?? []) as Row[];
  for (const [i, s] of rows.entries()) {
    if (isFixedStage(s)) continue;
    const category = inferCategory(rows, i);
    if (category === s.category) continue;
    await supabase.from("board_stages").update({ category }).eq("id", s.id);
    await supabase.from("jobs").update({ status: category }).eq("stage_id", s.id);
  }
}

/** Add a manual column, placed right after "Application" (move it from there). Email never uses it. */
export async function createStage(input: { name: string; color: string }): Promise<ActionState> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "generic" };
  const c = await getUserClient();
  if (!c) return { ok: false, error: "unauthorized" };

  const { data } = await c.supabase.from("board_stages").select("id, category, position, is_core, preset").order("position");
  const stages = (data ?? []) as Row[];
  if (stages.length >= MAX_STAGES) return { ok: false, error: "tooManyStages" };
  const appliedAt = stages.findIndex((s) => s.is_core && s.category === "applied");
  const after = stages[appliedAt] ?? stages.at(-1);
  const next = after ? stages[stages.indexOf(after) + 1] : undefined;
  const position = after ? (next ? (after.position + next.position) / 2 : after.position + 1) : 0;

  const { error } = await c.supabase
    .from("board_stages")
    .insert({ ...parsed.data, category: after?.category === "rejected" ? "saved" : (after?.category ?? "applied"), user_id: c.user.id, position });
  if (error) return { ok: false, error: "generic" };
  await syncManualCategories(c.supabase);
  return done();
}

/** Rename (null = back to the default name), recolour, or hide/show a column. */
export async function updateStage(input: { id: string; name?: string | null; color?: string; hidden?: boolean }): Promise<ActionState> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "generic" };
  const c = await getUserClient();
  if (!c) return { ok: false, error: "unauthorized" };
  const { id, ...patch } = parsed.data;
  // A new name needs a new translation (the dashboard asks for it).
  const row = patch.name !== undefined ? { ...patch, name_i18n: null } : patch;
  const { error, count } = await c.supabase.from("board_stages").update(row, { count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, error: "generic" };
  return done();
}

/**
 * Translates custom column names that don't have an English and Arabic version yet. The dashboard
 * calls it after a column is added or renamed (and once for columns made before translations existed).
 */
export async function translateStageNames(): Promise<ActionState> {
  const c = await getUserClient();
  if (!c) return { ok: false, error: "unauthorized" };
  const { data, error } = await c.supabase.from("board_stages").select("id, name").not("name", "is", null).is("name_i18n", null);
  if (error) return { ok: false, error: "generic" };
  const rows = (data ?? []).filter((r): r is { id: string; name: string } => r.name !== null);
  if (!rows.length) return { ok: true };

  await Promise.all(
    rows.map(async (row) => {
      let names: StageNameI18n = {};
      try {
        names = await translateStageName(row.name);
      } catch {
        // AI unavailable: keep showing the name as typed; renaming the column tries again.
      }
      // Only if the name is still the one that was translated.
      await c.supabase.from("board_stages").update({ name_i18n: names }).eq("id", row.id).eq("name", row.name);
    }),
  );
  return done();
}

/** Save a new column order (ids from left to right). */
export async function reorderStages(ids: string[]): Promise<ActionState> {
  const parsed = z.array(z.uuid()).max(MAX_STAGES).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "generic" };
  const c = await getUserClient();
  if (!c) return { ok: false, error: "unauthorized" };
  const results = await Promise.all(
    parsed.data.map((id, i) => c.supabase.from("board_stages").update({ position: i }).eq("id", id)),
  );
  if (results.some((r) => r.error)) return { ok: false, error: "generic" };
  await syncManualCategories(c.supabase);
  return done();
}

/** Delete a manual column, moving its jobs to another column first (fixed columns can't be deleted). */
export async function deleteStage(id: string, moveToId: string): Promise<ActionState> {
  if (!isUuid(id) || !isUuid(moveToId) || id === moveToId) {
    return { ok: false, error: "generic" };
  }
  const c = await getUserClient();
  if (!c) return { ok: false, error: "unauthorized" };

  const { data: target } = await c.supabase.from("board_stages").select("id, category, is_core").eq("id", moveToId).maybeSingle();
  if (!target) return { ok: false, error: "generic" };
  // The fixed columns (core five + Assessment) can't be deleted.
  const { data: doomed } = await c.supabase.from("board_stages").select("is_core, preset").eq("id", id).maybeSingle();
  if (!doomed || isFixedStage(doomed)) return { ok: false, error: "generic" };
  // Jobs move to the target column and take on its status. A core target is stored as null (= core column).
  const { error: moveError } = await c.supabase
    .from("jobs")
    .update({ stage_id: target.is_core ? null : target.id, status: target.category })
    .eq("stage_id", id);
  if (moveError) return { ok: false, error: "generic" };
  const { error, count } = await c.supabase.from("board_stages").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, error: "generic" };
  return done();
}
