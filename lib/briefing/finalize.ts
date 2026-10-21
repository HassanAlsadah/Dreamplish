import type {
  RoleInsights,
  Watchouts,
  Confidence,
  ProviderResult,
  RawItem,
  SalaryEntry,
  Section,
  SectionKey,
  SourceRef,
} from "./types";

// Excluded by product rules: no LinkedIn or Glassdoor data.
const BLOCKED_HOSTS = [
  /(^|\.)linkedin\.com$/i,
  /(^|\.)glassdoor\.[a-z.]+$/i,
  // Forums and social media aren't reputable enough for facts about a company.
  /(^|\.)(reddit|quora|x|twitter|facebook|instagram|tiktok|youtube)\.com$/i,
];
const WATCHOUT_MAX_AGE_DAYS = 730;
const NEWS_MAX_AGE_DAYS = 100;
const MAX_TEXT = 400;

function cleanSources(sources: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const s of sources) {
    let url: URL;
    try {
      url = new URL(s.url);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (BLOCKED_HOSTS.some((re) => re.test(url.hostname))) continue;
    const key = url.href;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: url.href, title: (s.title || url.hostname.replace(/^www\./, "")).slice(0, 120) });
  }
  return out;
}

function validDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function toSection(items: RawItem[], opts: { news?: boolean; today: Date; maxText?: number }): Section {
  const out = [];
  for (const item of items) {
    const text = item.text.trim().slice(0, opts.maxText ?? MAX_TEXT);
    const sources = cleanSources(item.sources);
    // A fact without a usable source is dropped, never shown as a guess.
    if (!text || sources.length === 0) continue;
    const published = validDate(item.publishedAt ?? null);
    if (opts.news && published) {
      const ageDays = (opts.today.getTime() - Date.parse(published)) / 86_400_000;
      if (ageDays > NEWS_MAX_AGE_DAYS || ageDays < -2) continue;
    }
    const name = item.name?.trim().slice(0, 80) || null;
    out.push({ name, text, sources, published_at: published });
  }
  if (opts.news) out.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  return { status: out.length ? "found" : "not_found", items: out };
}

/** Confidence can't exceed what the number of independent sources supports. */
function capConfidence(claimed: Confidence, sourceCount: number): Confidence {
  const order: Confidence[] = ["low", "medium", "high"];
  const max: Confidence = sourceCount >= 3 ? "high" : sourceCount === 2 ? "medium" : "low";
  return order[Math.min(order.indexOf(claimed), order.indexOf(max))];
}

// Salary estimates are for Saudi Arabia only.
const SAUDI = /\b(saudi|ksa|riyadh|jeddah|jiddah|dammam|dhahran|khobar|makkah|mecca|madinah|medina|neom|tabuk)\b|السعودية|الرياض|جدة|الدمام|الظهران|الخبر/i;

function toSalary(entries: ProviderResult["salary"], roles: string[]): SalaryEntry[] {
  const requested = new Map(roles.map((r) => [normalizeRole(r), r]));
  const out: SalaryEntry[] = [];
  for (const e of entries) {
    // Only roles someone actually tracks; one entry per role.
    const role = requested.get(normalizeRole(e.role));
    if (!role || out.some((o) => o.role === role)) continue;
    const sources = cleanSources(e.sources);
    const min = e.min && e.min > 0 ? e.min : null;
    const max = e.max && e.max > 0 ? e.max : null;
    if (!sources.length || (!min && !max)) continue;
    const isSaudi = (e.currency || "").toUpperCase() === "SAR" || SAUDI.test(`${e.note ?? ""}`);
    if (!isSaudi) continue;
    out.push({
      role,
      min: min && max ? Math.min(min, max) : min,
      max: min && max ? Math.max(min, max) : max,
      currency: (e.currency || "").toUpperCase().slice(0, 3) || "USD",
      period: e.period,
      note: (e.note ?? "").trim().slice(0, 300),
      sources,
      confidence: capConfidence(e.confidence, sources.length),
    });
  }
  return out;
}

