import { z } from "zod";

/** Empty form fields arrive as "" — treat them as null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .transform((v) => (v === "" ? null : v));

export const optionalUrl = z
  .string()
  .trim()
  .max(2000, "tooLong")
  .refine((v) => v === "" || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "invalidUrl")
  .transform((v) => (v === "" ? null : v));

/** Map Zod issues to { field: errorKey } using the first issue per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message in KNOWN ? issue.message : "generic";
  }
  return out;
}

const KNOWN: Record<string, true> = {
  required: true,
  tooLong: true,
  invalidUrl: true,
  invalidEmail: true,
  passwordMin: true,
  invalidDate: true,
  futureDate: true,
  invalidStatus: true,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a row id (Postgres uuid); checked before an id from a URL or a client reaches a query. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
