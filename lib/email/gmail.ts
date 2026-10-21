import "server-only";
import { gmailConfig } from "@/lib/env.server";
import { decode } from "./body";
import type { GraphMessage } from "./outlook";

/*
 * Google sign-in (OAuth 2 with PKCE) + the Gmail API, read-only (gmail.readonly). Messages are
 * turned into the same shape as Outlook's (GraphMessage) so the rest of the email pipeline is shared.
 * Gmail message ids are stored with a "gmail:" prefix so they never clash with Outlook ids.
 */

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export const GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_PREFIX = "gmail:";

/** First sync windows (same as Outlook): inbox 30 days, Sent 90 days. */
const INBOX_DAYS = 30;
const SENT_DAYS = 90;
const MAX_LIST = 200;

/*
 * Gmail's own search narrows the first sync to likely job emails, so we don't fetch every message.
 * {a b c} means "any of" in Gmail search. The app's own filters still run afterwards.
 */
const INBOX_QUERY =
  `in:inbox newer_than:${INBOX_DAYS}d {application applied interview assessment assignment offer position candidate candidacy ` +
  `unfortunately regret "next steps" shortlist hiring recruit recruiter vacancy "coding test" ` +
  `from:linkedin.com from:greenhouse.io from:lever.co from:myworkday.com from:workday.com from:smartrecruiters.com ` +
  `from:workable.com from:ashbyhq.com from:bayt.com from:indeed.com مقابلة طلبك التقديم للأسف الوظيفة}`;
const SENT_QUERY =
  `in:sent newer_than:${SENT_DAYS}d {cv resume "curriculum vitae" application apply applying position vacancy opening role ` +
  `internship job candidate opportunity سيرة تقديم أتقدم وظيفة فرصة تدريب}`;

export class GmailError extends Error {
  constructor(
    public code: "not_configured" | "auth_failed" | "api_failed" | "history_expired",
    message: string,
  ) {
    super(message);
  }
}

function config() {
  const { clientId, clientSecret } = gmailConfig();
  if (!clientId || !clientSecret) throw new GmailError("not_configured", "GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET not set");
  return { clientId, clientSecret };
}

export const gmailRedirectUri = (origin: string) => `${origin}/api/email/gmail/callback`;

export function gmailAuthorizeUrl({ origin, state, challenge }: { origin: string; state: string; challenge: string }) {
  const { clientId } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: gmailRedirectUri(origin),
    response_type: "code",
    scope: GMAIL_SCOPES,
    // offline + consent: Google returns a refresh token every time, so hourly syncs need no sign-in.
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTH}?${params}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = config();
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    // "invalid_grant" = the user revoked access, or (Testing mode) the 7-day refresh token expired.
    throw new GmailError("auth_failed", `${json.error ?? res.status}: ${(json.error_description ?? "").slice(0, 200)}`);
  }
  return json;
}

export function gmailExchangeCode({ code, verifier, origin }: { code: string; verifier: string; origin: string }) {
  return tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: gmailRedirectUri(origin) });
}

