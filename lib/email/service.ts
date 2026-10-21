import "server-only";
import { after } from "next/server";
import { fillJobDescription } from "@/lib/career/find-description";
import { emailTokenKey, gmailConfig, outlookConfig, supabaseSecretKey } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAssessmentStage } from "@/lib/stages";
import type { AppliedVia, JobStatus } from "@/lib/types";
import { GMAIL_PREFIX } from "./gmail";
import { roundColumn } from "./match";
import type { Row } from "@/lib/supabase/database";

export type MailProvider = "outlook" | "gmail";

export type EmailConnectionView = {
  provider: MailProvider;
  accountEmail: string | null;
  lastSyncedAt: string | null;
  status: "active" | "error";
  error: string | null;
};

export type EmailEvent = {
  id: string;
  received_at: string;
  sender: string | null;
  subject: string | null;
  web_link: string | null;
  kind: "applied" | "interview" | "assessment" | "offer" | "rejected";
  company: string | null;
  role: string | null;
  confidence: "low" | "medium" | "high";
  job_id: string | null;
  action: "create" | "update";
  proposed_status: JobStatus;
  detail: string | null;
  /** Job posting link and description found in the email. */
  job_link: string | null;
  job_description: string | null;
  /** From the inbox, or an application the user sent. */
  direction: "received" | "sent";
  /** How the user applied, when the email shows it (LinkedIn confirmation, a sent email…). */
  applied_via: AppliedVia | null;
  job?: { title: string; status: JobStatus; stage_id: string | null; stage_detail: string | null } | null;
  /** The round column the job is in now (Assessment / Interview), so the card can say "New round". */
  currentColumn?: "assessment" | "interview" | null;
};

/**
 * Mailbox providers this server can connect: the provider's OAuth client, the token encryption key
 * and the service-role key (connections are stored server side) are all set.
 */
export function availableMailProviders(): MailProvider[] {
  if (!emailTokenKey() || !supabaseSecretKey()) return [];
  const ready = (c: { clientId?: string; clientSecret?: string }) => Boolean(c.clientId && c.clientSecret);
  return [...(ready(outlookConfig()) ? (["outlook"] as const) : []), ...(ready(gmailConfig()) ? (["gmail"] as const) : [])];
}

/** The signed-in user's connected mailboxes (never includes tokens). Empty if none, or if email isn't configured on the server. */
export async function getConnections(userId: string): Promise<EmailConnectionView[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_connections")
      .select("provider, account_email, last_synced_at, status, error")
      .eq("user_id", userId)
      .order("created_at");
    return (data ?? []).map((c) => ({
      provider: c.provider as MailProvider,
      accountEmail: c.account_email,
      lastSyncedAt: c.last_synced_at,
      status: c.status,
      error: c.error,
    }));
  } catch {
    // No service-role key: email isn't set up on this server.
    return [];
  }
}

/** Store (or replace) a mailbox connection after sign-in; the first sync starts from scratch. */
export async function saveConnection({
  userId,
  provider,
  accountEmail,
  refreshTokenEncrypted,
}: {
  userId: string;
  provider: MailProvider;
  accountEmail: string | null;
  refreshTokenEncrypted: string;
}) {
  const admin = createAdminClient();
  const row = {
    user_id: userId,
    provider,
    account_email: accountEmail,
    refresh_token_encrypted: refreshTokenEncrypted,
    delta_link: null,
    last_synced_at: null,
    status: "active",
    error: null,
  };
  const { error } = await admin.from("email_connections").upsert(row, { onConflict: "user_id,provider" });
  if (error) throw new Error(error.message);
}

/** Disconnect one mailbox: its token and its pending suggestions go; jobs already added stay. */
export async function disconnectMailbox(userId: string, provider: MailProvider) {
  const admin = createAdminClient();
  await admin.from("email_connections").delete().eq("user_id", userId).eq("provider", provider);
  const pending = admin.from("email_events").delete().eq("user_id", userId).eq("state", "pending");
  // Gmail message ids start with "gmail:"; everything else came from Outlook.
  await (provider === "gmail" ? pending.like("message_id", `${GMAIL_PREFIX}%`) : pending.not("message_id", "like", `${GMAIL_PREFIX}%`));
}

export async function pendingEvents(): Promise<EmailEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_events")
    .select("*, job:jobs(title, status, stage_id, stage_detail)")
    .eq("state", "pending")
    .order("received_at", { ascending: false })
    .limit(30);
  if (error) {
    console.error("pendingEvents failed", error.message);
    return [];
  }
  const { data: assessment } = await supabase.from("board_stages").select("id").eq("preset", "assessment").limit(1).maybeSingle();
  return ((data ?? []) as unknown as EmailEvent[]).map((ev) => ({
    ...ev,
    currentColumn: ev.job ? roundColumn(ev.job, assessment?.id ?? null) : null,
  }));
}

