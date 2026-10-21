import "server-only";
import { fillJobDescription } from "@/lib/career/find-description";
import { createAdminClient } from "@/lib/supabase/admin";
import { appliedViaFor, findJob, type JobLite } from "./match";
import { mailboxBodyReader, readBodies } from "./sync";

const MAX_EMAILS = 60;
/** Online lookups per run (one search each). */
const MAX_LOOKUPS = 5;

export type RereadResult = { emails: number; jobsUpdated: number; descriptionsFound: number };

/**
 * Goes back over job emails already turned into suggestions and fills in what older versions
 * missed: the job link, the role (from the link text) and an in-email job description. Accepted
 * suggestions update their job — only fields that are still empty, plus "Unknown role" titles.
 * Then jobs still without a description get an online lookup (company site / hiring system).
 */
export async function rereadJobEmails(userId: string): Promise<RereadResult> {
  const admin = createAdminClient();
  // Outlook and Gmail emails are each read from their own mailbox.
  const fetchBody = await mailboxBodyReader(userId);

  const { data: events, error } = await admin
    .from("email_events")
    .select("id, message_id, job_id, state, kind, sender, company, role, job_link, job_description")
    .eq("user_id", userId)
    .in("state", ["accepted", "pending"])
    .order("received_at", { ascending: false })
    .limit(MAX_EMAILS);
  if (error) throw new Error(error.message);

  const bodies = await readBodies(fetchBody, (events ?? []).map((e) => ({ id: e.message_id })));
  const { data: jobRows } = await admin.from("jobs").select("id, title, status, company:companies(name)").eq("user_id", userId);
  const jobs: JobLite[] = jobRows ?? [];
  const touchedJobs = new Set<string>();
  const updated = new Set<string>();

  for (const ev of events ?? []) {
    const body = bodies.get(ev.message_id);
    if (!body) continue; // deleted or unreadable
    const link = body.link?.url ?? null;
    const role = body.link?.title ?? null;
    const description = body.description;

    const eventPatch = {
      ...(!ev.job_link && link ? { job_link: link } : {}),
      ...(!ev.job_description && description ? { job_description: description } : {}),
      ...(!ev.role && role ? { role } : {}),
    };
    if (Object.keys(eventPatch).length) await admin.from("email_events").update(eventPatch).eq("id", ev.id).eq("user_id", userId);

    if (ev.state !== "accepted") continue;
    // Accepted without a job id (e.g. merged into another email's job): find it by company and role.
    const jobId = ev.job_id ?? (ev.company ? findJob(jobs, ev.company, ev.role ?? role ?? "")?.id : null);
    if (!jobId) continue;
    touchedJobs.add(jobId);
    const { data } = await admin.from("jobs").select("title, link, job_description, applied_via").eq("id", jobId).eq("user_id", userId).maybeSingle();
    const job = data as { title: string; link: string | null; job_description: string | null; applied_via: string | null } | null;
    if (!job) continue;
    // How you applied, from an application confirmation (the sender's name is all that's stored).
    const via =
      job.applied_via === null && ev.kind === "applied"
        ? appliedViaFor({ from: { emailAddress: { name: ev.sender ?? "" } } }, link ?? ev.job_link, ev.company ?? "")
        : null;
    const jobPatch = {
      ...(via ? { applied_via: via } : {}),
      ...(!job.link && link ? { link } : {}),
      ...(!job.job_description?.trim() && description ? { job_description: description } : {}),
      ...(/^unknown role$/i.test(job.title.trim()) && role ? { title: role.slice(0, 200) } : {}),
    };
    if (Object.keys(jobPatch).length) {
      const { error: updateError } = await admin.from("jobs").update(jobPatch).eq("id", jobId).eq("user_id", userId);
      if (!updateError) updated.add(jobId);
    }
  }

  // Jobs from these emails that still have no description: look for the posting online.
  let descriptionsFound = 0;
  let lookups = 0;
  for (const jobId of touchedJobs) {
    if (lookups >= MAX_LOOKUPS) break;
    const status = await fillJobDescription(userId, jobId).catch(() => "error");
    if (status === "has_description") continue;
    lookups++;
    if (status === "found") descriptionsFound++;
  }

  return { emails: bodies.size, jobsUpdated: updated.size, descriptionsFound };
}
