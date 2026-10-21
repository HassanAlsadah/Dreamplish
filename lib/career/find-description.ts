import "server-only";
import { tavilyApiKey } from "@/lib/env.server";
import { fetchHtml } from "@/lib/safe-fetch";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNeverRead, isOwnOrAtsPage, matchingPosting, postingForLink } from "./job-posting";

/*
 * Finds a job's description on the company's own careers page or its hiring system (Greenhouse,
 * Lever, Workday, …). LinkedIn and Glassdoor pages are never fetched. One Tavily search per lookup;
 * a page is used only if its structured posting names the same company and role.
 */

const MAX_PAGES = 5;
const EXCLUDE = ["linkedin.com", "glassdoor.com", "glassdoor.co.uk", "glassdoor.ca", "glassdoor.co.in"];

export type DescriptionLookup =
  | { status: "found"; description: string; url: string }
  | { status: "not_found" }
  | { status: "not_configured" };

async function searchPostings(company: string, title: string): Promise<string[]> {
  const key = tavilyApiKey();
  if (!key) return [];
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `"${company}" "${title}" job careers apply`,
      search_depth: "basic",
      max_results: 10,
      exclude_domains: EXCLUDE,
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const json = (await res.json().catch(() => ({}))) as { results?: { url: string }[] };
  return (json.results ?? []).map((r) => r.url);
}

export async function findJobDescription({
  company,
  website,
  title,
  link,
}: {
  company: string;
  website: string | null;
  title: string;
  /** The job's saved link: tried first when it's the company's own page or a hiring system. */
  link: string | null;
}): Promise<DescriptionLookup> {
  if (!company.trim() || !title.trim() || /^unknown role$/i.test(title.trim())) return { status: "not_found" };
  const fromLink = link && isOwnOrAtsPage(link, company, website) ? [link] : [];
  if (!fromLink.length && !tavilyApiKey()) return { status: "not_configured" };

  const tryPages = async (urls: string[]) => {
    for (const url of urls.slice(0, MAX_PAGES)) {
      const html = await fetchHtml(url).catch(() => null);
      const posting = html ? matchingPosting(html, company, title) : null;
      if (posting) return { status: "found" as const, description: posting.description.slice(0, 29_000), url };
    }
    return null;
  };

  // The saved link first (no search needed), then a search for the posting.
  const direct = await tryPages(fromLink);
  if (direct) return direct;
  if (!tavilyApiKey()) return { status: fromLink.length ? "not_found" : "not_configured" };
  const searched = (await searchPostings(company, title)).filter((url) => !fromLink.includes(url) && isOwnOrAtsPage(url, company, website));
  return (await tryPages([...new Set(searched)])) ?? { status: "not_found" };
}

/** Saved form: where it came from first, so it's clear the text wasn't in the user's own notes. */
export const withSource = (description: string, url: string) => `Source: ${url}\n\n${description}`;

/**
 * Looks up and saves a job's description when it has none (and its link, if empty, to the page
 * found). Scoped to the job's owner. Never overwrites a description the user already has.
 */
export async function fillJobDescription(userId: string, jobId: string): Promise<DescriptionLookup["status"] | "has_description"> {
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("title, link, job_description, company:companies(name, website)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!job) return "not_found";
  if (job.job_description?.trim()) return "has_description";
  const company = job.company as unknown as { name: string; website: string | null } | null;
  const result = await findJobDescription({
    company: company?.name ?? "",
    website: company?.website ?? null,
    title: job.title,
    link: job.link,
  });
  if (result.status !== "found") return result.status;
  await admin
    .from("jobs")
    .update({ job_description: withSource(result.description, result.url), ...(job.link ? {} : { link: result.url }) })
    .eq("id", jobId)
    .eq("user_id", userId)
    // Still empty (the user may have pasted one meanwhile).
    .or("job_description.is.null,job_description.eq.");
  return "found";
}

export type LinkLookup =
  | { status: "found"; description: string; title: string; company: string }
  | { status: "never_read" | "not_allowed" | "not_found" };

/**
 * Reads the job description from a link the user pasted in the job form (no search). Same rules:
 * the company's own site, an employer careers site or a hiring system; never LinkedIn or Glassdoor;
 * only the page's structured posting, matching the company and role when they're filled in.
 */
export async function descriptionFromLink({
  link,
  company,
  title,
  website,
}: {
  link: string;
  company: string;
  title: string;
  website: string | null;
}): Promise<LinkLookup> {
  if (!/^https?:\/\//i.test(link) || link.length > 2000) return { status: "not_found" };
  if (isNeverRead(link)) return { status: "never_read" };
  if (!isOwnOrAtsPage(link, company, website)) return { status: "not_allowed" };
  const html = await fetchHtml(link).catch(() => null);
  const posting = html ? postingForLink(html, company, title) : null;
  if (!posting) return { status: "not_found" };
  return {
    status: "found",
    description: withSource(posting.description.slice(0, 29_000), link),
    title: posting.title.slice(0, 200),
    company: posting.company.slice(0, 200),
  };
}
