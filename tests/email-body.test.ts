import { describe, expect, it } from "vitest";
import { findDescription, findJobLink, htmlToText } from "@/lib/email/body";
import { cleanCompany } from "@/lib/email/match";

// Shaped like LinkedIn's "Your application was sent to …" email.
const LINKEDIN = `
<table><tr><td><a href="https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=abc&amp;refId=xyz&amp;lipi=urn"><img src="logo.png" alt=""></a></td>
<td><h2>Your application was sent to HungerStation | هنقرستيشن</h2>
<a href="https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=abc&amp;midToken=1">Product Operations Senior Specialist</a>
<p>HungerStation | هنقرستيشن · Riyadh (On-site)</p><p>Applied on October 16, 2026</p>
<a href="https://www.linkedin.com/comm/jobs/view/4012345678/?x=1">View job</a></td></tr></table>
<h3>Jobs similar to this</h3>
<a href="https://www.linkedin.com/comm/jobs/view/4099999999/">Senior Operations Analyst</a>
<a href="https://www.linkedin.com/comm/psettings/email-unsubscribe">Unsubscribe</a>`;

describe("job email body", () => {
  it("finds the LinkedIn job link without tracking, and the role from its link text", () => {
    expect(findJobLink(LINKEDIN)).toEqual({
      url: "https://www.linkedin.com/jobs/view/4012345678/",
      title: "Product Operations Senior Specialist",
    });
  });

  it("ignores button text and stops before 'similar jobs'", () => {
    const html = `<a href="https://www.linkedin.com/jobs/view/111111111/">View job</a><a href="https://www.linkedin.com/jobs/view/222222222/">Other role</a>`;
    expect(findJobLink(html)).toEqual({ url: "https://www.linkedin.com/jobs/view/111111111/", title: null });
  });

  it("finds hiring-site links and drops tracking parameters", () => {
    const html = `<a href="https://boards.greenhouse.io/acme/jobs/4455?gh_src=x&amp;utm_source=email">Backend Engineer</a>`;
    expect(findJobLink(html)).toEqual({ url: "https://boards.greenhouse.io/acme/jobs/4455?gh_src=x", title: "Backend Engineer" });
    expect(findJobLink(`<a href="https://example.com/news">Read</a>`)).toBeNull();
  });

  it("turns HTML into readable text", () => {
    const text = htmlToText(LINKEDIN);
    expect(text).toContain("Product Operations Senior Specialist");
    expect(text).not.toContain("<");
  });

  it("keeps a job description written in the email, and nothing otherwise", () => {
    const duties = "Own the product operations roadmap and work with engineering, design and ops teams. ".repeat(5);
    const text = `Thank you for applying.\n\nJob description\n${duties}\n\nUnsubscribe from these emails`;
    const found = findDescription(text);
    expect(found?.startsWith("Job description")).toBe(true);
    expect(found).not.toContain("Unsubscribe");
    expect(findDescription(htmlToText(LINKEDIN))).toBeNull();
  });

  it("cleans bilingual company names", () => {
    expect(cleanCompany("HungerStation | هنقرستيشن")).toBe("HungerStation");
    expect(cleanCompany("Acme")).toBe("Acme");
  });
});
