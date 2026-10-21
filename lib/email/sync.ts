import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDescription, findJobLink, htmlToText } from "./body";
import { classifyEmails, classifySentEmails, looksLikeApplicationSent, looksLikeHiringEmail, type EmailKind } from "./classify";
import { decryptToken, encryptToken } from "./crypto";
import { appliedViaFor, decide, findJob, sameCompany, sameDetail, type JobLite } from "./match";
import { GMAIL_PREFIX, gmailBody, gmailRefreshAccessToken, readGmail } from "./gmail";
import { graph, refreshAccessToken, type GraphMessage } from "./outlook";
import type { TablesInsert } from "@/lib/supabase/database.types";

const FIRST_SYNC_DAYS = 30;
/** Applications you sent can be older than the replies; the Sent folder is smaller, so look further back. */
const FIRST_SENT_SYNC_DAYS = 90;
const MAX_PAGES = 10;
const MAX_CLASSIFY = 40;
const SELECT = "subject,from,receivedDateTime,bodyPreview,webLink";
const SENT_SELECT = "subject,toRecipients,receivedDateTime,bodyPreview,webLink";
export const SYNC_EVERY_MINUTES = 60;

type Connection = {
  id: string;
  user_id: string;
  provider: "outlook" | "gmail";
  account_email: string | null;
  refresh_token_encrypted: string;
  delta_link: string | null;
  sent_delta_link: string | null;
};
type Page = { value: GraphMessage[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string };

/** New messages in a folder since its delta link (or the first-sync window), and where to resume. */
async function readFolder(accessToken: string, startUrl: string, previous: string | null) {
  const messages: GraphMessage[] = [];
  let url = startUrl;
  let nextDelta = previous;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await graph<Page>(accessToken, url, { Prefer: "odata.maxpagesize=50" });
    messages.push(...res.value.filter((m) => !m["@removed"]));
    if (res["@odata.deltaLink"]) {
      nextDelta = res["@odata.deltaLink"];
      break;
    }
    if (!res["@odata.nextLink"]) break;
    url = res["@odata.nextLink"];
    nextDelta = url; // resume here next time if we stop early
  }
  return { messages, nextDelta };
}

const sinceFilter = (days: number) => encodeURIComponent(new Date(Date.now() - days * 86_400_000).toISOString());
export type SyncResult = { fetched: number; candidates: number; suggestions: number };

type RawBody = { contentType?: string; content?: string } | null;
/** One mailbox's new messages, how to read a message's body, and what to save for next time. */
type Collected = {
  inbox: GraphMessage[];
  sent: GraphMessage[];
  fetchBody: (id: string) => Promise<RawBody>;
  state: Record<string, unknown>;
};

/** Outlook: Graph delta queries for the inbox and Sent folder (first sync: 30 / 90 days). */
async function collectOutlook(c: Connection): Promise<Collected> {
  // Fresh access token (Microsoft may rotate the refresh token too).
  const tokens = await refreshAccessToken(decryptToken(c.refresh_token_encrypted));
  const inbox = await readFolder(
    tokens.access_token,
    c.delta_link ?? `/me/mailFolders/inbox/messages/delta?$select=${SELECT}&$filter=receivedDateTime+ge+${sinceFilter(FIRST_SYNC_DAYS)}`,
    c.delta_link,
  );
  const sent = await readFolder(
    tokens.access_token,
    c.sent_delta_link ?? `/me/mailFolders/sentitems/messages/delta?$select=${SENT_SELECT}&$filter=receivedDateTime+ge+${sinceFilter(FIRST_SENT_SYNC_DAYS)}`,
    c.sent_delta_link,
  );
  return {
    inbox: inbox.messages,
    sent: sent.messages,
    fetchBody: async (id) =>
      (await graph<{ body?: { contentType?: string; content?: string } }>(tokens.access_token, `/me/messages/${encodeURIComponent(id)}?$select=body`)).body ??
      null,
    state: {
      delta_link: inbox.nextDelta,
      sent_delta_link: sent.nextDelta,
      ...(tokens.refresh_token ? { refresh_token_encrypted: encryptToken(tokens.refresh_token) } : {}),
    },
  };
}

