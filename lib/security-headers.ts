// No imports: next.config.ts loads this file, and the @/ alias doesn't work there.

const isDev = process.env.NODE_ENV === "development";

/**
 * Headers for every response (pages and API), set in next.config.ts. The Content-Security-Policy is
 * per request (it carries a nonce), so the proxy sets it on pages.
 */
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Older browsers; frame-ancestors in the CSP covers current ones.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

/**
 * Scripts run only with this request's nonce (Next.js adds it to its own scripts; 'strict-dynamic'
 * lets those load the rest). Inline style attributes are allowed: the board colours and animations
 * set them, and nonces can't cover attributes. Images may come from any https host (company logos,
 * Google's search widget). Forms may also go to the sign-in providers (Google sign-in without JS).
 */
export function contentSecurityPolicy(nonce: string, supabaseUrl: string) {
  const supabase = new URL(supabaseUrl).origin;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${supabase} https://accounts.google.com`,
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** A fresh, unguessable nonce for one response. */
export const createNonce = () => Buffer.from(crypto.randomUUID()).toString("base64");
