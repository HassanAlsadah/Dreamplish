/*
 * Reading a job email's HTML body, locally (nothing here is sent anywhere):
 *  - plain text, so the classifier sees more than Outlook's short preview
 *  - the job posting link (and its link text, which is the role in LinkedIn emails)
 *  - a job description, when the email itself contains one
 */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** HTML entities → characters, and invisible direction / zero-width marks removed. */
export function decode(s: string) {
  return s
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (m, e: string) => {
      const k = e.toLowerCase();
      if (k in ENTITIES) return ENTITIES[k];
      if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16));
      if (k.startsWith("#")) return String.fromCodePoint(Number(k.slice(1)));
      return m;
    })
    .replace(/[\u200b-\u200f\u2028\u202a-\u202e\u2060\ufeff]/g, "");
}

/** HTML → readable text with line breaks between blocks. */
export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6]|table|td)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Anchor = { href: string; text: string };

function anchors(html: string): Anchor[] {
  const out: Anchor[] = [];
  const re = /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (let m; (m = re.exec(html)); ) out.push({ href: decode(m[2]).trim(), text: htmlToText(m[3]).replace(/\s+/g, " ").trim() });
  return out;
}

/** Job posting pages on LinkedIn and common hiring sites. */
const LINKEDIN_JOB = /^https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(?:comm\/)?jobs\/view\/(?:[^/?#]*-)?(\d{6,})/i;
const ATS_JOB =
  /^https?:\/\/(?:[\w-]+\.)*(?:greenhouse\.io|lever\.co|myworkdayjobs\.com|smartrecruiters\.com|workable\.com|ashbyhq\.com|bamboohr\.com|recruitee\.com|teamtailor\.com|jobvite\.com|icims\.com|bayt\.com|naukrigulf\.com|indeed\.com)\/\S*(?:job|position|opening|vacanc|career|viewjob)/i;
/** Button texts that aren't a job title. */
const GENERIC = /^(view|see|open|apply|review|track|check)\b|^(job|details|more|here|link)$|عرض|تفاصيل|قدّم|قدم/i;

function cleanJobUrl(href: string): string | null {
  const li = href.match(LINKEDIN_JOB);
  if (li) return `https://www.linkedin.com/jobs/view/${li[1]}/`;
  if (!ATS_JOB.test(href)) return null;
  try {
    const url = new URL(href);
    // Drop tracking parameters; keep the ones that identify the job (e.g. Indeed's jk).
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|trk|tracking|ref|src|source|mc_|e$|lipi)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().slice(0, 2000);
  } catch {
    return null;
  }
}

/** The first job posting link in the email, and its link text if that looks like a job title. */
export function findJobLink(html: string): { url: string; title: string | null } | null {
  let found: { url: string; title: string | null } | null = null;
  for (const a of anchors(html)) {
    const url = cleanJobUrl(a.href);
    if (!url) continue;
    const title = a.text && a.text.length <= 120 && !GENERIC.test(a.text) ? a.text : null;
    if (!found) found = { url, title };
    else if (found.url === url && !found.title && title) found.title = title;
    // Later links are usually "similar jobs" recommendations — stop at the first job's links.
    if (found.url !== url) break;
  }
  return found;
}

const DESCRIPTION_START =
  /^(job description|description|about the (role|job|position)|the role|role overview|responsibilities|key responsibilities|what you('| wi)ll do|الوصف الوظيفي|وصف الوظيفة|المهام|المسؤوليات)\s*:?\s*$/im;
const DESCRIPTION_END = /^(unsubscribe|privacy|terms|©|copyright|you are receiving|this email was sent|إلغاء الاشتراك)/im;

/** A job description written in the email itself (some ATS confirmations include it); null otherwise. */
export function findDescription(text: string): string | null {
  const start = text.search(DESCRIPTION_START);
  if (start < 0) return null;
  let rest = text.slice(start);
  const end = rest.slice(1).search(DESCRIPTION_END);
  if (end >= 0) rest = rest.slice(0, end + 1);
  rest = rest.trim();
  return rest.length >= 300 ? rest.slice(0, 30000) : null;
}