export type EmailKind = EmailEvent["kind"];
export const EMAIL_KINDS: EmailKind[] = ["applied", "assessment", "interview", "offer", "rejected"];
const STATUS_FOR: Record<EmailKind, JobStatus> = {
  applied: "applied",
  assessment: "interview",
  interview: "interview",
  offer: "offer",
  rejected: "rejected",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;
type EventRow = Row<"email_events">;
type Edits = { company?: string; role?: string; kind?: EmailKind };
/** Where the email puts the job: Assessment → the Assessment column, anything else → its status's core column. */
type Placement = { status: JobStatus; stage_id: string | null; stage_detail: string | null };

async function placementFor(supabase: Supabase, ev: EventRow, kind: EmailKind): Promise<Placement> {
  const { data: stages } = await supabase.from("board_stages").select("id, preset");
  const assessment = kind === "assessment" ? stages?.find(isAssessmentStage) : undefined;
  return {
    status: STATUS_FOR[kind],
    stage_id: assessment?.id ?? null,
    // The interview/assessment type, shown in small text on the card.
    stage_detail: kind === "interview" || kind === "assessment" ? ev.detail : null,
  };
}

async function createJobFromEvent(supabase: Supabase, userId: string, ev: EventRow, edits: Edits, placement: Placement) {
  const company = (edits.company ?? ev.company ?? "").trim().slice(0, 200);
  const title = (edits.role ?? ev.role ?? "").trim().slice(0, 200) || "Unknown role";
  if (!company) return { error: "company_required" } as const;
  const { data: companyId, error: companyError } = await supabase.rpc("get_or_create_company", { p_name: company });
  if (companyError || !companyId) return { error: "save_failed" } as const;
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      ...placement,
      user_id: userId,
      company_id: companyId,
      title,
      date_applied: String(ev.received_at).slice(0, 10),
      source: "email",
      notes: ev.subject ? `From email: ${ev.subject}` : null,
      link: ev.job_link,
      job_description: ev.job_description,
      applied_via: ev.applied_via,
    })
    .select("id")
    .single();
  if (error || !job) return { error: "save_failed" } as const;
  return { jobId: job.id };
}

async function updateJobFromEvent(supabase: Supabase, jobId: string, ev: EventRow, placement: Placement) {
  const { data: job, error: readError } = await supabase.from("jobs").select("link, job_description, applied_via").eq("id", jobId).maybeSingle();
  if (readError || !job) return { error: "save_failed" } as const;
  // Fill in the posting link / description / how you applied only if the job doesn't have them yet.
  const { error } = await supabase
    .from("jobs")
    .update({
      ...placement,
      ...(!job.link && ev.job_link ? { link: ev.job_link } : {}),
      ...(!job.job_description && ev.job_description ? { job_description: ev.job_description } : {}),
      ...(!job.applied_via && ev.applied_via ? { applied_via: ev.applied_via } : {}),
    })
    .eq("id", jobId);
  if (error) return { error: "save_failed" } as const;
  return { jobId };
}

/** Applies a suggestion (optionally edited by the user) through the user's own permissions. */
export async function acceptEvent(userId: string, eventId: string, edits: Edits): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_events").select("*").eq("id", eventId).eq("state", "pending").maybeSingle();
  const ev = data;
  if (!ev) return { ok: false, error: "not_found" };

  // Email uses a fixed set of columns: Application, Assessment, Interview, Offer, Rejected.
  const kind: EmailKind = edits.kind && EMAIL_KINDS.includes(edits.kind) ? edits.kind : ev.kind;
  const placement = await placementFor(supabase, ev, kind);
  const result =
    ev.action === "create" || !ev.job_id
      ? await createJobFromEvent(supabase, userId, ev, edits, placement)
      : await updateJobFromEvent(supabase, ev.job_id, ev, placement);
  if ("error" in result) return { ok: false, error: result.error };
  const { jobId } = result;

  // Events are server-written; mark this one handled.
  await createAdminClient().from("email_events").update({ state: "accepted", job_id: jobId }).eq("id", eventId).eq("user_id", userId);

  // No description from the email: look for the posting on the company's own site, after responding.
  if (!ev.job_description) {
    after(async () => {
      await fillJobDescription(userId, jobId).catch((e) => console.error("description lookup failed", e instanceof Error ? e.message : e));
    });
  }
  return { ok: true, jobId };
}

export async function ignoreEvent(userId: string, eventId: string) {
  await createAdminClient().from("email_events").update({ state: "ignored" }).eq("id", eventId).eq("user_id", userId);
  return { ok: true };
}
