import { describe, expect, it } from "vitest";
import { LEGAL, LEGAL_DOCS } from "@/lib/legal";

describe("legal pages", () => {
  it("have a real contact address (published on the live site)", () => {
    expect(LEGAL.contactEmail).toMatch(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i);
  });

  it("say the same things in English and Arabic", () => {
    for (const doc of Object.values(LEGAL_DOCS)) {
      expect(doc.ar.sections.length).toBe(doc.en.sections.length);
      doc.en.sections.forEach((section, i) => {
        const ar = doc.ar.sections[i];
        expect(ar.body.length, section.title).toBe(section.body.length);
        section.body.forEach((part, j) => expect(Array.isArray(ar.body[j]) && ar.body[j].length, `${section.title} #${j}`).toBe(Array.isArray(part) && part.length));
      });
    }
  });
});
