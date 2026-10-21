import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, authorizeRow, readJson } from "@/lib/api/http";
import { acceptEvent, EMAIL_KINDS, ignoreEvent } from "@/lib/email/service";

const bodySchema = z.object({
  action: z.enum(["accept", "ignore"]),
  company: z.string().trim().max(200).optional(),
  role: z.string().trim().max(200).optional(),
  kind: z.enum(EMAIL_KINDS).optional(),
});

/** Accept (optionally edited) or ignore an inbox suggestion. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/email/events/[id]">) {
  const auth = await authorizeRow(ctx.params);
  if (!auth.ok) return auth.response;
  const body = await readJson(req, bodySchema);
  if (!body) return apiError("bad_request", 400);

  if (body.action === "ignore") return NextResponse.json(await ignoreEvent(auth.user.id, auth.id));
  const result = await acceptEvent(auth.user.id, auth.id, body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
