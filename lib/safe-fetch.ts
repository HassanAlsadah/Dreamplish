import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

/*
 * Fetching public web pages whose URL comes from users, emails or search results: public hosts
 * only, every redirect re-checked, short timeout, size cap.
 *
 * The address check happens in the connection's own DNS lookup, so the address that was checked is
 * the address connected to (a hostile DNS server can't answer "public" to a check and "internal"
 * to the request that follows).
 */

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

/** Addresses a public web page can't be on: private, loopback, link-local (cloud metadata), reserved. */
const NOT_PUBLIC = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) NOT_PUBLIC.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) NOT_PUBLIC.addSubnet(net, prefix, "ipv6");

/** An IPv4 address written as IPv6 (::ffff:a.b.c.d or ::ffff:XXXX:XXXX) → the IPv4 address. */
function unmapIpv4(address: string): string {
  const m = address.toLowerCase().match(/^(?:0*:)*:ffff:(?:([\d.]+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (!m) return address;
  if (m[1]) return m[1];
  const hi = parseInt(m[2], 16);
  const lo = parseInt(m[3], 16);
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
}

export function isPublicAddress(address: string): boolean {
  const ip = unmapIpv4(address);
  const family = isIP(ip);
  if (!family) return false;
  return !NOT_PUBLIC.check(ip, family === 6 ? "ipv6" : "ipv4");
}

/** DNS lookup for outgoing requests that fails unless every address for the host is public. */
export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, "", 4);
    const blocked = addresses.find((a) => !isPublicAddress(a.address));
    if (!addresses.length || blocked) {
      const err = Object.assign(new Error(`not a public address: ${hostname}`), { code: "ENOTPUBLIC" });
      return callback(err, "", 4);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

type Response = { status: number; location: string | null; contentType: string; body: string | null };

/** One GET (no redirects followed), connecting only to public addresses. */
function get(url: URL): Promise<Response> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    // An IP literal skips DNS, so it's checked here.
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) && !isPublicAddress(literal)) return reject(new Error("not a public address"));
    const req = client.get(
      url,
      {
        lookup: publicOnlyLookup,
        // A hard limit on the whole request (a slow server can't keep it open by sending a byte at a time).
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; DreamplishBot/1.0)", Accept: "text/html", "Accept-Encoding": "identity" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers["content-type"] ?? "");
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        if (status < 200 || status >= 300 || !contentType.includes("html")) {
          res.resume();
          return resolve({ status, location, contentType, body: null });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= MAX_BYTES) res.destroy(); // enough to read a job posting
        });
        const done = () => resolve({ status, location, contentType, body: Buffer.concat(chunks).toString("utf8") });
        res.on("end", done);
        res.on("close", done);
        res.on("error", reject);
      },
    );
    req.on("error", reject);
  });
}

/** HTML of a public page, or null (not public, not HTML, error). */
export async function fetchHtml(url: string): Promise<string | null> {
  try {
    let current = new URL(url);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (current.protocol !== "https:" && current.protocol !== "http:") return null;
      const res = await get(current);
      if (res.status >= 300 && res.status < 400) {
        if (!res.location) return null;
        current = new URL(res.location, current); // checked again on the next hop
        continue;
      }
      return res.body;
    }
    return null;
  } catch {
    return null;
  }
}
