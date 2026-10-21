import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { workerSecret } from "@/lib/env.server";
import { runBriefWorker } from "@/lib/briefing/worker";

export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = workerSecret();
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Drains the briefing queue. Called by a scheduler (e.g. Supabase pg_cron) with the worker secret. */
export async function POST(req: NextRequest) {
  if (!workerSecret()) return NextResponse.json({ error: "WORKER_SECRET not set" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const processed = await runBriefWorker({ max: 5 });
  return NextResponse.json({ processed });
}
