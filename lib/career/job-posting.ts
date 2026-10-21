import { companyMentions, sameKindOfJob } from "@/lib/briefing/providers/structure";
import { decode, htmlToText } from "@/lib/email/body";

/*
 * Reading a job posting page: career sites and hiring systems publish the posting as structured
 * data (schema.org JobPosting, for Google Jobs) with the title, company and description. Only that
 * is used — never a guess from the page's other text — and only when it names the same company
 * and the same role as the job.
 */

export type Posting = { title: string; company: string; description: string; url: string | null };

/** Hiring systems companies use for their own postings (not job boards or aggregators). */
const ATS_HOSTS =
  /(^|\.)(greenhouse\.io|lever\.co|myworkdayjobs\.com|myworkdaysite\.com|workday\.com|smartrecruiters\.com|workable\.com|ashbyhq\.com|bamboohr\.com|recruitee\.com|teamtailor\.com|jobvite\.com|icims\.com|successfactors\.(com|eu)|taleo\.net|oraclecloud\.com|zohorecruit\.com|breezy\.hr|jobs\.personio\.(de|com))$/i;
/** Never used, whatever the page says: LinkedIn, Glassdoor, and job boards that copy postings. */
const BLOCKED_HOSTS =
  /(^|\.)(linkedin\.com|glassdoor\.[a-z.]+|indeed\.[a-z.]+|bayt\.com|naukrigulf\.com|careerjet\.[a-z.]+|jobleads\.com|tanqeeb\.com|ziphire\.hr|zoominfo\.com|wellfound\.com|jooble\.org|talent\.com|simplyhired\.com|monster\.[a-z.]+|gulftalent\.com|zerotaxjobs\.com)$/i;

/**
 * The company's own site (its website's domain, or its name in the host), an employer careers site
 * (careers.… / jobs.… — e.g. a parent company's, like Delivery Hero for HungerStation), or a hiring
 * system. Whether the posting is really this company's job is checked on its content.
 */
export function isOwnOrAtsPage(url: string, company: string, website: string | null): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (BLOCKED_HOSTS.test(host)) return false;
  if (ATS_HOSTS.test(host)) return true;
  if (website) {
    try {
      const own = new URL(website).hostname.toLowerCase().replace(/^www\./, "");
      if (host === own || host.endsWith(`.${own}`)) return true;
    } catch {
      // ignore a bad website value
    }
  }
  const name = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (name.length >= 4 && host.replace(/[^a-z0-9]/g, "").includes(name)) return true;
  return /^(careers?|jobs)\./.test(host);
}

const SENIORITY = new Set(["junior", "senior", "lead", "principal", "staff", "head", "mid", "associate", "intern", "trainee", "sr", "jr", "i", "ii", "iii"]);
const words = (t: string) =>
  t
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff]+/)
    .filter((w) => w.length > 1 && !SENIORITY.has(w));

/** Same role: most of the title's words match (seniority ignored) and it's the same kind of job. */
export function sameRole(a: string, b: string): boolean {
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  if (!wa.size || !wb.size) return false;
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.min(wa.size, wb.size) >= 0.75 && (sameKindOfJob(a, b) || shared === Math.min(wa.size, wb.size));
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "name" in value) return asText((value as { name: unknown }).name);
  return "";
}

/** JobPosting entries in the page's JSON-LD scripts. */
export function parsePostings(html: string): Posting[] {
  const out: Posting[] = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (let m; (m = re.exec(html)); ) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const queue: unknown[] = [data];
    while (queue.length) {
      const item = queue.shift();
      if (Array.isArray(item)) {
        queue.push(...item);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      if (Array.isArray(obj["@graph"])) queue.push(...obj["@graph"]);
      const type = obj["@type"];
      const isPosting = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
      if (!isPosting) continue;
      const raw = typeof obj.description === "string" ? obj.description : "";
      // Some sites entity-encode the description's HTML ("&lt;p&gt;…").
      const description = htmlToText(/&lt;\/?[a-z]/i.test(raw) ? decode(raw) : raw);
      out.push({
        title: asText(obj.title).trim(),
        company: asText(obj.hiringOrganization).trim(),
        description,
        url: typeof obj.url === "string" ? obj.url : null,
      });
    }
  }
  return out;
}

/**
 * The posting on this page for this company and role, with a real description; null otherwise.
 * The company must be the hiring organisation, or be named in the description (a group / parent
 * company's careers site, e.g. "Delivery Hero" posting a HungerStation role).
 */
export function matchingPosting(html: string, company: string, title: string): Posting | null {
  const mentions = companyMentions(company);
  return (
    parsePostings(html).find(
      (p) =>
        p.description.length >= 200 &&
        sameRole(p.title, title) &&
        ((p.company && (mentions(p.company) || companyMentions(p.company)(company))) || mentions(p.description)),
    ) ?? null
  );
}

/** LinkedIn and Glassdoor: never read (their terms, and the app's rule). */
export function isNeverRead(url: string): boolean {
  try {
    return /(^|\.)(linkedin\.com|glassdoor\.[a-z.]+)$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * The posting on a page the user linked to. With company and role filled in, it must match them
 * (as above); a field still empty (a new job) isn't checked, and is filled from the posting instead.
 */
export function postingForLink(html: string, company: string, title: string): Posting | null {
  if (company.trim() && title.trim()) return matchingPosting(html, company, title);
  const mentions = company.trim() ? companyMentions(company) : null;
  return (
    parsePostings(html).find(
      (p) =>
        p.description.length >= 200 &&
        (!title.trim() || sameRole(p.title, title)) &&
        (!mentions || (p.company && (mentions(p.company) || companyMentions(p.company)(company))) || mentions?.(p.description)),
    ) ?? null
  );
}
