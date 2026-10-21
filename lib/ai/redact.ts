/**
 * Removes personal details from CV text before it is sent to an AI provider, and puts
 * them back into generated text afterwards. Placeholders look like [EMAIL_1].
 */
export type Redaction = { text: string; restore: (generated: string) => string };

const PATTERNS: Array<[label: string, re: RegExp]> = [
  ["EMAIL", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ["LINK", /\b(?:https?:\/\/|www\.)[^\s)>\]]+|\b(?:linkedin\.com|github\.com|gitlab\.com|behance\.net)\/[^\s)>\]]+/gi],
  // international and Saudi formats: +966 5x xxx xxxx, 05xxxxxxxx, (555) 123-4567 …
  ["PHONE", /(?<![\w])(?:\+|00)?\d[\d\s().-]{7,}\d(?![\w])/g],
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactCv(cv: string, fullName: string | null): Redaction {
  const map = new Map<string, string>();
  const counters: Record<string, number> = {};
  const placeholder = (label: string, value: string) => {
    for (const [key, v] of map) if (v === value) return key;
    counters[label] = (counters[label] ?? 0) + 1;
    const key = `[${label}_${counters[label]}]`;
    map.set(key, value);
    return key;
  };

  let text = cv;
  for (const [label, re] of PATTERNS) {
    text = text.replace(re, (m) => {
      // Years and year ranges (2019 – 2023) aren't phone numbers.
      if (label === "PHONE" && m.replace(/\D/g, "").length < 9) return m;
      return placeholder(label, m.trim());
    });
  }

  const name = fullName?.trim();
  if (name && name.length >= 3) {
    text = text.replace(new RegExp(escapeRegExp(name), "gi"), (m) => placeholder("NAME", m));
  }

  return {
    text,
    restore: (generated) => generated.replace(/\[(EMAIL|LINK|PHONE|NAME)_\d+\]/g, (key) => map.get(key) ?? key),
  };
}
