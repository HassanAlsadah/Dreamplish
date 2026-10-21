import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { z } from "zod";
import type { CareerErrorCode } from "@/lib/career/types";
import { getUser } from "@/lib/dal";
import { isUuid } from "@/lib/schemas/common";

/** JSON error body every route uses: { error: code }. The browser shows a message for the code. */
export const apiError = (error: string, status: number) => NextResponse.json({ error }, { status });

/** HTTP status for each career-tool error (the browser only reads the code; this is for logs and caches). */
const CAREER_STATUS: Record<CareerErrorCode, number> = {
  not_found: 404,
  no_job_description: 400,
  no_cv: 400,
  no_gaps: 400,
  bad_answers: 400,
  need_report: 409,
  daily_limit: 429,
  rate_limited: 503,
  not_configured: 503,
  timeout: 504,
  invalid_output: 502,
  provider_error: 502,
};

/** A career service result as a response: { data } or { error } with its status. */
export function careerResponse<T>({ data, error }: { data?: T; error?: CareerErrorCode }) {
  return error ? apiError(error, CAREER_STATUS[error]) : NextResponse.json({ data });
}

type Authed = { ok: true; user: User; id: string } | { ok: false; response: NextResponse };

/**
 * The first lines of every per-row route: a signed-in user (401 otherwise) and a valid row id from the
 * URL (404 otherwise, so a malformed id looks the same as someone else's).
 */
export async function authorizeRow(params: Promise<Record<string, string>>, key = "id"): Promise<Authed> {
  const user = await getUser();
  if (!user) return { ok: false, response: apiError("unauthorized", 401) };
  const id = (await params)[key];
  if (!isUuid(id)) return { ok: false, response: apiError("not_found", 404) };
  return { ok: true, user, id };
}

/** A JSON body checked against a schema, or null when it's missing or invalid. */
export async function readJson<T extends object>(req: Request, schema: z.ZodType<T>): Promise<T | null> {
  const parsed = schema.safeParse(await req.json().catch(() => undefined));
  return parsed.success ? parsed.data : null;
}
