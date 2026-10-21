import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import type { StageNameI18n } from "@/lib/stages";

/** Common column names, so the usual ones translate instantly and without AI. [English, Arabic] */
const PHRASEBOOK: Array<[string, string]> = [
  ["Call", "اتصال"],
  ["Phone call", "مكالمة هاتفية"],
  ["Phone screen", "مكالمة أولية"],
  ["Screening", "الفرز الأولي"],
  ["HR call", "اتصال الموارد البشرية"],
  ["HR interview", "مقابلة الموارد البشرية"],
  ["Technical interview", "مقابلة تقنية"],
  ["Final interview", "المقابلة النهائية"],
  ["Second interview", "المقابلة الثانية"],
  ["Task", "مهمة"],
  ["Take-home task", "مهمة منزلية"],
  ["Case study", "دراسة حالة"],
  ["Follow-up", "متابعة"],
  ["Waiting", "بانتظار الرد"],
  ["No response", "بلا رد"],
  ["Ghosted", "بلا رد"],
  ["On hold", "معلّقة"],
  ["To apply", "للتقديم"],
  ["Wishlist", "قائمة الأمنيات"],
  ["Referral", "ترشيح"],
  ["Negotiation", "تفاوض"],
  ["Contract", "العقد"],
  ["Background check", "التحقق من الخلفية"],
  ["Medical check", "الفحص الطبي"],
  ["Accepted", "مقبول"],
  ["Withdrawn", "انسحبت"],
];

const key = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[ً-ْـ]/g, "") // Arabic diacritics and tatweel
    .replace(/[-_.,:;!?«»"'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const LOOKUP = new Map<string, StageNameI18n>(
  PHRASEBOOK.flatMap(([en, ar]) => [
    [key(en), { en, ar }],
    [key(ar), { en, ar }],
  ]),
);

const result = z.object({
  en: z.string().trim().min(1).max(40),
  ar: z.string().trim().min(1).max(40),
});

/**
 * A board column name in English and Arabic. The phrasebook covers the usual names; anything else
 * goes to Gemini. Throws when the AI isn't available — callers store {} so it isn't retried.
 */
export async function translateStageName(name: string): Promise<StageNameI18n> {
  const known = LOOKUP.get(key(name));
  if (known) return known;
  return generateStructured({
    prompt: [
      "Translate the name of a column on a job-application Kanban board (a hiring stage such as a call, task or interview).",
      "Return the name in English and in Arabic. Keep it as short as the original (at most 3 words), in the natural",
      "wording a job seeker in Saudi Arabia would use. If the name is already in one language, keep it as is for that",
      "language. Proper nouns and company or product names stay unchanged.",
      `Column name: ${JSON.stringify(name)}`,
    ].join("\n"),
    jsonSchema: {
      type: "object",
      properties: { en: { type: "string" }, ar: { type: "string" } },
      required: ["en", "ar"],
    },
    schema: result,
    temperature: 0,
  });
}