/** Gmail: messages added since the saved history id (first sync: a search for likely job emails). */
async function collectGmail(c: Connection): Promise<Collected> {
  const tokens = await gmailRefreshAccessToken(decryptToken(c.refresh_token_encrypted));
  const mail = await readGmail(tokens.access_token, c.delta_link, c.account_email);
  return {
    inbox: mail.inbox,
    sent: mail.sent,
    fetchBody: (id) => gmailBody(tokens.access_token, id),
    state: {
      delta_link: mail.historyId,
      ...(tokens.refresh_token ? { refresh_token_encrypted: encryptToken(tokens.refresh_token) } : {}),
    },
  };
}

/** The user's connected mailboxes (Outlook, Gmail). */
async function loadConnections(userId: string): Promise<Connection[]> {
  const { data, error } = await createAdminClient()
    .from("email_connections")
    .select("id, user_id, provider, account_email, refresh_token_encrypted, delta_link, sent_delta_link")
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to load mailboxes: ${error.message}`);
  return (data ?? []) as Connection[];
}

/**
 * Reads new mail for one user from every connected mailbox — the inbox (replies from employers) and
 * the Sent folder (applications the user emailed) — and stores suggestions for review. A mailbox that
 * fails (e.g. Gmail access expired) is marked with its error; the others still sync.
 */
export async function syncUser(userId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const connections = await loadConnections(userId);
  if (!connections.length) throw new Error("no email connection");

  const total: SyncResult = { fetched: 0, candidates: 0, suggestions: 0 };
  const errors: unknown[] = [];
  for (const c of connections) {
    try {
      const mail = c.provider === "gmail" ? await collectGmail(c) : await collectOutlook(c);
      const result = await processMail(userId, mail);
      total.fetched += result.fetched;
      total.candidates += result.candidates;
      total.suggestions += result.suggestions;
      await admin
        .from("email_connections")
        .update({ ...mail.state, last_synced_at: new Date().toISOString(), status: "active", error: null })
        .eq("id", c.id);
    } catch (e) {
      errors.push(e);
      const message = e instanceof Error ? e.message : String(e);
      await admin.from("email_connections").update({ status: "error", error: message.slice(0, 300) }).eq("id", c.id);
    }
  }
  if (errors.length === connections.length) throw errors[0];
  return total;
}

/** The shared part: filter, read, classify and turn one mailbox's new messages into suggestions. */
async function processMail(userId: string, mail: Collected): Promise<SyncResult> {
  const admin = createAdminClient();
  const messages = [...mail.inbox, ...mail.sent];

  // 1. Skip emails already handled, keep likely hiring emails only.
  const ids = messages.map((m) => m.id);
  const { data: seen } = ids.length
    ? await admin.from("email_events").select("message_id").eq("user_id", userId).in("message_id", ids)
    : { data: [] };
  const seenIds = new Set((seen ?? []).map((s) => s.message_id));
  const pick = (list: GraphMessage[], likely: (m: GraphMessage) => boolean) =>
    list
      .filter((m) => !seenIds.has(m.id) && likely(m))
      .sort((a, b) => (a.receivedDateTime ?? "").localeCompare(b.receivedDateTime ?? ""))
      .slice(-MAX_CLASSIFY);
  const received = pick(mail.inbox, looksLikeHiringEmail);
  const sentCandidates = pick(mail.sent, looksLikeApplicationSent);
  const candidates = [...received, ...sentCandidates];
  const sentIds = new Set(sentCandidates.map((m) => m.id));

  // 2. Read the likely job emails in full (locally): job link, role from the link text, a description
  //    if the email has one, and more text for the classifier than the mailbox's short preview.
  const details = await readBodies(mail.fetchBody, candidates);
  const texts = new Map([...details].map(([id, b]) => [id, b.text]));

  // 3. Classify with AI (in batches) and turn into suggestions. Sent emails first, so an application
  //    you emailed and the company's reply to it become one suggestion.
  const classified = [];
  for (let i = 0; i < sentCandidates.length; i += 20) classified.push(...(await classifySentEmails(sentCandidates.slice(i, i + 20), texts)));
  for (let i = 0; i < received.length; i += 20) classified.push(...(await classifyEmails(received.slice(i, i + 20), texts)));

  const jobs = await loadJobs(userId);
  const { data: assessmentRow } = await admin
    .from("board_stages")
    .select("id")
    .eq("user_id", userId)
    .eq("preset", "assessment")
    .limit(1)
    .maybeSingle();
  const assessmentStageId = assessmentRow?.id ?? null;
  // Rounds already suggested (pending) or turned down (ignored), so reminders don't repeat them.
  const { data: earlierRounds } = await admin
    .from("email_events")
    .select("job_id, kind, detail")
    .eq("user_id", userId)
    .in("state", ["pending", "ignored"])
    .not("job_id", "is", null);
  const seenRounds: { job_id: string; kind: string; detail: string | null }[] = (earlierRounds ?? []) as never;
  const byId = new Map(candidates.map((m) => [m.id, m]));
  const rows: TablesInsert<"email_events">[] = [];
  /** Several emails about the same new application in one sync become one suggestion. */
  const pendingCreates = new Map<string, TablesInsert<"email_events">>();

  for (const e of classified) {
    if (e.kind === "other" || !e.company) continue;
    const m = byId.get(e.messageId)!;
    const isSent = sentIds.has(m.id);
    // From the Sent folder only applications count (follow-ups and thank-you notes don't move anything).
    if (isSent && e.kind !== "applied") continue;
    const body = details.get(m.id);
    const role = e.role || body?.link?.title || "";
    const job = findJob(jobs, e.company, role);
    const { action, status, round } = decide(job, e.kind as EmailKind, e.detail, assessmentStageId);
    if (action === "none") continue;
    if (round && job) {
      const dup = seenRounds.some((r) => r.job_id === job.id && r.kind === e.kind && sameDetail(r.detail, e.detail));
      if (dup) continue;
      seenRounds.push({ job_id: job.id, kind: e.kind, detail: e.detail });
    }
    const row = {
      user_id: userId,
      message_id: m.id,
      received_at: m.receivedDateTime ?? new Date().toISOString(),
      // Sent: who the user wrote to (shown as "To: …").
      sender: (isSent
        ? m.toRecipients?.[0]?.emailAddress?.name || m.toRecipients?.[0]?.emailAddress?.address || ""
        : m.from?.emailAddress?.name || m.from?.emailAddress?.address || ""
      ).slice(0, 200),
      subject: (m.subject ?? "").slice(0, 300),
      web_link: m.webLink ?? null,
      kind: e.kind,
      company: e.company,
      role: role || null,
      detail: e.detail || null,
      confidence: e.confidence,
      job_id: job?.id ?? null,
      action,
      proposed_status: status,
      job_link: body?.link?.url ?? null,
      job_description: body?.description ?? null,
      direction: isSent ? "sent" : "received",
      // Only an application confirmation says how you applied (a rejection from the company's
      // address doesn't mean you applied on its website).
      applied_via: isSent ? "email" : e.kind === "applied" ? appliedViaFor(m, body?.link?.url ?? null, e.company) : null,
    };
    if (action === "create") {
      // Same company and role (or one of them without a role), e.g. LinkedIn's "application sent"
      // and the company's own "thank you for applying": one suggestion.
      const earlier = [...pendingCreates.values()].find(
        (r) => sameCompany(String(r.company), e.company) && (!r.role || !role || sameDetail(String(r.role), role)),
      );
      if (earlier) {
        // Later email wins (e.g. "applied" then "interview"), keeping details only the earlier one had.
        Object.assign(earlier, {
          ...row,
          message_id: earlier.message_id,
          role: row.role ?? earlier.role,
          job_link: row.job_link ?? earlier.job_link,
          job_description: row.job_description ?? earlier.job_description,
          // The email that's kept is the earlier one; an application you emailed stays "via email".
          direction: earlier.direction,
          applied_via: earlier.applied_via === "email" ? "email" : (row.applied_via ?? earlier.applied_via),
        });
        continue;
      }
      pendingCreates.set(m.id, row);
    }
    rows.push(row);
  }
  if (rows.length) {
    const { error } = await admin.from("email_events").upsert(rows, { onConflict: "user_id,message_id", ignoreDuplicates: true });
    if (error) throw new Error(`Failed to save email suggestions: ${error.message}`);
  }

  return { fetched: messages.length, candidates: candidates.length, suggestions: rows.length };
}

export type BodyDetails = { text: string; link: ReturnType<typeof findJobLink>; description: string | null };

/** Full bodies of the candidate emails (a few at a time). An email that can't be read just uses its preview. */
export async function readBodies(
  fetchBody: (id: string) => Promise<{ contentType?: string; content?: string } | null>,
  messages: Pick<GraphMessage, "id">[],
): Promise<Map<string, BodyDetails>> {
  const out = new Map<string, BodyDetails>();
  for (let i = 0; i < messages.length; i += 5) {
    await Promise.all(
      messages.slice(i, i + 5).map(async (m) => {
        try {
          const body = await fetchBody(m.id);
          const content = body?.content ?? "";
          const html = body?.contentType === "html" ? content : "";
          const text = html ? htmlToText(html) : content;
          out.set(m.id, { text, link: html ? findJobLink(html) : null, description: findDescription(text) });
        } catch {
          // Preview only for this one.
        }
      }),
    );
  }
  return out;
}

/**
 * Reads the body of any stored email by id, from the right mailbox: "gmail:" ids from Gmail, others
 * from Outlook. Access tokens are fetched once per mailbox (and rotated refresh tokens saved).
 */
export async function mailboxBodyReader(userId: string) {
  const admin = createAdminClient();
  const connections = await loadConnections(userId);
  if (!connections.length) throw new Error("no email connection");
  const tokens = new Map<string, Promise<string>>();
  const tokenFor = (c: Connection) => {
    if (!tokens.has(c.provider)) {
      tokens.set(
        c.provider,
        (async () => {
          const t = await (c.provider === "gmail" ? gmailRefreshAccessToken : refreshAccessToken)(decryptToken(c.refresh_token_encrypted));
          if (t.refresh_token) await admin.from("email_connections").update({ refresh_token_encrypted: encryptToken(t.refresh_token) }).eq("id", c.id);
          return t.access_token;
        })(),
      );
    }
    return tokens.get(c.provider)!;
  };
  const gmail = connections.find((c) => c.provider === "gmail");
  const outlook = connections.find((c) => c.provider === "outlook");
  return async (id: string) => {
    if (id.startsWith(GMAIL_PREFIX)) return gmail ? gmailBody(await tokenFor(gmail), id) : null;
    if (!outlook) return null;
    const res = await graph<{ body?: { contentType?: string; content?: string } }>(await tokenFor(outlook), `/me/messages/${encodeURIComponent(id)}?$select=body`);
    return res.body ?? null;
  };
}

/** The user's jobs, for matching emails to them. */
async function loadJobs(userId: string): Promise<JobLite[]> {
  const { data, error } = await createAdminClient()
    .from("jobs")
    .select("id, title, status, stage_id, stage_detail, company:companies(name)")
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to load jobs: ${error.message}`);
  return data ?? [];
}

/** Hourly job: sync every user with a mailbox that hasn't synced in the last hour. */
export async function syncDueConnections(max = 25) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - (SYNC_EVERY_MINUTES - 5) * 60_000).toISOString();
  const { data } = await admin
    .from("email_connections")
    .select("user_id, last_synced_at")
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .limit(max);
  // A user with Outlook and Gmail has two rows; one sync covers both.
  const users = [...new Set((data ?? []).map((row) => row.user_id))];
  let ok = 0;
  for (const userId of users) {
    try {
      await syncUser(userId);
      ok++;
    } catch (e) {
      console.error("email sync failed for a user", e instanceof Error ? e.message : e);
    }
  }
  return { due: users.length, synced: ok };
}

/** If the last sync is over an hour old, run one after the current response (doesn't slow the page). */
export function syncInBackgroundIfDue(userId: string, lastSyncedAt: string | null) {
  const due = !lastSyncedAt || Date.now() - Date.parse(lastSyncedAt) > SYNC_EVERY_MINUTES * 60_000;
  if (!due) return;
  after(async () => {
    try {
      await syncUser(userId);
    } catch (e) {
      console.error("background email sync failed", e instanceof Error ? e.message : e);
    }
  });
}
