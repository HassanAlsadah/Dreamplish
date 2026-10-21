import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import type { Locale } from "@/lib/i18n/config";
import { computeScore } from "./analyze";
import type { JobAnalysis, SelfAssessment, SkillCheck, SkillQuestion } from "./types";

const MAX_SKILLS = 5;
const QUESTIONS_PER_SKILL = 3;
/** "I don't know" is sent as -1 and always counts as wrong. */
export const IDK = -1;

const jsonSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill_number: { type: "integer", description: "The number of the skill in the list (1-based)" },
          skill: { type: "string", description: "The skill name as written in the list" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, description: "Exactly 4 answer options" },
          answer_index: { type: "integer", description: "0-based index of the single correct option" },
          explanation: { type: "string", description: "One sentence on why the answer is correct" },
        },
        required: ["skill_number", "skill", "question", "options", "answer_index", "explanation"],
      },
    },
  },
  required: ["questions"],
};

const schema = z.object({
  questions: z.array(
    z.object({
      skill_number: z.number().int().optional(),
      skill: z.string(),
      question: z.string(),
      options: z.array(z.string()),
      answer_index: z.number().int(),
      explanation: z.string(),
    }),
  ),
});

/** All gaps the user is asked about (must-haves first). */
export function gapsToAssess(analysis: JobAnalysis) {
  return analysis.requirements
    .filter((r) => !r.matched)
    .sort((a, b) => (a.importance === b.importance ? 0 : a.importance === "must" ? -1 : 1));
}

/** Questions only for the skills the user wasn't sure about. */
export async function createSkillCheck(
  analysis: JobAnalysis,
  jobTitle: string,
  locale: Locale,
  onlySkills: string[],
): Promise<SkillCheck> {
  const wanted = new Set(onlySkills);
  const gaps = gapsToAssess(analysis).filter((g) => wanted.has(g.name)).slice(0, MAX_SKILLS);
  const language = locale === "ar" ? "Arabic" : "English";
  const prompt = `Write a short skill check for a candidate applying to "${jobTitle}".
For EACH skill below write exactly ${QUESTIONS_PER_SKILL} multiple-choice questions: one basic, one intermediate and one
practical scenario. Together they should show whether the candidate really knows the skill — someone with hands-on
experience answers them correctly, a beginner does not. Avoid trivia; don't repeat the same idea twice.

Rules:
- Exactly 4 options, exactly one correct; plausible distractors; don't make the correct option the longest one.
- Do NOT include an "I don't know" option — the app adds it.
- Write question, options and explanation in ${language} (keep technical terms and code in English).
- "skill_number" = the skill's number in this list; "skill" = its name copied from the list (in English).

Skills:
${gaps.map((g, i) => `${i + 1}. ${g.name} (${g.kind})`).join("\n")}`;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.]/g, "");
  const byName = new Map(gaps.map((g) => [norm(g.name), g.name]));

  // Free-tier models sometimes return malformed items; try twice before giving up.
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await generateStructured({ prompt, jsonSchema, schema, temperature: 0.4 });
    const perSkill = new Map<string, SkillQuestion[]>();
    for (const q of out.questions) {
      // Match by number first, then by (loosely compared) name.
      const skill =
        (q.skill_number && gaps[q.skill_number - 1]?.name) || byName.get(norm(q.skill)) || null;
      const options = q.options.map((o) => o.trim()).filter(Boolean).slice(0, 5);
      const list = skill ? (perSkill.get(skill) ?? []) : [];
      const valid =
        skill &&
        list.length < QUESTIONS_PER_SKILL &&
        q.question.trim() &&
        options.length >= 3 &&
        q.answer_index >= 0 &&
        q.answer_index < options.length;
      if (!valid) continue;
      list.push({ skill, question: q.question.trim(), options, answerIndex: q.answer_index, explanation: q.explanation.trim() });
      perSkill.set(skill, list);
    }
    // A skill needs at least 2 questions to be tested fairly; keep the gaps' order.
    const questions = gaps.flatMap((g) => {
      const list = perSkill.get(g.name) ?? [];
      return list.length >= 2 ? list : [];
    });
    if (questions.length) return { status: "pending", questions };
    console.warn(`skill check attempt ${attempt + 1}: ${out.questions.length} questions returned, none usable`);
  }
  return { status: "pending", questions: [] };
}

/** Applies "yes" answers and passed tests to the requirements and recomputes the score. */
export function finishSkillCheck(
  analysis: JobAnalysis,
  check: SkillCheck,
  passedByTest: Set<string>,
): JobAnalysis {
  const said = (name: string): SelfAssessment | undefined => check.assessment?.[name];
  const requirements = analysis.requirements.map((r) => {
    if (r.matched) return r;
    if (passedByTest.has(r.name)) return { ...r, matched: true, verifiedBy: "test" as const };
    if (said(r.name) === "yes") return { ...r, matched: true, verifiedBy: "self" as const };
    return r;
  });
  return {
    ...analysis,
    requirements,
    score: analysis.cvUsed ? computeScore(requirements) : analysis.score,
    skillCheck: { ...check, status: "done" },
  };
}

/** Grades answers server-side and folds passed skills into the match score. */
export function gradeSkillCheck(analysis: JobAnalysis, answers: number[]): JobAnalysis {
  const check = analysis.skillCheck!;
  const results = check.questions.map((q, i) => ({
    skill: q.skill,
    chosen: answers[i],
    correct: answers[i] !== IDK && answers[i] === q.answerIndex,
    answerIndex: q.answerIndex ?? -1,
    explanation: q.explanation ?? "",
  }));
  // A skill is verified when at least 2 of its 3 answers (two-thirds) are correct.
  const tally = new Map<string, { right: number; total: number }>();
  for (const r of results) {
    const t = tally.get(r.skill) ?? { right: 0, total: 0 };
    t.total++;
    if (r.correct) t.right++;
    tally.set(r.skill, t);
  }
  const passed = new Set([...tally].filter(([, t]) => t.right >= Math.ceil((t.total * 2) / 3)).map(([s]) => s));
  return finishSkillCheck(analysis, { ...check, results }, passed);
}

/** What the browser may see: no answers until the check is graded. */
export function publicAnalysis(analysis: JobAnalysis | null): JobAnalysis | null {
  if (!analysis?.skillCheck) return analysis;
  const check = analysis.skillCheck;
  if (check.status !== "pending") return analysis;
  return {
    ...analysis,
    skillCheck: {
      ...check,
      questions: check.questions.map(({ skill, question, options }) => ({ skill, question, options })),
    },
  };
}
