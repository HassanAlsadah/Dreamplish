import "server-only";
import { createHash } from "node:crypto";
import { googleSignInConfig } from "@/lib/env.server";

/*
 * Google sign-in done by the app itself (OAuth code flow with PKCE), so Google's screen names this
 * site, not the Supabase project. Google returns an ID token; Supabase verifies it and starts the
 * session (signInWithIdToken), so accounts and sessions stay in Supabase as before.
 */

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";

export const SIGN_IN_COOKIE = "g_signin";
export const SIGN_IN_COOKIE_PATH = "/api/auth/google";

export const redirectUri = (origin: string) => `${origin}/api/auth/google/callback`;

/** Google receives the nonce's SHA-256 (hex); Supabase gets the nonce itself and checks it against the token. */
export const hashNonce = (nonce: string) => createHash("sha256").update(nonce).digest("hex");

export function googleClient() {
  const { clientId, clientSecret } = googleSignInConfig();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function authorizeUrl({ clientId, origin, state, challenge, nonce }: { clientId: string; origin: string; state: string; challenge: string; nonce: string }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce: hashNonce(nonce),
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTHORIZE}?${params}`;
}

/** The ID token for the code Google sent back, or null. */
export async function exchangeCodeForIdToken({ code, verifier, origin }: { code: string; verifier: string; origin: string }): Promise<string | null> {
  const client = googleClient();
  if (!client) return null;
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error("Google token exchange failed", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const json = (await res.json()) as { id_token?: string };
  return json.id_token ?? null;
}
