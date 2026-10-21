import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, authorizeRow } from "@/lib/api/http";
import { getBriefView, requestBrief, type RequestError } from "@/lib/briefing/service";

// Generation runs in after(), which lives as long as this function may.
export const maxDuration = 300;

const STATUS: Record<RequestError, number> = {
  not_found: 404,
  daily_limit: 429,
  monthly_limit: 429,
  refresh_too_soon: 429,
  not_configured: 503,
};

const bodySchema = z.object({ force: z.boolean().optional() }).optional();

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/briefs/[companyId]">) {
  const auth = await authorizeRow(ctx.params, "companyId");
  if (!auth.ok) return auth.response;

  const { view, error } = await getBriefView(auth.id);
  if (error) return NextResponse.json({ error, brief: view }, { status: STATUS[error] });
  return NextResponse.json({ brief: view }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/briefs/[companyId]">) {
  const auth = await authorizeRow(ctx.params, "companyId");
  if (!auth.ok) return auth.response;
  // The body is optional (an empty POST asks for a brief); only a malformed one is rejected.
  const body = bodySchema.safeParse(await req.json().catch(() => undefined));
  if (!body.success) return apiError("bad_request", 400);

  try {
    const { view, error } = await requestBrief(auth.id, auth.user, { force: Boolean(body.data?.force) });
    if (error) return NextResponse.json({ error, brief: view }, { status: STATUS[error] });
    return NextResponse.json({ brief: view }, { status: 202 });
  } catch (e) {
    console.error("requestBrief failed", e);
    return apiError("server_error", 500);
  }
}
