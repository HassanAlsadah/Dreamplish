import { describe, expect, it } from "vitest";
import { isNeverRead, isOwnOrAtsPage, matchingPosting, parsePostings, postingForLink, sameRole } from "@/lib/career/job-posting";

const duties = "Own product operations for the ordering experience, run launches with engineering and design, and track quality metrics. ";
const page = (posting: object) => `<html><head><script type="application/ld+json">${JSON.stringify(posting)}</script></head><body>…</body></html>`;
const POSTING = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Product Operations Senior Specialist",
  hiringOrganization: { "@type": "Organization", name: "HungerStation" },
  description: `<p>${duties.repeat(3)}</p><ul><li>5+ years in operations</li></ul>`,
};

describe("job posting pages", () => {
  it("reads the structured posting (also inside @graph and entity-encoded HTML)", () => {
    const encoded = { "@graph": [{ "@type": "WebPage" }, { ...POSTING, description: `&lt;p&gt;${duties.repeat(3)}&lt;/p&gt;` }] };
    const [p] = parsePostings(page(encoded));
    expect(p.title).toBe("Product Operations Senior Specialist");
    expect(p.company).toBe("HungerStation");
    expect(p.description).toContain("Own product operations");
    expect(p.description).not.toContain("<p>");
  });

  it("uses a posting only for the same company and role", () => {
    expect(matchingPosting(page(POSTING), "HungerStation", "Product Operations Senior Specialist")?.description).toContain("5+ years");
    expect(matchingPosting(page(POSTING), "Jahez", "Product Operations Senior Specialist")).toBeNull();
    expect(matchingPosting(page(POSTING), "HungerStation", "Senior Software Engineer")).toBeNull();
    expect(matchingPosting(page({ ...POSTING, description: "Short." }), "HungerStation", "Product Operations Senior Specialist")).toBeNull();
    expect(matchingPosting("<html>no structured data</html>", "HungerStation", "Product Operations Senior Specialist")).toBeNull();
  });

  it("accepts a parent company's posting when the description names the company", () => {
    const parent = { ...POSTING, hiringOrganization: { name: "Delivery Hero" }, description: `<p>${duties.repeat(3)} Promote HungerStation values.</p>` };
    expect(matchingPosting(page(parent), "HungerStation", "Product Operations Senior Specialist")).not.toBeNull();
    const other = { ...parent, description: `<p>${duties.repeat(3)}</p>` };
    expect(matchingPosting(page(other), "HungerStation", "Product Operations Senior Specialist")).toBeNull();
  });

  it("matches roles strictly (seniority ignored)", () => {
    expect(sameRole("Product Operations Senior Specialist", "Product Operations Specialist")).toBe(true);
    expect(sameRole("Product Operations Specialist", "Operations Analyst")).toBe(false);
  });

  it("only trusts the company's own site or a hiring system, never LinkedIn or Glassdoor", () => {
    expect(isOwnOrAtsPage("https://boards.greenhouse.io/hungerstation/jobs/1", "HungerStation", null)).toBe(true);
    expect(isOwnOrAtsPage("https://deliveryhero.wd3.myworkdayjobs.com/en-US/x/job/Riyadh/123", "HungerStation", null)).toBe(true);
    expect(isOwnOrAtsPage("https://careers.hungerstation.com/jobs/1", "HungerStation", null)).toBe(true);
    expect(isOwnOrAtsPage("https://jobs.example.sa/1", "Acme", "https://www.example.sa")).toBe(true);
    expect(isOwnOrAtsPage("https://www.linkedin.com/jobs/view/1/", "HungerStation", null)).toBe(false);
    expect(isOwnOrAtsPage("https://www.glassdoor.com/job-listing/x", "HungerStation", null)).toBe(false);
    expect(isOwnOrAtsPage("https://random-jobboard.com/hunger", "HungerStation", null)).toBe(false);
    expect(isOwnOrAtsPage("https://careers.deliveryhero.com/job/product-operations-jid-5731", "HungerStation", null)).toBe(true);
    expect(isOwnOrAtsPage("https://www.bayt.com/en/international/jobs/hungerstation-jobs", "HungerStation", null)).toBe(false);
  });
});

describe("a link pasted in the job form", () => {
  it("takes the posting when company and role are still empty, and checks whichever is filled in", () => {
    expect(postingForLink(page(POSTING), "", "")?.title).toBe("Product Operations Senior Specialist");
    expect(postingForLink(page(POSTING), "HungerStation", "")).not.toBeNull();
    expect(postingForLink(page(POSTING), "", "Senior Software Engineer")).toBeNull();
    expect(postingForLink(page(POSTING), "Jahez", "")).toBeNull();
  });

  it("never reads LinkedIn or Glassdoor", () => {
    expect(isNeverRead("https://www.linkedin.com/jobs/view/4012345678/")).toBe(true);
    expect(isNeverRead("https://www.glassdoor.com/job-listing/x")).toBe(true);
    expect(isNeverRead("https://boards.greenhouse.io/acme/jobs/1")).toBe(false);
  });
});
