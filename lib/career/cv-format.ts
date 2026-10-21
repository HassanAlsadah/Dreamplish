/**
 * Turns a plain-text CV into sections for rendering, keeping the original structure:
 * first line = name, lines before the first heading = contact line, UPPERCASE lines = headings,
 * "•"/"-" lines = bullets. In entry sections (education, experience, projects, certifications) each
 * entry has a title with its dates / location shown on the right.
 */
export type CvBlock =
  | { type: "name"; text: string }
  | { type: "header"; text: string }
  | { type: "heading"; text: string }
  | { type: "title"; text: string; meta: string[]; entry: boolean }
  | { type: "bullet"; text: string }
  | { type: "meta"; text: string }
  | { type: "para"; text: string }
  | { type: "space" };

// "•Text" (no space) is common in CVs exported from Word/PDF; "-" and "*" need a space.
const BULLET = /^\s*(?:[•▪●◦·]\s*|[-*–]\s+)/;
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE = `(?:(?:${MONTH}\\s*)?(?:\\d{1,2}[/.\\-])?(?:19|20)\\d{2})`;
const NOW = "(?:present|now|current|today|الآن|حتى الآن)";
/** A line that is only a date or a date range, e.g. "08/2021 – 05/2026", "Jun 2025 - Present". */
const DATE_ONLY = new RegExp(`^\\(?\\s*${DATE}(?:\\s*(?:[-–—]|to|إلى)\\s*(?:${DATE}|${NOW}))?\\s*\\)?$`, "i");
const ENTRY_SECTIONS = /experience|employment|work|education|project|volunteer|internship|خبر|تعليم|مشروع|مشاريع|تطوع|تدريب/i;
const LIST_SECTIONS = /certif|course|award|licen|honou?r|achievement|شهاد|دورات|جوائز/i;
const KNOWN_PLACES =
  /\b(saudi arabia|ksa|riyadh|jeddah|dammam|dhahran|khobar|makkah|madinah|neom|uae|united arab emirates|dubai|abu dhabi|qatar|doha|bahrain|kuwait|oman|muscat|egypt|cairo|jordan|amman|singapore|usa|united states|uk|united kingdom|london|canada|germany|india|remote|hybrid)\b|السعودية|الرياض|جدة|الدمام|الظهران|الخبر|الإمارات|دبي|قطر|مصر|عن بعد/i;
/** A trailing year, e.g. "PMI 2025" → 2025. */
const TRAILING_YEAR = /[\s,]*\(?((?:19|20)\d{2}(?:\s*[-–]\s*(?:(?:19|20)\d{2}|present))?)\)?\s*$/i;

function isHeading(line: string, prevBlank: boolean, nextLine: string | undefined) {
  const t = line.trim().replace(/:$/, "");
  // Headings never contain numbers ("GPA: 3.44/4.00" is content, not a heading).
  if (!t || t.length > 40 || BULLET.test(line) || /\d/.test(t)) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true;
  // Non-Latin (e.g. Arabic) headings: short line on its own, ending with ":" or followed by content.
  const short = t.split(/\s+/).length <= 4 && !/[.,،؛;]$/.test(t);
  return short && (line.trim().endsWith(":") || (prevBlank && Boolean(nextLine?.trim())));
}

/** Short place name such as "Singapore", "Riyadh, Saudi Arabia". */
function looksLikeLocation(line: string) {
  const t = line.trim();
  return t.length <= 40 && !/\d/.test(t) && !BULLET.test(t) && t.split(/\s+/).length <= 4 && !/[.:;!?]$/.test(t);
}

function isShortLabel(line: string) {
  const t = line.trim();
  return t.split(/\s+/).length <= 4 && !/\d/.test(t) && !/[.,;]$/.test(t);
}

