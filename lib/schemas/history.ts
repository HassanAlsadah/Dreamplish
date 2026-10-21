import { z } from "zod";

/**
 * Editing when a status change happened. No future dates; not earlier than the job's creation
 * unless the user confirms (e.g. logging an application made before adding the job).
 */
export function changeDateSchema(jobCreatedAt: string) {
  const created = Date.parse(jobCreatedAt) - 86_400_000; // one day of slack for time zones
  return z
    .object({
      id: z.uuid(),
      changedAt: z.iso.datetime({ offset: true, local: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
      note: z.string().trim().max(500, "tooLong").optional(),
      confirmBeforeCreated: z.boolean().default(false),
      /** The picked date in the user's time zone (YYYY-MM-DD): becomes Date applied for the application point. */
      localDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .refine((v) => Date.parse(v.changedAt) <= Date.now() + 5 * 60_000, { message: "futureDate", path: ["changedAt"] })
    .refine((v) => v.confirmBeforeCreated || Date.parse(v.changedAt) >= created, {
      message: "beforeCreated",
      path: ["changedAt"],
    });
}

export const STEP_KINDS = ["call", "assessment", "interview"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

/** Adding a Call / Assessment / Interview step by hand. Same date rules as editing a change. */
export function addStepSchema(jobCreatedAt: string) {
  const created = Date.parse(jobCreatedAt) - 86_400_000;
  return z
    .object({
      jobId: z.uuid(),
      kind: z.enum(STEP_KINDS),
      type: z.string().trim().min(1, "typeRequired").max(80, "tooLong"),
      changedAt: z.iso.datetime({ offset: true, local: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
      note: z.string().trim().max(400, "tooLong").optional(),
      confirmBeforeCreated: z.boolean().default(false),
    })
    .refine((v) => Date.parse(v.changedAt) <= Date.now() + 5 * 60_000, { message: "futureDate", path: ["changedAt"] })
    .refine((v) => v.confirmBeforeCreated || Date.parse(v.changedAt) >= created, {
      message: "beforeCreated",
      path: ["changedAt"],
    });
}
