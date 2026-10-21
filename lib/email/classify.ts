import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import { redactCv } from "@/lib/ai/redact";
import { cleanCompany } from "./match";
import type { GraphMessage } from "./outlook";

/*
 * Two steps so most email never reaches the AI:
 *  1. A free keyword / sender pre-filter keeps only likely hiring emails.
 *  2. Gemini classifies those (subject, sender, first ~600 chars, personal details removed).
 */

const ATS_SENDERS =
  /greenhouse|lever\.co|workday|myworkday|smartrecruiters|taleo|icims|successfactors|jobvite|ashbyhq|workable|bamboohr|recruitee|teamtailor|breezy|bayt|naukrigulf|indeed|linkedin|careers|recruit|talent|hr@|jobs@|hiring/i;
const HIRING_WORDS =
  /application|applied|apply|interview|assessment|assignment|coding (test|challenge)|offer|position|candidate|candidacy|unfortunately|regret|not (be )?moving forward|next steps|shortlist|hiring|recruit|role|vacancy|طلبك|مقابلة|عرض وظيفي|التقديم|للأسف|الوظيفة/i;
const NOISE = /newsletter|unsubscribe from job alerts|jobs you may|recommended jobs|job alert|new jobs for you|people also viewed|weekly digest/i;

export function looksLikeHiringEmail(m: GraphMessage) {
  const from = `${m.from?.emailAddress?.address ?? ""} ${m.from?.emailAddress?.name ?? ""}`;
  const text = `${m.subject ?? ""} ${m.bodyPreview ?? ""}`;
  if (NOISE.test(text)) return false;
  return HIRING_WORDS.test(m.subject ?? "") || (ATS_SENDERS.test(from) && HIRING_WORDS.test(text));
}

/** Words in an email the user sent that suggest they're applying for a job. */
const APPLYING_WORDS =
  /\bappl(y|ying|ication)\b|\b(cv|resume|résumé|curriculum vitae)\b|\bposition\b|\bvacanc|\bopening\b|\brole\b|\binternship\b|\bjob\b|\bcandida|\bopportunit|تقديم|أتقدم|اتقدم|سيرة|السيرة الذاتية|وظيف|فرصة|تدريب/i;

/** Sent folder: likely an application (to someone else, about a job). */
export function looksLikeApplicationSent(m: GraphMessage) {
  const text = `${m.subject ?? ""} ${m.bodyPreview ?? ""}`;
  if (!m.toRecipients?.length || NOISE.test(text)) return false;
  return APPLYING_WORDS.test(text);
}

export type EmailKind = "applied" | "interview" | "assessment" | "offer" | "rejected";
export type Classified = {
  messageId: string;
  kind: EmailKind | "other";
  company: string;
  role: string;
  /** Interview / assessment type, e.g. "Technical interview", "HackerRank coding test" ("" otherwise). */
  detail: string;
  confidence: "low" | "medium" | "high";
};

const jsonSchema = {
  type: "object",
  properties: {
    emails: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          kind: { type: "string", enum: ["applied", "interview", "assessment", "offer", "rejected", "other"] },
          company: { type: "string", description: "The hiring company (not the job board or ATS), or empty" },
          role: { type: "string", description: "Job title as written, or empty" },
          detail: {
            type: "string",
            description: "For interview/assessment only: short type, e.g. 'Technical interview', 'HR phone screen', 'HackerRank coding test', 'Case study'. Otherwise empty",
          },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["index", "kind", "company", "role", "detail", "confidence"],
      },
    },
  },
  required: ["emails"],
};

const schema = z.object({
  emails: z.array(
    z.object({
      index: z.number().int(),
      kind: z.enum(["applied", "interview", "assessment", "offer", "rejected", "other"]),
      company: z.string(),
      role: z.string(),
      detail: z.string().default(""),
      confidence: z.enum(["low", "medium", "high"]),
    }),
  ),
});

/**
 * @param bodies plain text of each email (by message id), when it could be read; otherwise the
 *               short Outlook preview is used.
 */
