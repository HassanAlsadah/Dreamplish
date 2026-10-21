import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { geminiConfig } from "@/lib/env.server";
import { BriefingError } from "../errors";
import type { ProviderResult, SourceRef } from "../types";

/*
 * Turns numbered source material into the briefing JSON. The model may only cite
 * source numbers it was given, so every URL in a brief comes from a real search
 * result — never from the model's memory.
 */

const TIMEOUT_MS = 150_000;
const FIRST_TRY_MS = 75_000;

export function geminiClient() {
  const { apiKey } = geminiConfig();
  if (!apiKey) throw new BriefingError("not_configured", "GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

const itemsSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Product or project name (projects only), otherwise empty" },
      text: { type: "string" },
      source_ids: { type: "array", items: { type: "integer" } },
      published_at: { type: "string", description: "YYYY-MM-DD, or empty string if unknown" },
    },
    required: ["text", "source_ids"],
  },
};

const outputJsonSchema = {
  type: "object",
  properties: {
    news: itemsSchema,
    projects: itemsSchema,
    values: itemsSchema,
    skills: itemsSchema,
    salary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string" },
          min: { type: "number", description: "0 if unknown" },
          max: { type: "number", description: "0 if unknown" },
          currency: { type: "string", description: "ISO 4217 code" },
          period: { type: "string", enum: ["year", "month", "hour"] },
          note: { type: "string", description: "Location or other context" },
          quote: { type: "string", description: "The exact sentence from the source that states the figure, copied verbatim" },
          source_ids: { type: "array", items: { type: "integer" } },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["role", "min", "max", "currency", "period", "quote", "source_ids", "confidence"],
      },
    },
    role_duties: {
      type: "array",
      description: "What the requested roles do at this company, from its own job postings (purpose: role)",
      items: {
        type: "object",
        properties: {
          role: { type: "string", description: "Copied exactly from the requested roles" },
          posting_title: { type: "string", description: "The job title exactly as written in the source posting" },
          text: { type: "string", description: "One responsibility, short" },
          quote: { type: "string", description: "Exact sentence from the source" },
          source_ids: { type: "array", items: { type: "integer" } },
        },
        required: ["role", "posting_title", "text", "quote", "source_ids"],
      },
    },
    team_work: {
      type: "array",
      description: "Projects or work the company's teams describe publicly (purpose: team), at team level",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          quote: { type: "string", description: "Exact sentence from the source" },
          published_at: { type: "string", description: "YYYY-MM-DD or empty" },
          source_ids: { type: "array", items: { type: "integer" } },
        },
        required: ["text", "quote", "published_at", "source_ids"],
      },
    },
    team_tools: {
      type: "array",
      description: "Technologies/tools the teams use (one per item)",
      items: {
        type: "object",
        properties: { name: { type: "string" }, source_ids: { type: "array", items: { type: "integer" } } },
        required: ["name", "source_ids"],
      },
    },
    watchouts: {
      type: "array",
      description: "Publicly reported issues about the company (only from sources marked purpose: watchout)",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["layoffs", "legal", "financial", "workplace", "leadership", "reputation"] },
          status: { type: "string", enum: ["reported", "alleged", "confirmed"] },
          text: { type: "string", description: "One or two neutral sentences" },
          quote: { type: "string", description: "The exact sentence from the source, copied verbatim" },
          published_at: { type: "string", description: "YYYY-MM-DD from the source" },
          interview_tip: { type: "string", description: "One tactful question the candidate could ask about it" },
          source_ids: { type: "array", items: { type: "integer" } },
        },
        required: ["category", "status", "text", "quote", "published_at", "interview_tip", "source_ids"],
      },
    },
    summary: {
      type: "object",
      properties: {
        text: { type: "string" },
        source_ids: { type: "array", items: { type: "integer" } },
      },
      required: ["text", "source_ids"],
    },
    links: {
      type: "object",
      properties: {
        website_source_id: { type: "integer", description: "Source number of the company's official website, 0 if none" },
        linkedin_source_id: { type: "integer", description: "Source number of the company's official LinkedIn page, 0 if none" },
      },
      required: ["website_source_id", "linkedin_source_id"],
    },
  },
  required: ["summary", "news", "projects", "values", "skills", "salary", "watchouts", "role_duties", "team_work", "team_tools", "links"],
};

