import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import type { Locale } from "@/lib/i18n/config";
import { appearsIn } from "./text";
import type { InterviewPrep } from "./types";

const jsonSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["role", "behavioral", "company"] },
          question: { type: "string" },
          why: { type: "string", description: "One sentence: why they'd ask this / what they look for" },
          suggested_answer: { type: "string", description: "A suggested answer in the candidate's voice (first person)" },
          cv_basis: { type: "string", description: "Exact phrase copied from the CV that the answer draws on, or empty" },
        },
        required: ["category", "question", "why", "suggested_answer", "cv_basis"],
      },
    },
    talking_points: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string", description: "What the candidate can say, linking their experience to the company" },
          cv_evidence: { type: "string", description: "Verbatim phrase from the CV this is based on" },
          company_fact: { type: "string", description: "The company fact (from the briefing) it connects to, or empty" },
        },
        required: ["point", "cv_evidence", "company_fact"],
      },
    },
  },
  required: ["questions", "talking_points"],
};

const schema = z.object({
  questions: z.array(
    z.object({
      category: z.enum(["role", "behavioral", "company"]),
      question: z.string(),
      why: z.string(),
      suggested_answer: z.string().default(""),
      cv_basis: z.string().default(""),
    }),
  ),
  talking_points: z.array(z.object({ point: z.string(), cv_evidence: z.string(), company_fact: z.string() })),
});

export async function prepareInterview({
  jobTitle,
  company,
  jobDescription,
  cv,
  briefFacts,
  locale,
}: {
  jobTitle: string;
  company: string;
  jobDescription: string | null;
  cv: string | null;
  briefFacts: string[];
  locale: Locale;
}): Promise<InterviewPrep> {
  const language = locale === "ar" ? "Arabic" : "English";
  const prompt = `Prepare a candidate for an interview for "${jobTitle}" at ${company}.

Rules:
- Write questions, "why" and talking points in ${language}.
- questions: 10–12 total — about 5 role/technical (from the job description), 3–4 behavioural, and 2–3 about the company
  (use only the company facts below; if there are none, ask general motivation questions about the company).
- suggested_answer for every question: 3–6 sentences in the candidate's voice (first person), in ${language}.
  ${
    cv
      ? `Build it from real experience in the CV whenever it fits (behavioural answers in STAR form: situation, task, action, result) and set cv_basis to the exact CV phrase used.
  If the CV has nothing relevant, give a strong general approach WITHOUT claiming experience the candidate doesn't have, and set cv_basis to "".
  Never invent employers, projects, numbers or results. Keep placeholders like [NAME_1] as they are.`
      : `No CV was provided: give a strong general approach without claiming specific experience; cv_basis = "".`
  }
- talking_points: 4–6. Each links a real item from the CV (cv_evidence = exact phrase copied from the CV) to the role or to a company fact.
  company_fact must be copied from the company facts list, or "" if it links to the role instead. Never invent experience.
${cv ? "" : '- No CV was provided: return an empty "talking_points" array.\n'}
${jobDescription ? `JOB DESCRIPTION:\n"""\n${jobDescription}\n"""\n` : "No job description provided — base role questions on the job title.\n"}
COMPANY FACTS (from a sourced briefing):
${briefFacts.length ? briefFacts.map((f) => `- ${f}`).join("\n") : "(none)"}
${cv ? `\nCANDIDATE CV (personal details replaced with placeholders):\n"""\n${cv}\n"""` : ""}`;

  const out = await generateStructured({ prompt, jsonSchema, schema, temperature: 0.4 });
  const facts = briefFacts.join("\n");

  return {
    questions: out.questions
      .filter((q) => q.question.trim())
      .slice(0, 14)
      .map((q) => {
        // Only keep the CV link if that phrase really is in the CV.
        const cvBasis = cv && appearsIn(q.cv_basis, cv) ? q.cv_basis.trim() : "";
        return {
          category: q.category,
          question: q.question.trim(),
          why: q.why.trim(),
          suggestedAnswer: q.suggested_answer.trim(),
          cvBasis,
        };
      }),
    talkingPoints: cv
      ? out.talking_points
          // Talking points must rest on something real in the CV.
          .filter((t) => t.point.trim() && appearsIn(t.cv_evidence, cv))
          .slice(0, 8)
          .map((t) => ({
            point: t.point.trim(),
            cvEvidence: t.cv_evidence.trim(),
            companyFact: appearsIn(t.company_fact, facts) ? t.company_fact.trim() : "",
          }))
      : [],
    usedBrief: briefFacts.length > 0,
    generatedAt: new Date().toISOString(),
  };
}