export async function classifyEmails(messages: GraphMessage[], bodies: Map<string, string> = new Map()): Promise<Classified[]> {
  if (!messages.length) return [];
  const items = messages.map((m, i) => {
    return `#${i}\nFrom: ${m.from?.emailAddress?.name ?? ""}\nSubject: ${m.subject ?? ""}\nReceived: ${m.receivedDateTime ?? ""}\nText: ${emailText(m, bodies)}`;
  });

  const prompt = `You sort a job seeker's emails. For each email decide what it means for THEIR OWN job application:
- applied: confirms an application was received/submitted
- interview: invites to or schedules an interview / call with the employer
- assessment: an online test, coding challenge, assignment or case study to complete
- offer: a job offer
- rejected: the application was declined / not moving forward
- other: anything else — job alerts, recommendations, newsletters, marketing, networking, recruiter cold outreach
For interview and assessment, detail = the type in 2–5 words as stated (e.g. "Technical interview", "HR phone screen",
"Final interview with manager", "HackerRank coding test", "Case study"); "" if not stated or for other kinds.
company = the employer hiring (not LinkedIn, Indeed, Workday, Greenhouse, etc.); role = the job title. Use "" if not stated —
never guess. In LinkedIn "your application was sent to <company>" emails the job title is the line right after that sentence,
followed by "<company> · <city>". confidence: high only when the email clearly states both the outcome and the company.

${items.join("\n\n")}`;

  return toClassified(messages, await generateStructured({ prompt, jsonSchema, schema, temperature: 0 }));
}

/** Email text for the AI: email addresses, phone numbers and links removed. */
function emailText(m: GraphMessage, bodies: Map<string, string>) {
  const body = bodies.get(m.id);
  return redactCv(body ? body.slice(0, 1500) : (m.bodyPreview ?? "").slice(0, 600), null).text;
}

/** The recipient's organisation hint: their name and email domain (not the full address). */
function recipient(m: GraphMessage) {
  const r = m.toRecipients?.[0]?.emailAddress;
  const domain = r?.address?.split("@")[1] ?? "";
  return [r?.name, domain && `@${domain}`].filter(Boolean).join(" ");
}

/**
 * Emails the user SENT: is it a job application (CV / applying for a role), and to which company?
 * Only "applied" or "other" is returned.
 */
export async function classifySentEmails(messages: GraphMessage[], bodies: Map<string, string> = new Map()): Promise<Classified[]> {
  if (!messages.length) return [];
  const items = messages.map(
    (m, i) => `#${i}\nTo: ${recipient(m)}\nSubject: ${m.subject ?? ""}\nSent: ${m.receivedDateTime ?? ""}\nText: ${emailText(m, bodies)}`,
  );
  const prompt = `These are emails a job seeker SENT. For each one decide:
- applied: they are applying for a job — sending their CV / application for a role, or a general application to an employer
- other: anything else — follow-ups on an earlier application, thank-you notes, scheduling, replies, work or personal email
company = the employer they are applying to (from the text, the recipient's name or email domain; not Gmail/Outlook or a
job board); role = the job title they apply for. Use "" if not stated — never guess. detail = "".
confidence: high only when it is clearly an application and the company is clear.

${items.join("\n\n")}`;
  const out = await generateStructured({ prompt, jsonSchema, schema, temperature: 0 });
  return toClassified(messages, out).map((e) => (e.kind === "applied" ? e : { ...e, kind: "other" as const }));
}

function toClassified(messages: GraphMessage[], out: z.infer<typeof schema>): Classified[] {
  return out.emails
    .filter((e) => e.index >= 0 && e.index < messages.length)
    .map((e) => ({
      messageId: messages[e.index].id,
      kind: e.kind,
      company: cleanCompany(e.company),
      role: e.role.trim().slice(0, 200),
      detail: e.kind === "interview" || e.kind === "assessment" ? e.detail.trim().slice(0, 80) : "",
      confidence: e.confidence,
    }));
}
