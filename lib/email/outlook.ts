import "server-only";
import { outlookConfig } from "@/lib/env.server";

/*
 * Microsoft identity platform (personal accounts: outlook.com / hotmail / live) + Microsoft Graph.
 * Read-only: Mail.Read. offline_access gives a refresh token so the hourly sync needs no re-login.
 */

const AUTHORITY = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
export const OUTLOOK_SCOPES = "offline_access User.Read Mail.Read";

export class OutlookError extends Error {
  constructor(
    public code: "not_configured" | "auth_failed" | "graph_failed",
    message: string,
  ) {
    super(message);
  }
}

function config() {
  const { clientId, clientSecret } = outlookConfig();
  if (!clientId || !clientSecret) throw new OutlookError("not_configured", "OUTLOOK_CLIENT_ID / OUTLOOK_CLIENT_SECRET not set");
  return { clientId, clientSecret };
}

export function redirectUri(origin: string) {
  return `${origin}/api/email/outlook/callback`;
}

export function authorizeUrl({ origin, state, challenge }: { origin: string; state: string; challenge: string }) {
  const { clientId } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(origin),
    response_mode: "query",
    scope: OUTLOOK_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTHORITY}/authorize?${params}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = config();
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: OUTLOOK_SCOPES, ...body }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new OutlookError("auth_failed", `${json.error ?? res.status}: ${(json.error_description ?? "").slice(0, 200)}`);
  }
  return json;
}

export function exchangeCode({ code, verifier, origin }: { code: string; verifier: string; origin: string }) {
  return tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri(origin) });
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function graph<T>(accessToken: string, pathOrUrl: string, headers: Record<string, string> = {}): Promise<T> {
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH}${pathOrUrl}`;
  // Only follow links that point at Microsoft Graph.
  if (!url.startsWith(GRAPH)) throw new OutlookError("graph_failed", "unexpected Graph URL");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, ...headers },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new OutlookError("graph_failed", `Graph ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export type GraphMessage = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  webLink?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  /** Sent folder: who the user wrote to. */
  toRecipients?: { emailAddress?: { name?: string; address?: string } }[];
  "@removed"?: unknown;
};
