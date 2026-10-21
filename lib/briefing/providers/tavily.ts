import "server-only";
import { tavilyApiKey } from "@/lib/env.server";
import { BriefingError } from "../errors";
import type { ProviderResult, ResearchInput, SourceRef } from "../types";
import { structureBrief } from "./structure";

/*
 * Free-tier pipeline: a handful of Tavily searches (1 credit each) collect real pages,
 * then Gemini writes the brief using only those numbered excerpts.
 */

const ENDPOINT = "https://api.tavily.com/search";
const EXCLUDE = ["linkedin.com", "glassdoor.com", "glassdoor.co.uk", "glassdoor.ca", "glassdoor.co.in"];
const MAX_SALARY_ROLES = 3;
const EXCERPT_CHARS = 1500;

type Purpose = "news" | "products" | "values" | "jobs" | "salary" | "website" | "watchout" | "role" | "team";
const SOCIAL = ["reddit.com", "quora.com", "x.com", "twitter.com", "facebook.com", "instagram.com", "tiktok.com", "youtube.com", "medium.com"];
type TavilyResult = { title: string; url: string; content: string; published_date?: string | null };
type Found = TavilyResult & { purpose: Purpose; role?: string };

async function search(body: Record<string, unknown>): Promise<TavilyResult[]> {
  const key = tavilyApiKey();
  if (!key) throw new BriefingError("not_configured", "TAVILY_API_KEY is not set");
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ search_depth: "basic", max_results: 5, exclude_domains: EXCLUDE, ...body }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new BriefingError("timeout", e instanceof Error ? e.message : "Tavily request failed");
  }
  if (res.status === 401 || res.status === 403) throw new BriefingError("not_configured", `Tavily ${res.status}`);
  if (res.status === 429 || res.status === 432 || res.status === 433) throw new BriefingError("rate_limited", `Tavily ${res.status}`);
  if (!res.ok) throw new BriefingError("provider_error", `Tavily ${res.status}`);
  const json = (await res.json()) as { results?: TavilyResult[] };
  return json.results ?? [];
}

