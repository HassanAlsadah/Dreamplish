import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";

/** Public origin of the app (it must match the redirect URIs registered with Google and Microsoft). */
export function appOrigin(req: NextRequest) {
  return (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
}

/** An unguessable value for OAuth state and nonces. */
export const randomToken = () => randomBytes(32).toString("base64url");

/** PKCE pair: the verifier stays in an httpOnly cookie, the challenge goes to the provider. */
export function pkce() {
  const verifier = randomToken();
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
