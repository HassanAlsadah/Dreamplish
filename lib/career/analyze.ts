import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import { appearsIn } from "./text";
import type { JobAnalysis, Requirement } from "./types";

const jsonSchema = {
  type: "object",
  properties: {
    seniority: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["junior", "mid", "senior", "lead", "unknown"] },
        evidence: { type: "string", description: "Verbatim phrase from the job description, or empty" },
      },
      required: ["level", "evidence"],
    },
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short skill or tool name, e.g. 'React', 'Stakeholder management'" },
          kind: { type: "string", enum: ["skill", "tool"] },
          importance: { type: "string", enum: ["must", "nice"] },
          alternatives: {
            type: "array",
            items: { type: "string" },
            description: "When the posting accepts any one of several options, list them; otherwise empty",
          },
          matched_alternative: { type: "string", description: "Which option the CV shows, or empty" },
          jd_quote: { type: "string", description: "Verbatim phrase from the job description that states it" },
          cv_evidence: { type: "string", description: "Verbatim phrase from the CV proving it, or empty" },
        },
        required: ["name", "kind", "importance", "jd_quote", "cv_evidence"],
      },
    },
  },
  required: ["seniority", "requirements"],
};

const schema = z.object({
  seniority: z.object({ level: z.enum(["junior", "mid", "senior", "lead", "unknown"]), evidence: z.string() }),
  requirements: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["skill", "tool"]),
      importance: z.enum(["must", "nice"]),
      alternatives: z.array(z.string()).default([]),
      matched_alternative: z.string().default(""),
      jd_quote: z.string(),
      cv_evidence: z.string(),
    }),
  ),
});

type RawRequirement = z.infer<typeof schema>["requirements"][number];

const OPTION_WORDS = /\b(one of|any of|either|or|such as|e\.g\.|for example|similar)\b|\/|أو|أحد/i;

/**
 * Safety net for "any one of" requirements the model split up anyway: items quoting the same
 * posting phrase, when that phrase offers options ("one of", "or", "such as"…), become one
 * requirement that's satisfied if any of them is in the CV.
 */
export function mergeAlternatives(reqs: RawRequirement[]): RawRequirement[] {
  const groups = new Map<string, RawRequirement[]>();
  for (const r of reqs) {
    const key = r.jd_quote.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: RawRequirement[] = [];
  for (const [quote, group] of groups) {
    if (group.length < 2 || !OPTION_WORDS.test(quote) || / and /.test(quote.replace(/ or /g, ""))) {
      out.push(...group);
      continue;
    }
    const options = [...new Set(group.flatMap((g) => (g.alternatives.length ? g.alternatives : [g.name.replace(/\s*\(any one\)\s*$/i, "")])))];
    const hit = group.find((g) => g.cv_evidence.trim());
    out.push({
      name: options.length > 3 ? `${options.slice(0, 3).join(", ")}… (any one)` : `${options.slice(0, -1).join(", ")} or ${options.at(-1)} (any one)`,
      kind: group[0].kind,
      importance: group.some((g) => g.importance === "must") ? "must" : "nice",
      alternatives: options,
      matched_alternative: hit ? hit.matched_alternative || (hit.alternatives[0] ?? hit.name) : "",
      jd_quote: group[0].jd_quote,
      cv_evidence: hit?.cv_evidence ?? "",
    });
  }
  return out;
}

/** Must-haves count for 70%, nice-to-haves for 30% (100% must-haves if there are none). */
export function computeScore(reqs: Requirement[]): number {
  const must = reqs.filter((r) => r.importance === "must");
  const nice = reqs.filter((r) => r.importance === "nice");
  const ratio = (list: Requirement[]) => list.filter((r) => r.matched).length / list.length;
  if (!must.length && !nice.length) return 0;
  if (!nice.length) return Math.round(ratio(must) * 100);
  if (!must.length) return Math.round(ratio(nice) * 100);
  return Math.round(ratio(must) * 70 + ratio(nice) * 30);
}

export async function analyzeJob({ jobDescription, cv }: { jobDescription: string; cv: string | null }): Promise<JobAnalysis> {
  const prompt = `You analyse a job description${cv ? " and compare it with a candidate's CV" : ""}.

Rules:
- Extract up to 20 distinct requirements: skills (abilities, methods, soft skills) and tools (technologies, platforms, software).
- importance: "must" if the posting says required/must/essential or lists it under requirements; "nice" if preferred/plus/bonus/nice to have.
- ALTERNATIVES: when the posting accepts any ONE of several options ("at least one of Python, C or Java", "Java or C#",
  "experience with any of AWS, Azure, GCP", "a degree in CS, IT or similar"), output ONE requirement: name like
  "Python, C or Java (any one)", alternatives = the options. It is satisfied if the CV shows ANY one option — set
  cv_evidence to the CV phrase showing it and matched_alternative to that option. Never split such options into
  separate requirements. Lists that are all required ("Python and SQL") stay separate requirements.
- jd_quote: copy the exact phrase from the job description that states the requirement (character for character).
- seniority: infer from explicit wording (years of experience, title words like Senior/Lead/Junior). evidence = exact phrase, or "" with level "unknown".
- cv_evidence: ${
    cv
      ? `copy the exact phrase from the CV that clearly shows the candidate has this requirement. Use "" if the CV doesn't clearly show it — never stretch or assume.`
      : `always "" (no CV provided).`
  }
- Names in English, short and canonical.

JOB DESCRIPTION:
"""
${jobDescription}
"""
${cv ? `\nCANDIDATE CV (personal details replaced with placeholders):\n"""\n${cv}\n"""` : ""}`;

  const out = await generateStructured({ prompt, jsonSchema, schema, temperature: 0 });

  const seen = new Set<string>();
  const requirements: Requirement[] = [];
  for (const r of mergeAlternatives(out.requirements)) {
    const name = r.name.trim().slice(0, 80);
    const key = name.toLowerCase();
    // Every requirement must be traceable to the posting.
    if (!name || seen.has(key) || !appearsIn(r.jd_quote, jobDescription)) continue;
    seen.add(key);
    const evidenceOk = Boolean(cv) && appearsIn(r.cv_evidence, cv!);
    requirements.push({
      name,
      kind: r.kind,
      importance: r.importance,
      jdQuote: r.jd_quote.trim().slice(0, 300),
      matched: evidenceOk,
      cvEvidence: evidenceOk ? r.cv_evidence.trim().slice(0, 300) : null,
      verifiedBy: evidenceOk ? "cv" : undefined,
      ...(r.alternatives.length > 1
        ? { alternatives: r.alternatives.slice(0, 8), matchedVia: evidenceOk && r.matched_alternative ? r.matched_alternative : undefined }
        : {}),
    });
  }

  const seniorityEvidence = appearsIn(out.seniority.evidence, jobDescription) ? out.seniority.evidence.trim() : "";
  return {
    seniority: { level: seniorityEvidence ? out.seniority.level : "unknown", evidence: seniorityEvidence },
    requirements,
    score: cv && requirements.length ? computeScore(requirements) : null,
    cvUsed: Boolean(cv),
    generatedAt: new Date().toISOString(),
  };
}
