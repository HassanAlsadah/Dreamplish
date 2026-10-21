import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ text: z.string().trim().min(30, "too_short").max(50_000, "too_long") });

/** Saves pasted CV text to the user's profile (used from the Match & CV tab). */
export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "bad_request" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ cv_text: body.data.text }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
