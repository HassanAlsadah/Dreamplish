"use server";

import { redirect } from "next/navigation";
import { getUserClient } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";

/**
 * Deletes the signed-in user's account and everything in it. The user confirms by typing their email.
 * Their CV files go first (Supabase won't delete a user who still owns stored files); deleting the
 * auth user then removes the rest through the database's cascades: profile, jobs, board columns,
 * status history, interview prep, email connections (with their tokens) and suggestions, usage rows.
 * Companies and company briefs are shared, not personal, and stay.
 */
export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getUserClient();
  if (!session) return { ok: false, error: "unauthorized" };
  const { user, supabase } = session;
  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (!user.email || typed !== user.email.toLowerCase()) return { ok: false, error: "confirmMismatch" };

  const admin = createAdminClient();
  const { data: files, error: listError } = await admin.storage.from("cvs").list(user.id);
  if (listError) return failed("listing CV files", listError);
  if (files.length) {
    const { error } = await admin.storage.from("cvs").remove(files.map((f) => `${user.id}/${f.name}`));
    if (error) return failed("removing CV files", error);
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return failed("deleting the user", error);

  // The user no longer exists, so only the browser's session is cleared.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?deleted=1");
}

function failed(step: string, error: { message: string }): ActionState {
  console.error(`delete account: ${step} failed`, error.message);
  return { ok: false, error: "generic" };
}
