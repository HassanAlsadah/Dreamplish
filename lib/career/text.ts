/** Lower-case, collapse whitespace and unify quotes/dashes so verbatim checks tolerate formatting. */
export function squash(s: string) {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `quote` appears in `source` (ignoring case/whitespace), and is long enough to mean something. */
export function appearsIn(quote: string | null | undefined, source: string) {
  const q = squash(quote ?? "");
  return q.length >= 3 && squash(source).includes(q);
}