function domainOf(website: string | null) {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isoDate(value: string | null | undefined) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function tavilyResearch(input: ResearchInput): Promise<ProviderResult> {
  const company = input.companyName;
  const domain = domainOf(input.website);
  const since = new Date(Date.parse(input.today) - 92 * 86_400_000).toISOString().slice(0, 10);
  const since24 = new Date(Date.parse(input.today) - 730 * 86_400_000).toISOString().slice(0, 10);
  // Prefer the company's own site for products and values, but don't require it.
  const own = domain ? { include_domains: [domain], include_domains_mode: "prefer" } : {};
  const roles = input.roles.slice(0, MAX_SALARY_ROLES);

  const jobs: Array<Promise<Found[]>> = [
    search({ query: `"${company}" news`, topic: "news", start_date: since }).then((r) =>
      r.map((x) => ({ ...x, purpose: "news" as const })),
    ),
    search({ query: `${company} products services projects`, ...own }).then((r) =>
      r.map((x) => ({ ...x, purpose: "products" as const })),
    ),
    search({ query: `${company} company values culture mission`, ...own }).then((r) =>
      r.map((x) => ({ ...x, purpose: "values" as const })),
    ),
    search({ query: `${company} careers job openings requirements skills` }).then((r) =>
      r.map((x) => ({ ...x, purpose: "jobs" as const })),
    ),
    ...(domain
      ? []
      : [
          search({ query: `${company} official website`, max_results: 3 }).then((r) =>
            r.map((x) => ({ ...x, purpose: "website" as const })),
          ),
        ]),
    // The role at this company: its own postings for the same role, plus public team work.
    ...roles.map((role) =>
      // No quotes around the title, so job boards with a close title (e.g. "Software Engineer") still match.
      search({ query: `${company} ${role} job description responsibilities`, max_results: 5, exclude_domains: [...EXCLUDE, ...SOCIAL] }).then(
        (r) => r.map((x) => ({ ...x, purpose: "role" as const, role })),
      ),
    ),
    search({
      query: `${company} team engineering blog OR case study OR project OR talk`,
      max_results: 5,
      exclude_domains: [...EXCLUDE, ...SOCIAL],
    }).then((r) => r.map((x) => ({ ...x, purpose: "team" as const }))),
    // Watch-outs: reputable news from the last 24 months (English + Arabic), no forums or social media.
    ...[
      `"${company}" layoffs OR lawsuit OR fine OR investigation OR scandal OR "data breach"`,
      `"${company}" losses OR debt OR restructuring OR "profit warning" OR resigns`,
      `"${company}" غرامة OR قضية OR تسريح OR تحقيق OR مخالفة OR خسائر`,
    ].map((query) =>
      search({ query, topic: "news", start_date: since24, max_results: 5, exclude_domains: [...EXCLUDE, ...SOCIAL] }).then((r) =>
        r.map((x) => ({ ...x, purpose: "watchout" as const })),
      ),
    ),
    ...roles.map((role) =>
      search({ query: `${role} salary at ${company} in Saudi Arabia`, country: "saudi arabia", max_results: 4 }).then((r) =>
        r.map((x) => ({ ...x, purpose: "salary" as const, role })),
      ),
    ),
  ];

  // One failed search shouldn't sink the whole brief; if all fail, surface the error.
  const settled = await Promise.allSettled(jobs);
  const failures = settled.filter((s): s is PromiseRejectedResult => s.status === "rejected");
  if (failures.length === settled.length) throw failures[0].reason;

  const seen = new Set<string>();
  const found: Found[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const r of s.value) {
      if (!r.url || !r.content || seen.has(r.url)) continue;
      seen.add(r.url);
      found.push(r);
    }
  }

  if (found.length === 0) {
    return { provider: "tavily", news: [], projects: [], values: [], skills: [], salary: [], searchSuggestions: null };
  }

  const sources: SourceRef[] = found.map((r) => ({ url: r.url, title: r.title || new URL(r.url).hostname }));
  const material = found
    .map((r, i) => {
      const date = isoDate(r.published_date);
      const meta = [
        `purpose: ${r.purpose}${r.role ? ` (${r.role})` : ""}`,
        `site: ${new URL(r.url).hostname.replace(/^www\./, "")}`,
        date ? `published: ${date}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `[S${i + 1}] ${r.title}\n${meta}\n${r.content.slice(0, EXCERPT_CHARS)}`;
    })
    .join("\n\n");

  const task = `Write a company briefing for "${company}"${domain ? ` (official website: ${domain})` : ""}, as of ${
    input.today
  }, from the numbered search results below.
News must be from ${since} or later; watch-outs from ${since24} or later. Salaries must be for Saudi Arabia only. Salary roles to look for: ${roles.length ? roles.map((r) => `"${r}"`).join(", ") : "(none)"}.`;

  const result = await structureBrief({
    provider: "tavily",
    task,
    material: `Search results:\n\n${material}`,
    sources,
    // Title + text, so a page titled "Aramco salaries" counts as being about Aramco.
    excerpts: found.map((r) => `${r.title}\n${r.content.slice(0, EXCERPT_CHARS)}`),
    companyName: company,
  });

  // A website found by search is only trusted if its domain matches the company name
  // (e.g. kfupm.edu.sa for "KFUPM") — better no link than a news site as "official website".
  const picked = domainOf(result.links?.website ?? null);
  const nameKeys = [norm(company), ...company.split(/\s+/).map(norm).filter((w) => w.length >= 4)];
  const pickedOk = picked && nameKeys.some((k) => k.length >= 3 && norm(picked.split(".")[0]).includes(k.slice(0, 12)));
  // Fallback: a search result whose own domain matches the company name (e.g. aramco.com for "Aramco").
  const matches = (d: string | null) =>
    Boolean(d) && nameKeys.some((k) => k.length >= 3 && norm(d!.split(".")[0]).includes(k.slice(0, 12)));
  const fromResults = found
    .slice()
    .sort((a, b) => Number(b.purpose === "website") - Number(a.purpose === "website"))
    .map((r) => domainOf(r.url))
    .find(matches);
  if (!domain) {
    result.links = {
      ...result.links,
      website: pickedOk ? result.links!.website : fromResults ? `https://${fromResults}` : null,
    };
  }
  // LinkedIn is read from the official website by the worker, never guessed from search results.
  return { ...result, links: { website: result.links?.website ?? null, linkedin: null } };
}
