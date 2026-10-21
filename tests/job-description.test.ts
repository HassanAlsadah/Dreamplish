import { describe, expect, it } from "vitest";
import { parseDescription } from "@/components/jobs/job-description";

describe("parseDescription", () => {
  it("turns posting text into headings, paragraphs and lists", () => {
    const text = "We build payments.\nOur team is small.\n\nResponsibilities:\n- Build APIs\n• Review code\n\nRequirements\n1. 3+ years\n2) TypeScript";
    expect(parseDescription(text)).toEqual([
      { kind: "paragraph", text: "We build payments. Our team is small." },
      { kind: "heading", text: "Responsibilities" },
      { kind: "list", items: ["Build APIs", "Review code"] },
      { kind: "heading", text: "Requirements" },
      { kind: "list", items: ["3+ years", "TypeScript"] },
    ]);
  });

  it("keeps a sentence ending in a full stop as a paragraph", () => {
    expect(parseDescription("Apply by Friday.\n- CV")).toEqual([
      { kind: "paragraph", text: "Apply by Friday." },
      { kind: "list", items: ["CV"] },
    ]);
  });
});
