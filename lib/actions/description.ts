"use server";

import { revalidatePath } from "next/cache";
import { descriptionFromLink, fillJobDescription, type LinkLookup } from "@/lib/career/find-description";
import { getUser } from "@/lib/dal";
import { takeQuota } from "@/lib/rate-limit";
import { isUuid } from "@/lib/schemas/common";

/** "Find job description": the company's careers page or hiring system, never LinkedIn. */
export async function findDescription(jobId: string): Promise<{ ok: boolean; status: string }> {
  const user = await getUser();
  if (!user) return { ok: false, status: "unauthorized" };
  if (!isUuid(jobId)) return { ok: false, status: "not_found" };
  if (!(await takeQuota(user, "find_description"))) return { ok: false, status: "rate_limited" };
  const status = await fillJobDescription(user.id, jobId).catch(() => "error" as const);
  if (status === "found") revalidatePath(`/jobs/${jobId}`);
  return { ok: status === "found" || status === "has_description", status };
}

/** Job form: read the description from the link the user just pasted (no search, nothing saved). */
export async function getDescriptionFromLink(input: {
  link: string;
  company: string;
  title: string;
  website: string;
}): Promise<LinkLookup | { status: "unauthorized" | "rate_limited" | "error" }> {
  const user = await getUser();
  if (!user) return { status: "unauthorized" };
  if (!(await takeQuota(user, "link_lookup"))) return { status: "rate_limited" };
  const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
  return descriptionFromLink({
    link: clip(input.link, 2000),
    company: clip(input.company, 200),
    title: clip(input.title, 200),
    website: clip(input.website, 2000) || null,
  }).catch(() => ({ status: "error" as const }));
}
