import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import { redactCv, type Redaction } from "@/lib/ai/redact";
import { appearsIn } from "./text";
import { confirmedSkills, type JobAnalysis, type TailoredCv } from "./types";

const jsonSchema = {
  type: "object",
  properties: {
    tailored_cv: { type: "string", description: "The full tailored CV as plain text with section headings" },
    changes: { type: "array", items: { type: "string" }, description: "Short list of what was changed and why" },
    consider_adding: {
      type: "array",
      items: { type: "string" },
      description: "Requirements the CV doesn't show, phrased as suggestions for the candidate to add only if true",
    },
    paraphrases: {
      type: "array",
      description: "Every CV line you reworded to mirror the job description",
      items: {
        type: "object",
        properties: {
          original: { type: "string", description: "The original line, copied exactly from the CV" },
          rewritten: { type: "string", description: "The new wording used in the tailored CV" },
          jd_terms: { type: "array", items: { type: "string" }, description: "Job-description terms now used" },
        },
        required: ["original", "rewritten", "jd_terms"],
      },
    },
  },
  required: ["tailored_cv", "changes", "consider_adding", "paraphrases"],
};

const schema = z.object({
  tailored_cv: z.string().min(50),
  changes: z.array(z.string()),
  consider_adding: z.array(z.string()),
  paraphrases: z
    .array(z.object({ original: z.string(), rewritten: z.string(), jd_terms: z.array(z.string()) }))
    .default([]),
});

const numbers = (s: string) => new Set(s.match(/\d[\d,.]*%?/g)?.map((n) => n.replace(/[,.]$/, "")) ?? []);

export async function tailorCv({
  redacted,
  jobTitle,
  company,
  jobDescription,
  analysis,
}: {
  redacted: Redaction;
  jobTitle: string;
  company: string;
  jobDescription: string | null;
  analysis: JobAnalysis | null;
}): Promise<TailoredCv> {
  const gaps = analysis?.requirements.filter((r) => !r.matched).map((r) => r.name) ?? [];
  const confirmed = confirmedSkills(analysis);
  const wanted = analysis?.requirements.map((r) => `${r.name} (${r.importance})`) ?? [];

  const prompt = `Tailor the candidate's CV for the role "${jobTitle}" at ${company}.

Strict rules — honesty first:
- Use ONLY facts already in the CV. Never invent or inflate skills, tools, employers, titles, dates, degrees, certifications or numbers.
- Paraphrase to match the job description: for every summary sentence, bullet and skill that relates to the job,
  rewrite it using the job description's own words, keywords and phrasing (so recruiters and ATS systems recognise
  the match) — but ONLY where the meaning stays true. Example: CV "built dashboards for managers" + JD "data
  visualization" → "Built data visualization dashboards for managers". Do not change what the candidate actually did,
  their level of responsibility, or any numbers.
- Also: reorder sections and bullets, rewrite the summary for this role, move the most relevant experience and skills first,
  and trim content that isn't relevant. Keep the original section structure (same sections, same order of jobs).
- paraphrases: list every line you reworded — "original" copied exactly from the CV, "rewritten" as it appears in the
  tailored CV, and the job-description terms you brought in.
- Keep placeholders like [NAME_1], [EMAIL_1], [PHONE_1], [LINK_1] exactly as they are.
- Write in the same language as the original CV. Plain text only (no markdown symbols like ** or #); use UPPERCASE section headings.
${
    confirmed.length
      ? `- The candidate CONFIRMED they have these skills (not yet in the CV): ${confirmed.join(", ")}.
  ADD every one of them to the CV's skills section (create a SKILLS section if there is none). Do not invent experience for them.
`
      : ""
  }- consider_adding: for requirements the CV does not show${gaps.length ? ` (likely: ${gaps.join(", ")})` : ""}, write short suggestions
  such as "If you have used Docker, add it under Skills". Never add them to the CV yourself.
- changes: 3–8 short bullets explaining what you changed.

${wanted.length ? `Requirements from the posting: ${wanted.join(", ")}\n` : ""}${
    jobDescription ? `JOB DESCRIPTION:\n"""\n${jobDescription}\n"""\n` : ""
  }
ORIGINAL CV:
"""
${redacted.text}
"""`;

  const out = await generateStructured({ prompt, jsonSchema, schema, temperature: 0.3 });

  // Any number that isn't in the original CV is flagged for the user to check.
  const original = numbers(redacted.text);
  const warnings = [...numbers(out.tailored_cv)].filter((n) => !original.has(n)).slice(0, 10);

  // Only report rewordings whose original line really is in the CV.
  const paraphrases = out.paraphrases
    .filter((p) => p.rewritten.trim() && appearsIn(p.original, redacted.text))
    .slice(0, 15)
    .map((p) => ({
      original: redacted.restore(p.original.trim()),
      rewritten: redacted.restore(p.rewritten.trim()),
      jdTerms: p.jd_terms.map((t) => t.trim()).filter(Boolean).slice(0, 5),
    }));

  let tailoredText = redacted.restore(out.tailored_cv.trim());
  const missing = confirmed.filter((k) => !tailoredText.toLowerCase().includes(k.toLowerCase()));
  if (missing.length) tailoredText += `\n\nADDITIONAL SKILLS\n${missing.join(", ")}`;

  return {
    text: tailoredText,
    paraphrases,
    changes: out.changes.map((c) => c.trim()).filter(Boolean).slice(0, 10),
    considerAdding: out.consider_adding.map((c) => c.trim()).filter(Boolean).slice(0, 10),
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

const docxJsonSchema = {
  type: "object",
  properties: {
    paragraphs: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "integer" }, text: { type: "string" } },
        required: ["id", "text"],
      },
      description: "Every paragraph id from the input, in the same order, with its (possibly rewritten) text",
    },
    changes: jsonSchema.properties.changes,
    consider_adding: jsonSchema.properties.consider_adding,
    paraphrases: jsonSchema.properties.paraphrases,
  },
  required: ["paragraphs", "changes", "consider_adding", "paraphrases"],
};

