import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, authorizeRow, careerResponse, readJson } from "@/lib/api/http";
import { startSkillCheck, submitSkillCheck } from "@/lib/career/service";

export const maxDuration = 300;

const startSchema = z.object({
  assessment: z.record(z.string().max(100), z.enum(["yes", "no", "unsure"])),
});

/** Submit the yes / no / not-sure answers; creates questions for "not sure" skills. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/jobs/[id]/skill-check">) {
  const auth = await authorizeRow(ctx.params);
  if (!auth.ok) return auth.response;
  const body = await readJson(req, startSchema);
  if (!body) return apiError("bad_answers", 400);
  return careerResponse(await startSkillCheck(auth.id, body.assessment));
}

const answersSchema = z.union([
  z.object({ answers: z.array(z.number().int().min(-1).max(4)).max(20) }),
  z.object({ skip: z.literal(true) }),
]);

/** Submit answers (graded on the server) or skip the check. */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/jobs/[id]/skill-check">) {
  const auth = await authorizeRow(ctx.params);
  if (!auth.ok) return auth.response;
  const body = await readJson(req, answersSchema);
  if (!body) return apiError("bad_request", 400);
  return careerResponse(await submitSkillCheck(auth.id, "answers" in body ? body.answers : null));
}
