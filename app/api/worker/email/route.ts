import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { workerSecret } from "@/lib/env.server";
import { syncDueConnections } from "@/lib/email/sync";

export const maxDuration = 300;

/** Hourly sync for all connected mailboxes. Called by a scheduler (Supabase pg_cron) with the worker secret. */
export async function POST(req: NextRequest) {
  const secret = workerSecret();
  if (!secret) return NextResponse.json({ error: "WORKER_SECRET not set" }, { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await syncDueConnections());
}
