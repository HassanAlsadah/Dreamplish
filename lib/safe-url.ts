/**
 * A link that came from data (AI output, emails, other sites) is only rendered if it's a valid http(s)
 * URL: no javascript:, data: or other schemes, and nothing that would crash new URL().
 */
export function webUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