const rawItem = z.object({
  name: z.string().optional(),
  text: z.string(),
  source_ids: z.array(z.number().int()),
  published_at: z.string().optional(),
});
const outputSchema = z.object({
  news: z.array(rawItem),
  projects: z.array(rawItem),
  values: z.array(rawItem),
  skills: z.array(rawItem),
  salary: z.array(
    z.object({
      role: z.string(),
      min: z.number(),
      max: z.number(),
      currency: z.string(),
      period: z.enum(["year", "month", "hour"]),
      note: z.string().optional(),
      quote: z.string(),
      source_ids: z.array(z.number().int()),
      confidence: z.enum(["low", "medium", "high"]),
    }),
  ),
  summary: z.object({ text: z.string(), source_ids: z.array(z.number().int()) }).optional(),
  role_duties: z
    .array(
      z.object({
        role: z.string(),
        posting_title: z.string().default(""),
        text: z.string(),
        quote: z.string(),
        source_ids: z.array(z.number().int()),
      }),
    )
    .default([]),
  team_work: z
    .array(z.object({ text: z.string(), quote: z.string(), published_at: z.string().default(""), source_ids: z.array(z.number().int()) }))
    .default([]),
  team_tools: z.array(z.object({ name: z.string(), source_ids: z.array(z.number().int()) })).default([]),
  watchouts: z
    .array(
      z.object({
        category: z.enum(["layoffs", "legal", "financial", "workplace", "leadership", "reputation"]),
        status: z.enum(["reported", "alleged", "confirmed"]),
        text: z.string(),
        quote: z.string(),
        published_at: z.string(),
        interview_tip: z.string().default(""),
        source_ids: z.array(z.number().int()),
      }),
    )
    .default([]),
  links: z.object({ website_source_id: z.number().int(), linkedin_source_id: z.number().int() }).optional(),
});

type RawSalaryOut = z.infer<typeof outputSchema>["salary"][number];

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Numbers written in a quote: "15,000", "180K", "1.2M" → 15000, 180000, 1200000. */
function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(\d[\d,.]*)\s*([km])?\b/gi)) {
    const base = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;
    const mult = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
    out.push(Math.round(base * mult));
  }
  return out;
}

/**
 * Salary figures are the easiest thing for a model to garble, so they must be backed by a
 * verbatim quote that really appears in a cited excerpt and contains the same numbers.
 * The period is taken from the quote's own wording when it states one.
 */
// Words that describe the kind of job; seniority words don't count.
const SENIORITY = new Set(["junior", "senior", "lead", "principal", "staff", "head", "mid", "associate", "intern", "trainee", "i", "ii", "iii", "sr", "jr"]);
const JOB_FAMILIES = [
  ["engineer", "developer", "programmer", "engineering", "software", "swe"],
  ["designer", "design", "ux", "ui"],
  ["analyst", "analytics", "data"],
  ["manager", "management"],
  ["scientist", "research", "researcher"],
  ["accountant", "accounting", "finance", "financial"],
  ["marketing", "marketer"],
  ["sales"],
  ["qa", "qc", "quality", "tester", "testing"],
];
const QUALITY = new Set(["qa", "qc", "quality", "tester", "testing"]);
const jobWords = (title: string) => squash(title).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !SENIORITY.has(w));

/** True when two job titles are the same kind of job (shared word or same family), e.g. "Software Engineer" ≈ "Junior Developer". */
export function sameKindOfJob(a: string, b: string) {
  const wa = jobWords(a);
  const wb = jobWords(b);
  if (!wa.length || !wb.length) return false;
  // "QC Engineer" is a quality role, not a software engineering one.
  if (wa.some((w) => QUALITY.has(w)) !== wb.some((w) => QUALITY.has(w))) return false;
  const family = (w: string) => JOB_FAMILIES.findIndex((f) => f.includes(w));
  // "Software Engineer" vs "Software Project Manager" share "software", so compare the last (role) word's family too.
  const lastA = family(wa[wa.length - 1]);
  const lastB = family(wb[wb.length - 1]);
  if (lastA >= 0 && lastB >= 0) return lastA === lastB;
  return wa.some((w) => wb.includes(w));
}

const GENERIC_WORDS = new Set(["saudi", "arabia", "company", "group", "the", "and", "corporation", "holding", "limited", "university", "bank"]);

/** Ways the company's name can appear in a page: full name, or a distinctive word of it ("Aramco" in "Saudi Aramco"). */
export function companyMentions(company: string): (text: string) => boolean {
  const full = squash(company);
  const words = full.split(/\s+/).filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
  return (text) => {
    const t = squash(text);
    return t.includes(full) || words.some((w) => t.includes(w));
  };
}