export function gmailRefreshAccessToken(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

async function api<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 404 && path.startsWith("/history")) throw new GmailError("history_expired", "Gmail history id too old");
  if (!res.ok) throw new GmailError("api_failed", `Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export function gmailProfile(accessToken: string) {
  return api<{ emailAddress: string; historyId: string }>(accessToken, "/profile");
}

/** Message ids matching a Gmail search (newest first, capped). */
async function searchIds(accessToken: string, q: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q, maxResults: "100", ...(pageToken ? { pageToken } : {}) });
    const page = await api<{ messages?: { id: string }[]; nextPageToken?: string }>(accessToken, `/messages?${params}`);
    ids.push(...(page.messages ?? []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < MAX_LIST);
  return ids.slice(0, MAX_LIST);
}

/** Ids of messages added since a history id, and the newest history id. */
async function addedSince(accessToken: string, startHistoryId: string): Promise<{ ids: string[]; historyId: string }> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let historyId = startHistoryId;
  do {
    const params = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", maxResults: "500", ...(pageToken ? { pageToken } : {}) });
    const page = await api<{ history?: { messagesAdded?: { message: { id: string } }[] }[]; historyId?: string; nextPageToken?: string }>(
      accessToken,
      `/history?${params}`,
    );
    for (const h of page.history ?? []) for (const a of h.messagesAdded ?? []) ids.add(a.message.id);
    if (page.historyId) historyId = page.historyId;
    pageToken = page.nextPageToken;
  } while (pageToken && ids.size < MAX_LIST * 2);
  return { ids: [...ids], historyId };
}

type GmailHeader = { name: string; value: string };
type GmailMeta = { id: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: { headers?: GmailHeader[] } };

/** "Jane Doe <jane@acme.com>" → { name, address } (the first address of a list). */
export function parseAddress(value: string | undefined): { name?: string; address?: string } {
  if (!value) return {};
  const first = value.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)[0].trim();
  const m = first.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || undefined, address: m[2].trim() };
  return { address: first.replace(/^<|>$/g, "") };
}

/** Gmail message (metadata) → the shared message shape. */
export function toMessage(meta: GmailMeta, account: string | null): GraphMessage {
  const header = (name: string) => meta.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value;
  const from = parseAddress(header("from"));
  const to = parseAddress(header("to"));
  return {
    id: `${GMAIL_PREFIX}${meta.id}`,
    subject: header("subject") ?? "",
    // Gmail's snippet is HTML-escaped ("&#39;").
    bodyPreview: decode(meta.snippet ?? ""),
    receivedDateTime: meta.internalDate ? new Date(Number(meta.internalDate)).toISOString() : undefined,
    webLink: `https://mail.google.com/mail/${account ? `?authuser=${encodeURIComponent(account)}` : ""}#all/${meta.id}`,
    from: { emailAddress: { name: from.name, address: from.address } },
    toRecipients: to.address ? [{ emailAddress: { name: to.name, address: to.address } }] : [],
  };
}

async function metadata(accessToken: string, ids: string[], account: string | null) {
  const out: (GraphMessage & { labels: string[] })[] = [];
  const fields = new URLSearchParams([
    ["format", "metadata"],
    ["metadataHeaders", "Subject"],
    ["metadataHeaders", "From"],
    ["metadataHeaders", "To"],
  ]);
  for (let i = 0; i < ids.length; i += 10) {
    const batch = await Promise.all(
      ids.slice(i, i + 10).map((id) => api<GmailMeta>(accessToken, `/messages/${encodeURIComponent(id)}?${fields}`).catch(() => null)),
    );
    for (const meta of batch) if (meta) out.push({ ...toMessage(meta, account), labels: meta.labelIds ?? [] });
  }
  return out;
}

/**
 * New Gmail messages for one connection: inbox and Sent, in the shared shape. First sync (or an
 * expired history id): Gmail searches for likely job emails. After that: only messages added since
 * the saved history id. Returns the history id to save.
 */
export async function readGmail(accessToken: string, historyId: string | null, account: string | null) {
  let ids: string[];
  let nextHistoryId: string;
  try {
    if (!historyId) throw new GmailError("history_expired", "first sync");
    ({ ids, historyId: nextHistoryId } = await addedSince(accessToken, historyId));
  } catch (e) {
    if (!(e instanceof GmailError) || e.code !== "history_expired") throw e;
    const [profile, inboxIds, sentIds] = await Promise.all([
      gmailProfile(accessToken),
      searchIds(accessToken, INBOX_QUERY),
      searchIds(accessToken, SENT_QUERY),
    ]);
    ids = [...new Set([...inboxIds, ...sentIds])];
    nextHistoryId = profile.historyId;
  }
  const messages = await metadata(accessToken, ids, account);
  return {
    inbox: messages.filter((m) => m.labels.includes("INBOX")),
    sent: messages.filter((m) => m.labels.includes("SENT") && !m.labels.includes("INBOX")),
    historyId: nextHistoryId,
  };
}

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };

/** The HTML (else plain-text) body of a Gmail message, for the shared body reader. */
export async function gmailBody(accessToken: string, prefixedId: string): Promise<{ contentType: "html" | "text"; content: string } | null> {
  const id = prefixedId.slice(GMAIL_PREFIX.length);
  const msg = await api<{ payload?: Part }>(accessToken, `/messages/${encodeURIComponent(id)}?format=full`);
  const find = (part: Part | undefined, type: string): string | null => {
    if (!part) return null;
    if (part.mimeType === type && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
    for (const p of part.parts ?? []) {
      const found = find(p, type);
      if (found) return found;
    }
    return null;
  };
  const html = find(msg.payload, "text/html");
  if (html) return { contentType: "html", content: html };
  const text = find(msg.payload, "text/plain");
  return text ? { contentType: "text", content: text } : null;
}
