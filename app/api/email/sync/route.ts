import { NextResponse } from "next/server";
import { getUser } from "@/lib/dal";
import { takeQuota } from "@/lib/rate-limit";
import { syncUser } from "@/lib/email/sync";

export const maxDuration = 300;

/** "Sync now". */
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await takeQuota(user, "email_sync"))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    return NextResponse.json({ data: await syncUser(user.id) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const code = /no email connection/.test(message) ? "not_connected" : /auth_failed|invalid_grant/.test(message) ? "reconnect" : "sync_failed";
    return NextResponse.json({ error: code }, { status: code === "not_connected" ? 404 : 502 });
  }
}