function verifySalary(e: RawSalaryOut, excerpts: string[], mentions: (t: string) => boolean): RawSalaryOut | null {
  const quote = squash(e.quote);
  if (quote.length < 8) return null;
  // The quote must be in a cited source, and that source must actually be about this company.
  const inSource = e.source_ids.some((id) => {
    const text = excerpts[id - 1] ?? "";
    return squash(text).includes(quote) && mentions(text);
  });
  if (!inSource) return null;
  const nums = numbersIn(quote);
  if ((e.min > 0 && !nums.includes(Math.round(e.min))) || (e.max > 0 && !nums.includes(Math.round(e.max)))) return null;
  const period = /\b(year|yearly|annual|annually|annum|yr)\b/.test(quote)
    ? "year"
    : /\b(month|monthly|mo)\b/.test(quote)
      ? "month"
      : /\b(hour|hourly|hr)\b/.test(quote)
        ? "hour"
        : e.period;
  return { ...e, period };
}

const RULES = `Rules:
- Use ONLY information stated in the material below. Never add facts, numbers or dates from memory.
- Cite every item with the source numbers it came from in "source_ids" (S3 → 3). Never cite a source that doesn't support the item.
- If material is about a different organisation with a similar name, ignore it.
- If a section has no supporting material, return an empty array for it.
- Keep each "text" short (under 240 characters, except summary), neutral and factual, in English.
- role_duties: for each requested role, up to 6 responsibilities of that role AT THIS COMPANY, from its job postings or
  careers pages (any job board is fine). If there is no posting with that exact title, use the closest equivalent title at
  the same company (e.g. "Software Engineer" for "Junior Software Engineer"), but not an unrelated role. "role" copied exactly from the requested roles; "quote" =
  exact sentence from the source.
- team_work: up to 5 projects or kinds of work the company's teams (relevant to the role) have described publicly — engineering
  blogs, case studies, talks, press. Describe them at TEAM or COMPANY level only: NEVER name, quote or describe individual
  employees. "quote" = exact sentence from the source.
- team_tools: technologies the company's teams use, from postings or team posts, one per item.
- watchouts: issues a job seeker should know that the company rarely publicises — layoffs/restructuring, lawsuits,
  fines, investigations, financial trouble, labour disputes, safety incidents, sudden leadership exits, data breaches,
  recalls. Rules: only from results marked "purpose: watchout" that clearly concern THIS company; "quote" = the exact
  sentence copied from that source; published_at = the source date (skip the item if unknown); neutral factual wording
  with no judgemental adjectives; never name or blame individual employees. status: "confirmed" only for court rulings,
  paid fines, official statements or completed layoffs; "alleged" for accusations, lawsuits in progress or unproven claims;
  otherwise "reported". interview_tip: one polite question the candidate could ask about it. Empty array if none.
- summary: one paragraph of 3–4 sentences giving an overview of the company — what it does, its sector and scale,
  and its current direction — using only the material, citing every source used. Empty text if the material is too thin.
- news: notable news about the company. published_at = the source's date as YYYY-MM-DD if known, otherwise "".
- projects: main products, services or projects. "name" = the product/project name as the company writes it,
  "text" = a one- or two-sentence description of what it is or does.
- values: values and culture as the company describes them (prefer its own pages).
- skills: one skill or tool per item, taken from job postings.
- links: the source number of the company's own official website and of its official LinkedIn company page
  (linkedin.com/company/...), or 0 if not clearly present. Never pick a different company's page.
- salary: "quote" must be the exact sentence from the source containing the figure, copied character for character.
  Only figures a source states for THIS company (the source must name it) — never general market or other companies' salaries.
  Only salaries for jobs in SAUDI ARABIA — skip figures for any other country. Prefer SAR; put the Saudi city or "Saudi Arabia" in "note".
  Only for the requested roles, at most one entry each. Copy "role" EXACTLY as written in the request
  (even if abbreviated); use figures for the same or an equivalent job title at this company. Skip a role with no stated figure.
  min/max as plain numbers (0 if only one bound is known). Put the location and the exact title the figure refers to in "note".
  confidence: "high" only if several consistent sources agree, "medium" for one reputable source, otherwise "low".`;

function classify(error: unknown): never {
  if (error instanceof BriefingError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timeout|timed out/i.test(message)) throw new BriefingError("timeout", message);
  if (/"code":\s*(429|503)|quota|rate|high demand|unavailable/i.test(message)) throw new BriefingError("rate_limited", message);
  if (/API key|"code":\s*(401|403)|permission/i.test(message)) throw new BriefingError("not_configured", message);
  throw new BriefingError("provider_error", message);
}

