import { NextResponse, type NextRequest } from "next/server";
import { apiError, authorizeRow } from "@/lib/api/http";
import { writeDocxParagraphs } from "@/lib/career/docx";
import { getCareerData, originalDocx } from "@/lib/career/service";
import { getJob, getProfile } from "@/lib/dal";

/** Downloads the tailored CV as the user's own Word file, with its original formatting. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/jobs/[id]/cv-docx">) {
  const auth = await authorizeRow(ctx.params);
  if (!auth.ok) return auth.response;

  const [job, profile, career] = await Promise.all([getJob(auth.id), getProfile(), getCareerData(auth.id)]);
  const tailored = career.tailored;
  if (!job || !tailored || tailored.mode !== "docx") return apiError("not_found", 404);

  const original = await originalDocx(profile?.cv_file_type, profile?.cv_file_path);
  if (!original) return apiError("no_file", 409);

  // One line per paragraph; if the user added or removed lines while editing, the mapping is lost.
  const lines = tailored.text.split("\n");
  if (lines.length !== tailored.paragraphCount) return apiError("lines_changed", 409);

  let bytes: Uint8Array;
  try {
    bytes = await writeDocxParagraphs(original, lines);
  } catch {
    // The stored file was replaced by a different CV after tailoring.
    return apiError("file_changed", 409);
  }

  const name = `${profile?.name?.trim() || "CV"} - ${job.title} - ${job.company.name}.docx`.replace(/[\\/:*?"<>|]/g, "-");
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="cv.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