export function parseCv(text: string): CvBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: CvBlock[] = [];
  let seenName = false;
  let seenHeading = false;
  let prevBlank = true;
  let inEntrySection = false;
  let inListSection = false;
  /** The title the next date/location belongs to (reset at each heading). */
  let currentTitle: Extract<CvBlock, { type: "title" }> | null = null;
  /** True until the first text line of an entry has been seen. */
  let expectTitle = false;

  const isDateLine = (s: string | undefined) => Boolean(s && DATE_ONLY.test(s.trim()));

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      if (blocks.length && blocks[blocks.length - 1].type !== "space") blocks.push({ type: "space" });
      prevBlank = true;
      return;
    }
    const prev = lines[i - 1]?.trim();
    const next = lines[i + 1]?.trim();
    const last = blocks[blocks.length - 1];

    if (!seenName) {
      blocks.push({ type: "name", text: line });
      seenName = true;
    } else if (isHeading(raw, prevBlank, next)) {
      blocks.push({ type: "heading", text: line.replace(/:$/, "") });
      seenHeading = true;
      inEntrySection = ENTRY_SECTIONS.test(line);
      inListSection = !inEntrySection && LIST_SECTIONS.test(line);
      currentTitle = null;
      expectTitle = true;
    } else if (!seenHeading) {
      blocks.push({ type: "header", text: line });
    } else if (BULLET.test(raw)) {
      blocks.push({ type: "bullet", text: line.replace(BULLET, "").trim() });
      // After a run of bullets, the next text line starts a new entry.
      expectTitle = true;
    } else if (
      isDateLine(line) ||
      // A place right after a date, or a known place name next to a date.
      (looksLikeLocation(line) && (isDateLine(prev) || (isDateLine(next) && KNOWN_PLACES.test(line))))
    ) {
      // Dates and places go on the right of their entry's title.
      if (currentTitle) currentTitle.meta.push(line);
      else blocks.push({ type: "meta", text: line });
    } else if (last?.type === "bullet" && (/[,;]$/.test(last.text) || /^[a-z(]/.test(line))) {
      // A bullet that wrapped onto the next line in the source.
      last.text = `${last.text} ${line}`;
    } else if (inListSection) {
      // Certifications / courses: "Name, Issuer 2025" — the year goes on the right.
      const year = line.match(TRAILING_YEAR)?.[1];
      blocks.push({ type: "title", text: year ? line.replace(TRAILING_YEAR, "").replace(/[\s,]+$/, "") : line, meta: year ? [year] : [], entry: true });
    } else if ((inEntrySection && expectTitle) || (BULLET.test(lines[i + 1] ?? "") && isShortLabel(line))) {
      // Entry title (e.g. a job or project), or a short label above a bullet list ("Technologies").
      const title: Extract<CvBlock, { type: "title" }> = { type: "title", text: line, meta: [], entry: inEntrySection };
      blocks.push(title);
      if (inEntrySection) currentTitle = title;
      expectTitle = false;
    } else {
      blocks.push({ type: "para", text: line });
      expectTitle = false;
    }
    prevBlank = false;
  });
  return blocks;
}

export type CvEntry = { title: Extract<CvBlock, { type: "title" }>; body: CvBlock[] };
export type CvSection =
  | { kind: "top"; name: string | null; contact: string[] }
  | { kind: "section"; heading: string; layout: "entries" | "groups" | "plain"; intro: CvBlock[]; entries: CvEntry[] };

/** Groups blocks into sections and entries (title + the lines under it) for layout. */
export function toSections(blocks: CvBlock[]): CvSection[] {
  const top: CvSection = { kind: "top", name: null, contact: [] };
  const sections: CvSection[] = [top];
  let current: Extract<CvSection, { kind: "section" }> | null = null;

  for (const b of blocks) {
    if (b.type === "space") continue;
    if (b.type === "name") top.name = b.text;
    else if (b.type === "header") top.contact.push(...b.text.split(/\s*[|•·]\s*/).filter(Boolean));
    else if (b.type === "heading") {
      current = { kind: "section", heading: b.text, layout: "plain", intro: [], entries: [] };
      sections.push(current);
    } else if (!current) top.contact.push("text" in b ? b.text : "");
    else if (b.type === "title") {
      current.entries.push({ title: b, body: [] });
      current.layout = b.entry ? "entries" : current.layout === "entries" ? "entries" : "groups";
    } else if (current.entries.length) current.entries[current.entries.length - 1].body.push(b);
    else current.intro.push(b);
  }
  return sections;
}

/** "PROFESSIONAL EXPERIENCE" → "Professional Experience" (Latin all-caps headings only). */
export function titleCase(heading: string) {
  if (heading !== heading.toUpperCase() || !/[A-Z]/.test(heading)) return heading;
  const small = new Set(["and", "of", "the", "in", "for", "to", "a", "an", "on", "at", "with"]);
  return heading
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** "Software Engineering intern, Halliburton" → ["Software Engineering intern", "Halliburton"]. */
export function splitTitle(text: string): [string, string | null] {
  const at = text.indexOf(",");
  if (at <= 0 || at > text.length - 2) return [text, null];
  return [text.slice(0, at).trim(), text.slice(at + 1).trim()];
}

/** Separates date lines from location lines among an entry's right-side details. */
export function splitMeta(meta: string[]) {
  const dates = meta.filter((m) => DATE_ONLY.test(m.trim()) || /^(?:19|20)\d{2}/.test(m.trim()));
  return { dates, places: meta.filter((m) => !dates.includes(m)) };
}

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