/** Overloaded models (503/429) are common on the free tier — try the fallback model once. */
async function generateJson(ai: GoogleGenAI, contents: string) {
  const { model, fallbackModel } = geminiConfig();
  const models = fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];
  let lastError: unknown;
  for (const m of models) {
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: outputJsonSchema,
          temperature: 0,
          // The first model gets less time so a stalled request still leaves room for the fallback.
          abortSignal: AbortSignal.timeout(m === models[0] && models.length > 1 ? FIRST_TRY_MS : TIMEOUT_MS),
        },
      });
      return res.text ?? "";
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/"code":\s*(429|503)|high demand|unavailable|abort|timeout|timed out/i.test(msg)) break;
    }
  }
  classify(lastError);
}

export async function structureBrief({
  provider,
  task,
  material,
  sources,
  excerpts,
  companyName,
  searchSuggestions = null,
}: {
  provider: string;
  /** What to extract, e.g. company name and roles. */
  task: string;
  /** Source material with [S#] numbering already applied. */
  material: string;
  sources: SourceRef[];
  /** Raw text of each source (same order). When given, salary quotes are verified against it. */
  excerpts?: string[];
  /** Used to reject salary figures whose source isn't about this company. */
  companyName?: string;
  searchSuggestions?: string | null;
}): Promise<ProviderResult> {
  const ai = geminiClient();
  let text: string;
  try {
    text = await generateJson(ai, `${task}\n\n${RULES}\n\n${material}`);
  } catch (e) {
    classify(e);
  }

  let parsed: z.infer<typeof outputSchema>;
  try {
    parsed = outputSchema.parse(JSON.parse(text));
  } catch (e) {
    throw new BriefingError("invalid_output", e instanceof Error ? e.message : "unparseable JSON");
  }

  const pick = (ids: number[]) =>
    [...new Set(ids)].filter((id) => id >= 1 && id <= sources.length && sources[id - 1]?.url).map((id) => sources[id - 1]);
  const items = (list: z.infer<typeof rawItem>[]) =>
    list.map((i) => ({ name: i.name || null, text: i.text, sources: pick(i.source_ids), publishedAt: i.published_at || null }));

  return {
    provider,
    news: items(parsed.news),
    projects: items(parsed.projects),
    values: items(parsed.values),
    skills: items(parsed.skills),
    salary: parsed.salary.flatMap((raw) => {
      const s = excerpts ? verifySalary(raw, excerpts, companyMentions(companyName ?? "")) : raw;
      if (!s) return [];
      const quote = s.quote.trim().replace(/\s+/g, " ").slice(0, 180);
      return [{ ...s, note: [s.note?.trim(), quote && `“${quote}”`].filter(Boolean).join(" · "), sources: pick(s.source_ids) }];
    }),
    searchSuggestions,
    // Watch-outs need a verbatim quote from a cited source that names the company.
    watchouts: excerpts
      ? parsed.watchouts
          .filter((w) =>
            w.source_ids.some((id) => {
              const text = excerpts[id - 1] ?? "";
              return squash(text).includes(squash(w.quote)) && squash(w.quote).length >= 15 && companyMentions(companyName ?? "")(text);
            }),
          )
          .map((w) => ({ ...w, sources: pick(w.source_ids) }))
      : undefined,
    roleInsights: excerpts
      ? (() => {
          const about = companyMentions(companyName ?? "");
          // Quote must be in a cited source that names the company.
          const backed = (quote: string, ids: number[]) =>
            squash(quote).length >= 15 &&
            ids.some((id) => {
              const text = excerpts[id - 1] ?? "";
              return squash(text).includes(squash(quote)) && about(text);
            });
          return {
            duties: parsed.role_duties
              // The posting's title must be in the source AND be the same kind of job as the requested role.
              .filter((d) => sameKindOfJob(d.posting_title, d.role) && d.source_ids.some((id) => squash(excerpts[id - 1] ?? "").includes(squash(d.posting_title))))
              .filter((d) => backed(d.quote, d.source_ids))
              .map((d) => ({ role: d.role, text: d.text, quote: d.quote, sources: pick(d.source_ids) })),
            team_work: parsed.team_work
              .filter((t) => backed(t.quote, t.source_ids))
              .map((t) => ({ text: t.text, quote: t.quote, published_at: t.published_at || null, sources: pick(t.source_ids) })),
            tools: parsed.team_tools.map((t) => ({ text: t.name, sources: pick(t.source_ids) })),
          };
        })()
      : undefined,
    summary: parsed.summary?.text.trim()
      ? { text: parsed.summary.text, sources: pick(parsed.summary.source_ids), publishedAt: null }
      : null,
    links: {
      website: sources[(parsed.links?.website_source_id ?? 0) - 1]?.url ?? null,
      linkedin: sources[(parsed.links?.linkedin_source_id ?? 0) - 1]?.url ?? null,
    },
  };
}

export { classify as classifyProviderError };
