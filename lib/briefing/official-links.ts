import "server-only";
import { fetchHtml } from "@/lib/safe-fetch";

/*
 * Finds the company's LinkedIn page by reading its own official website (header/footer links),
 * instead of guessing a URL. The site URL can come from user input, so the fetch is restricted
 * to public hosts with a short timeout and a size cap.
 */

const LINKEDIN = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(company|school|showcase)\/([A-Za-z0-9\-_%.]+)/gi;

/** LinkedIn page linked from the company's own website, or null. */
export async function linkedinFromWebsite(website: string, companyName: string): Promise<string | null> {
  try {
    const html = await fetchHtml(website);
    if (!html) return null;
    const found = [...html.matchAll(LINKEDIN)].map((m) => ({ kind: m[1].toLowerCase(), slug: decodeURIComponent(m[2]).replace(/\.+$/, "") }));
    if (!found.length) return null;
    // Several links (e.g. subsidiaries): prefer the one closest to the company name, then company over showcase.
    const key = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const rank = (f: { kind: string; slug: string }) => {
      const s = f.slug.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (key && s === key ? 4 : key && (s.includes(key) || key.includes(s)) ? 2 : 0) + (f.kind === "showcase" ? 0 : 1);
    };
    const best = found.sort((a, b) => rank(b) - rank(a))[0];
    return `https://www.linkedin.com/${best.kind}/${best.slug}`;
  } catch {
    return null;
  }
}
