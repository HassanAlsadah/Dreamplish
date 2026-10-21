"use server";

import { revalidatePath } from "next/cache";
import { getUserClient } from "@/lib/dal";
import { profileSchema } from "@/lib/schemas/profile";
import { fieldErrors } from "@/lib/schemas/common";
import type { ActionState } from "@/lib/types";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = { name: String(formData.get("name") ?? ""), cvText: String(formData.get("cvText") ?? "") };
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "fixFields", fieldErrors: fieldErrors(parsed.error), values: raw };

  const session = await getUserClient();
  if (!session) return { ok: false, error: "unauthorized", values: raw };
  const { user, supabase } = session;
  const { error } = await supabase
    .from("profiles")
    .update({ name: parsed.data.name, cv_text: parsed.data.cvText })
    .eq("id", user.id);
  if (error) {
    console.error("update profile failed", error);
    return { ok: false, error: "generic", values: raw };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "saved", values: raw };
}