const docxSchema = z.object({
  paragraphs: z.array(z.object({ id: z.number().int(), text: z.string() })),
  changes: z.array(z.string()),
  consider_adding: z.array(z.string()),
  paraphrases: z
    .array(z.object({ original: z.string(), rewritten: z.string(), jd_terms: z.array(z.string()) }))
    .default([]),
});

/**
 * Tailors a Word CV paragraph by paragraph. The paragraph list (count and order) never changes,
 * so the result can be written back into the user's own file with its formatting intact.
 */
export async function tailorDocx({
  paragraphs,
  fullName,
  jobTitle,
  company,
  jobDescription,
  analysis,
}: {
  paragraphs: string[];
  fullName: string | null;
  jobTitle: string;
  company: string;
  jobDescription: string | null;
  analysis: JobAnalysis | null;
}): Promise<TailoredCv> {
  // Redact the whole document at once so placeholders are consistent across paragraphs.
  const redacted = redactCv(paragraphs.join("\n"), fullName);
  const redactedParas = redacted.text.split("\n");
  const gaps = analysis?.requirements.filter((r) => !r.matched).map((r) => r.name) ?? [];
  const confirmed = confirmedSkills(analysis);
  const wanted = analysis?.requirements.map((r) => `${r.name} (${r.importance})`) ?? [];

  const prompt = `Tailor this CV for the role "${jobTitle}" at ${company}. The CV is a Word document split into numbered
paragraphs. You may only rewrite the TEXT of paragraphs — the document's layout must stay identical.

Strict rules:
- Return EVERY paragraph id exactly once, in the same order. Never merge, split, add or reorder paragraphs.
- Keep empty paragraphs empty. Keep the name, contact details, section headings, job titles, employer names and dates unchanged.
- Paraphrase summary sentences, bullets and skills that relate to the job using the job description's own words and
  keywords, but ONLY where the meaning stays true (e.g. "built dashboards" + JD "data visualization" →
  "Built data visualization dashboards"). Keep each paragraph about the same length so the layout still fits.
- Use ONLY facts already in the CV. Never invent or inflate skills, tools, employers, titles, dates, degrees or numbers.
- Keep placeholders like [NAME_1], [EMAIL_1], [PHONE_1], [LINK_1] exactly as they are. Write in the CV's language.
${
    confirmed.length
      ? `- The candidate CONFIRMED they have these skills (not yet in the CV): ${confirmed.join(", ")}.
  ADD every one of them to the paragraph that lists skills (append them to that list). If there is no skills list,
  add them to the summary paragraph. Do not invent experience for them.
`
      : ""
  }- consider_adding: suggestions for requirements the CV doesn't show${gaps.length ? ` (likely: ${gaps.join(", ")})` : ""}, only if true.
- changes: 3–8 short bullets. paraphrases: every paragraph you reworded (original copied exactly, rewritten, JD terms used).

${wanted.length ? `Requirements from the posting: ${wanted.join(", ")}\n` : ""}${
    jobDescription ? `JOB DESCRIPTION:\n"""\n${jobDescription}\n"""\n` : ""
  }
CV PARAGRAPHS:
${redactedParas.map((p, i) => `P${i + 1}| ${p}`).join("\n")}`;

  const out = await generateStructured({ prompt, jsonSchema: docxJsonSchema, schema: docxSchema, temperature: 0.3 });

  // Anything missing or out of range keeps its original text; empty paragraphs stay empty.
  const byId = new Map(out.paragraphs.map((p) => [p.id, p.text.replace(/\s+/g, " ").trim()]));
  const rewritten = redactedParas.map((orig, i) => {
    const next = byId.get(i + 1);
    if (!orig.trim() || next === undefined || !next) return orig;
    return next;
  });

  // Safety net: confirmed skills the model didn't place go onto the skills line (paragraphs can't be added).
  const missing = confirmed.filter((k) => !rewritten.join("\n").toLowerCase().includes(k.toLowerCase()));
  if (missing.length) {
    const heading = rewritten.findIndex((p) => /^(skills|technical skills|core skills|المهارات|مهارات)\b/i.test(p.trim()));
    const target = heading >= 0 ? rewritten.findIndex((p, i) => i > heading && p.trim()) : -1;
    if (target >= 0) rewritten[target] = `${rewritten[target].replace(/[.\s]+$/, "")}, ${missing.join(", ")}`;
  }

  const original = numbers(redacted.text);
  const warnings = [...numbers(rewritten.join("\n"))].filter((n) => !original.has(n)).slice(0, 10);
  const paraphrases = out.paraphrases
    .filter((p) => p.rewritten.trim() && appearsIn(p.original, redacted.text))
    .slice(0, 15)
    .map((p) => ({
      original: redacted.restore(p.original.trim()),
      rewritten: redacted.restore(p.rewritten.trim()),
      jdTerms: p.jd_terms.map((t) => t.trim()).filter(Boolean).slice(0, 5),
    }));

  return {
    text: rewritten.map((p) => redacted.restore(p)).join("\n"),
    mode: "docx",
    paragraphCount: paragraphs.length,
    paraphrases,
    changes: out.changes.map((c) => c.trim()).filter(Boolean).slice(0, 10),
    considerAdding: out.consider_adding.map((c) => c.trim()).filter(Boolean).slice(0, 10),
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
