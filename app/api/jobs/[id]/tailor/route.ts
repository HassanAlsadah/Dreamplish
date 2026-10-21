import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, authorizeRow, careerResponse, readJson } from "@/lib/api/http";
import { runTailor, saveTailoredEdit } from "@/lib/career/service";

export const maxDuration = 300;

/** Tailor the user's CV to this job. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/jobs/[id]/tailor">) {
  const auth = await authorizeRow(ctx.params);
  if (!auth.ok) return auth.response;
  return careerResponse(await runTailor(auth.id));
}

const editSchema = z.object({ text: z.string().trim().min(1).max(60_000) });

/** Save the user's edits to the tailored CV. */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/jobs/[id]/tailor">) {
  const auth = await authorizeRow(ctx.params);
  if (!auth.ok) return auth.response;
  const body = await readJson(req, editSchema);
  if (!body) return apiError("bad_request", 400);
  return careerResponse(await saveTailoredEdit(auth.id, body.text));
}
