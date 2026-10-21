import type { NextRequest } from "next/server";
import { authorizeRow, careerResponse } from "@/lib/api/http";
import { runAnalyze } from "@/lib/career/service";

export const maxDuration = 300;

/** Match report: the job's requirements against the user's CV. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/jobs/[id]/analyze">) {
  const auth = await authorizeRow(ctx.params);
  if (!auth.ok) return auth.response;
  return careerResponse(await runAnalyze(auth.id));
}
