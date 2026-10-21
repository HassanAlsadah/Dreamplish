import type { ProviderResult, ResearchInput } from "../types";

/**
 * Free, offline provider for development. Every item points at example.com and
 * the UI labels mock briefs as sample data, so nothing here can pass for a real fact.
 */
export async function mockResearch(input: ResearchInput): Promise<ProviderResult> {
  await new Promise((r) => setTimeout(r, 4000)); // let the "generating" state show

  const slug = input.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "company";
  const src = (path: string, title = "example.com (sample)") => [{ url: `https://example.com/${slug}/${path}`, title }];
  const daysAgo = (n: number) => new Date(Date.parse(input.today) - n * 86_400_000).toISOString().slice(0, 10);
  const name = input.companyName;

  return {
    provider: "mock",
    summary: {
      text: `Sample: ${name} is a large regional company offering digital and enterprise services. It has grown steadily over the past decade and is currently investing in cloud products and new engineering hubs.`,
      sources: src("about"),
    },
    news: [
      { text: `Sample: ${name} announced a new partnership to expand its digital services.`, sources: src("news/partnership"), publishedAt: daysAgo(9) },
      { text: `Sample: ${name} reported quarterly results ahead of analyst expectations.`, sources: src("news/results"), publishedAt: daysAgo(34) },
      { text: `Sample: ${name} opened a new engineering hub and plans to hire 200 people.`, sources: src("news/hub"), publishedAt: daysAgo(61) },
    ],
    projects: [
      { name: `${name} Cloud`, text: "Sample: The company's flagship platform for business customers.", sources: src("products/cloud") },
      { name: `${name} App`, text: "Sample: A mobile app used by millions of consumers in the region.", sources: src("products/app") },
    ],
    values: [
      { text: "Sample: Customer obsession — decisions start from the customer's needs.", sources: src("about/values") },
      { text: "Sample: Ownership — teams are accountable for outcomes end to end.", sources: src("about/values") },
      { text: "Sample: Learning — employees get a yearly learning budget.", sources: src("careers/culture") },
    ],
    skills: ["TypeScript", "React", "Cloud (AWS or Azure)", "SQL", "Communication in Arabic and English"].map((s, i) => ({
      text: `Sample: ${s}`,
      sources: src(`careers/job-${i + 1}`, "example.com careers (sample)"),
    })),
    salary: input.roles.slice(0, 3).map((role, i) => ({
      role,
      min: 15000 + i * 2000,
      max: 22000 + i * 3000,
      currency: "SAR",
      period: "month" as const,
      note: "Sample figure for Riyadh",
      sources: [...src("salaries/a"), ...src("salaries/b")],
      confidence: "medium" as const,
    })),
    roleInsights: {
      duties: input.roles.slice(0, 3).flatMap((role) => [
        { role, text: "Sample: Build and maintain features for client projects.", quote: `As a ${role} you will build and maintain features.`, sources: src("careers/role") },
        { role, text: "Sample: Work in an Agile team with designers and QA.", quote: "You will work in an Agile team with designers and QA.", sources: src("careers/role") },
      ]),
      team_work: [
        { text: "Sample: The engineering team migrated a large portal to microservices.", quote: "Our team migrated the portal to microservices.", published_at: daysAgo(200), sources: src("blog/microservices") },
      ],
      tools: ["React", "Node.js", "Azure"].map((t) => ({ text: t, sources: src("careers/role") })),
    },
    watchouts: [
      {
        category: "layoffs" as const,
        status: "confirmed" as const,
        text: `Sample: ${name} confirmed it cut about 5% of its workforce as part of a restructuring.`,
        quote: `${name} confirmed it would reduce its workforce by around 5 percent.`,
        published_at: daysAgo(120),
        interview_tip: "How has the team I'd join been affected by last year's restructuring?",
        sources: src("news/restructuring"),
      },
    ],
    searchSuggestions: null,
    links: { website: `https://example.com/${slug}`, linkedin: `https://www.linkedin.com/company/${slug}-sample` },
  };
}
