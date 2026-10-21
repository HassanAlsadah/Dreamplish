import { z } from "zod";
import { APPLIED_VIA, JOB_STATUSES } from "@/lib/types";
import { optionalText, optionalUrl } from "./common";

const todayIso = () => new Date().toISOString().slice(0, 10);

export const jobSchema = z.object({
  company: z.string().trim().min(1, "required").max(200, "tooLong"),
  companyWebsite: optionalUrl,
  title: z.string().trim().min(1, "required").max(200, "tooLong"),
  link: optionalUrl,
  status: z.enum(JOB_STATUSES, "invalidStatus"),
  dateApplied: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "invalidDate")
    // allow one day of slack for timezones ahead of UTC
    .refine((v) => v === "" || v <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), "futureDate")
    .transform((v) => (v === "" ? null : v)),
  notes: optionalText(10_000),
  jobDescription: optionalText(30_000),
  appliedVia: z
    .union([z.enum(APPLIED_VIA), z.literal("")], "invalidStatus")
    .transform((v) => (v === "" ? null : v)),
  appliedViaDetail: optionalText(200),
});

export type JobInput = z.infer<typeof jobSchema>;

export const moveJobSchema = z.object({
  id: z.uuid(),
  /** A board_stages id. */
  stageId: z.uuid(),
  position: z.number().finite(),
});

/** "Check a job": enough to run Match & CV before applying. The description is what gets matched. */
export const checkJobSchema = jobSchema.pick({ company: true, title: true, link: true }).extend({
  jobDescription: z.string().trim().min(1, "required").max(30_000, "tooLong"),
});

/** A date the user picked in their own time zone (YYYY-MM-DD), not in the future. */
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate")
  .refine((v) => !Number.isNaN(Date.parse(v)), "invalidDate")
  .refine((v) => v <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), "futureDate");

export { todayIso };
