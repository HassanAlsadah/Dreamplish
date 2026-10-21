import type { NextRequest } from "next/server";
import { authorizeRow, careerResponse } from "@/lib/api/http";
import { runPrep } from "@/lib/career/service";

export const maxDuration = 300;

/** Interview prep: likely questions and talking points for this job. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/jobs/[id]/prep">) {
  const auth = await authorizeRow(ctx.params);
  if (!auth.ok) return auth.response;
  return careerResponse(await runPrep(auth.id));
}