/** Official site → its origin; LinkedIn → a canonical company-page URL. Anything else is dropped. */
function cleanLinks(links: ProviderResult["links"]) {
  let website: string | null = null;
  let linkedin: string | null = null;
  try {
    const u = links?.website ? new URL(links.website) : null;
    if (u && /^https?:$/.test(u.protocol) && !BLOCKED_HOSTS.some((re) => re.test(u.hostname))) website = u.origin;
  } catch {}
  const m = links?.linkedin?.match(/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/(company|school|showcase)\/([^/?#]+)/i);
  if (m) linkedin = `https://www.linkedin.com/${m[2].toLowerCase()}/${m[3]}`;
  return { website, linkedin };
}

function toWatchouts(items: ProviderResult["watchouts"], today: Date): Watchouts | null {
  if (!items) return null;
  const out = [];
  for (const w of items) {
    const sources = cleanSources(w.sources);
    const date = validDate(w.published_at);
    const text = w.text.trim().slice(0, MAX_TEXT);
    // Must be sourced, dated and within the last 24 months.
    if (!text || !sources.length || !date) continue;
    const ageDays = (today.getTime() - Date.parse(date)) / 86_400_000;
    if (ageDays > WATCHOUT_MAX_AGE_DAYS || ageDays < -2) continue;
    out.push({
      category: w.category,
      status: w.status,
      text,
      quote: w.quote.trim().slice(0, 300),
      published_at: date,
      interview_tip: (w.interview_tip ?? "").trim().slice(0, 240),
      sources,
    });
  }
  out.sort((a, b) => b.published_at.localeCompare(a.published_at));
  return { status: out.length ? "found" : "not_found", items: out.slice(0, 8) };
}

function toRoleInsights(raw: ProviderResult["roleInsights"], roles: string[], today: Date): RoleInsights | null {
  if (!raw) return null;
  const requested = new Map(roles.map((r) => [normalizeRole(r), r]));
  const duties = raw.duties
    .map((d) => ({ ...d, role: requested.get(normalizeRole(d.role)) ?? "", sources: cleanSources(d.sources) }))
    .filter((d) => d.role && d.text.trim() && d.sources.length)
    .slice(0, 15)
    .map((d) => ({ role: d.role, text: d.text.trim().slice(0, MAX_TEXT), quote: d.quote.trim().slice(0, 300), sources: d.sources }));
  const team_work = raw.team_work
    .map((t) => ({ ...t, sources: cleanSources(t.sources), published_at: validDate(t.published_at) }))
    .filter((t) => t.text.trim() && t.sources.length)
    // Team work older than ~3 years says little about the team today.
    .filter((t) => !t.published_at || (today.getTime() - Date.parse(t.published_at)) / 86_400_000 < 1100)
    .slice(0, 6)
    .map((t) => ({ text: t.text.trim().slice(0, MAX_TEXT), quote: t.quote.trim().slice(0, 300), published_at: t.published_at, sources: t.sources }));
  const seen = new Set<string>();
  const tools = raw.tools
    .map((t) => ({ text: t.text.trim().slice(0, 40), sources: cleanSources(t.sources) }))
    .filter((t) => t.text && t.sources.length && !seen.has(t.text.toLowerCase()) && seen.add(t.text.toLowerCase()))
    .slice(0, 15);
  return { duties, team_work, tools };
}

export function finalizeBrief(result: ProviderResult, roles: string[], today = new Date()) {
  const sections: Record<SectionKey, Section> = {
    news: toSection(result.news, { news: true, today }),
    projects: toSection(result.projects, { today }),
    values: toSection(result.values, { today }),
    skills: toSection(result.skills, { today }),
  };
  const salary = toSalary(result.salary, roles);

  const all = [...(result.summary?.sources ?? []), ...Object.values(sections).flatMap((s) => s.items.flatMap((i) => i.sources)), ...salary.flatMap((s) => s.sources)];
  const sources = cleanSources(all);

  // The overview is a paragraph, not a single fact — allow more room.
  const summarySection = result.summary ? toSection([result.summary], { today, maxText: 1200 }) : null;
  const summary = summarySection?.items[0] ?? null;

  const watchouts = toWatchouts(result.watchouts, today);
  const roleInsights = toRoleInsights(result.roleInsights, roles, today);
  const allSources = cleanSources([
    ...sources,
    ...(watchouts?.items.flatMap((w) => w.sources) ?? []),
    ...(roleInsights ? [...roleInsights.duties, ...roleInsights.team_work, ...roleInsights.tools].flatMap((x) => x.sources) : []),
  ]);

  return { sections, salary, sources: allSources, links: cleanLinks(result.links), summary, watchouts, roleInsights };
}

export function normalizeRole(role: string) {
  return role.trim().toLowerCase().replace(/\s+/g, " ");
}
