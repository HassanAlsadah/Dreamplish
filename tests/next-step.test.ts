import { describe, expect, it } from "vitest";
import { nextStep } from "@/lib/next-step";
import { getDictionary } from "@/lib/i18n/config";
import type { Stage } from "@/lib/stages";
import type { Job } from "@/lib/types";

const d = getDictionary("en");
const job = (extra: Partial<Job>): Job =>
  ({ id: "j1", status: "applied", link: null, job_description: "Duties…", date_applied: "2026-10-01", created_at: "2026-10-01T00:00:00Z", ...extra }) as Job;
const assessment = { preset: "assessment" } as Stage;
const step = (j: Partial<Job>, idleDays = 3, hasAnalysis = true, stage?: Stage) => nextStep({ job: job(j), stage, idleDays, hasAnalysis, d });

describe("next step on the job page", () => {
  it("suggests a follow-up after two weeks without a reply", () => {
    expect(step({}, 16)?.text).toBe("No change for 16 days. A short, polite follow-up often gets an answer.");
  });
  it("asks for a job description first, linking to the Details tab", () => {
    expect(step({ job_description: null })).toMatchObject({ action: { href: "/jobs/j1" } });
  });
  it("points to interview prep, or to Match & CV for an assessment", () => {
    expect(step({ status: "interview" })?.action?.href).toBe("/jobs/j1?tab=prep");
    expect(step({ status: "interview" }, 3, true, assessment)?.action?.href).toBe("/jobs/j1?tab=match");
  });
  it("suggests Match & CV while waiting if it hasn't been run", () => {
    expect(step({}, 3, false)?.action?.href).toBe("/jobs/j1?tab=match");
    expect(step({}, 3, true)?.action).toBeUndefined();
  });
  it("before applying, points to Match & CV (or to finding the description first)", () => {
    expect(step({ status: "saved" }, 0, false)).toMatchObject({ text: expect.stringMatching(/before you apply/), action: { href: "/jobs/j1?tab=match" } });
    expect(step({ status: "saved" }, 0, true)).toMatchObject({ text: expect.stringMatching(/I applied/), action: { label: "Tailor CV", href: "/jobs/j1?tab=match" } });
    expect(step({ status: "saved", job_description: null })?.action?.label).toBe("Find it");
  });

  it("handles offer and closed applications", () => {
    expect(step({ status: "offer" })?.text).toMatch(/offer/);
    expect(step({ status: "rejected" })?.text).toMatch(/closed/);
  });
});
