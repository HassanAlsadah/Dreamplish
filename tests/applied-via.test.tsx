import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppliedViaCard } from "@/components/jobs/applied-via";
import { looksLikeApplicationSent } from "@/lib/email/classify";
import { appliedViaFor } from "@/lib/email/match";
import type { GraphMessage } from "@/lib/email/outlook";
import { getDictionary } from "@/lib/i18n/config";
import { jobSchema } from "@/lib/schemas/job";
import type { Job } from "@/lib/types";

const from = (address: string, name = ""): Pick<GraphMessage, "from"> => ({ from: { emailAddress: { address, name } } });
const sentTo = (subject: string, preview = "", to = "hr@acme.com"): GraphMessage => ({
  id: "m1",
  subject,
  bodyPreview: preview,
  toRecipients: [{ emailAddress: { address: to, name: "HR" } }],
});

describe("how you applied, from a received email", () => {
  it("recognises LinkedIn, job boards, hiring systems and the company's own address", () => {
    expect(appliedViaFor(from("jobs-noreply@linkedin.com", "LinkedIn"), null, "HungerStation")).toBe("linkedin");
    expect(appliedViaFor(from("noreply@x.com"), "https://www.linkedin.com/jobs/view/1/", "Acme")).toBe("linkedin");
    expect(appliedViaFor(from("alerts@bayt.com", "Bayt"), null, "Acme")).toBe("job_board");
    expect(appliedViaFor(from("no-reply@us.greenhouse-mail.io"), null, "Acme")).toBe("company_website");
    expect(appliedViaFor(from("careers@hungerstation.com"), null, "HungerStation")).toBe("company_website");
    expect(appliedViaFor(from("someone@gmail.com"), null, "Acme")).toBeNull();
  });
});

describe("Sent folder", () => {
  it("keeps emails that look like applications", () => {
    expect(looksLikeApplicationSent(sentTo("Application for Data Analyst position", "Please find my CV attached"))).toBe(true);
    expect(looksLikeApplicationSent(sentTo("طلب تقديم على وظيفة محلل بيانات", "مرفق السيرة الذاتية"))).toBe(true);
    expect(looksLikeApplicationSent(sentTo("Dinner on Friday?", "See you at 8"))).toBe(false);
    expect(looksLikeApplicationSent({ ...sentTo("Application"), toRecipients: [] })).toBe(false);
  });
});

describe("job form: how you applied", () => {
  const base = { company: "Acme", companyWebsite: "", title: "Analyst", link: "", status: "applied", dateApplied: "", notes: "", jobDescription: "" };
  it("accepts a channel with a detail, or nothing", () => {
    const ok = jobSchema.parse({ ...base, appliedVia: "whatsapp", appliedViaDetail: "To Ahmed (HR)" });
    expect(ok.appliedVia).toBe("whatsapp");
    expect(ok.appliedViaDetail).toBe("To Ahmed (HR)");
    expect(jobSchema.parse({ ...base, appliedVia: "", appliedViaDetail: "" }).appliedVia).toBeNull();
    expect(jobSchema.safeParse({ ...base, appliedVia: "carrier-pigeon", appliedViaDetail: "" }).success).toBe(false);
  });
});

describe("How you applied section", () => {
  const job = { applied_via: "whatsapp", applied_via_detail: "WhatsApp to Ahmed (HR)", date_applied: "2026-10-16" } as Job;
  it("shows the channel, the detail and the date", () => {
    render(<AppliedViaCard job={job} d={getDictionary("en")} locale="en" />);
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp to Ahmed (HR)")).toBeInTheDocument();
    expect(screen.getByText(/Oct 16, 2026|16 Oct 2026/)).toBeInTheDocument();
  });
  it("says when it isn't recorded", () => {
    render(<AppliedViaCard job={{ ...job, applied_via: null }} d={getDictionary("en")} locale="en" />);
    expect(screen.getByText(/Not recorded yet/)).toBeInTheDocument();
  });
});
