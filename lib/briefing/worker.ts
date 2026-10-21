import "server-only";
import { aiProvider } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BriefingError } from "./errors";
import { finalizeBrief, normalizeRole } from "./finalize";
import { geminiResearch } from "./providers/gemini";
import { mockResearch } from "./providers/mock";
import { linkedinFromWebsite } from "./official-links";
import { tavilyResearch } from "./providers/tavily";
import type { ResearchInput } from "./types";

const MAX_ATTEMPTS = 3;
const MAX_ROLES = 5;

async function research(input: ResearchInput) {
  switch (aiProvider()) {
    case "gemini":
      return geminiResearch(input);
    case "tavily":
      return tavilyResearch(input);
    default:
      return mockResearch(input);
  }
}

/**
 * Claims and generates queued briefs. Pass a companyId to process just that one
 * (used right after a user clicks Generate); omit it to drain the queue (cron).
 */
export async function runBriefWorker({ companyId, max = 3 }: { companyId?: string; max?: number } = {}) {
  const admin = createAdminClient();
  let processed = 0;

  while (processed < max) {
    const { data: claimed, error: claimError } = await admin.rpc("claim_brief", { p_company_id: companyId });
    if (claimError) {
      console.error("claim_brief failed", claimError);
      return processed;
    }
    const brief = (claimed as { id: string; company_id: string; attempts: number }[] | null)?.[0];
    if (!brief) return processed;
    processed++;

    try {
      const { data: company } = await admin
        .from("companies")
        .select("name, website")
        .eq("id", brief.company_id)
        .single();
      if (!company) throw new BriefingError("provider_error", "company not found");

      // Salary is estimated for the roles people actually track at this company.
      const { data: jobs } = await admin.from("jobs").select("title").eq("company_id", brief.company_id).limit(50);
      const roles = [...new Map((jobs ?? []).map((j) => [normalizeRole(j.title), j.title.trim()])).values()].slice(0, MAX_ROLES);

      const result = await research({
        companyName: company.name,
        website: company.website,
        roles,
        today: new Date().toISOString().slice(0, 10),
      });
      // LinkedIn comes only from the company's own website (never guessed).
      const website = company.website ?? result.links?.website ?? null;
      const linkedin =
        website && result.provider !== "mock" ? await linkedinFromWebsite(website, company.name) : (result.links?.linkedin ?? null);
      const { sections, salary, sources, links, summary, watchouts, roleInsights } = finalizeBrief(
        { ...result, links: { website: result.links?.website ?? null, linkedin } },
        roles,
      );

      const update = {
        status: "ready" as const,
        news: sections.news,
        projects: sections.projects,
        values: sections.values,
        skills: sections.skills,
        salary_range: salary,
        sources,
        roles,
        provider: result.provider,
        search_suggestions: result.searchSuggestions,
        links,
        summary,
        watchouts,
        role_insights: roleInsights,
        generated_at: new Date().toISOString(),
        error: null,
        locked_at: null,
      };
      const { error } = await admin.from("company_briefs").update(update).eq("id", brief.id);
      if (error) throw new BriefingError("provider_error", `save failed: ${error.message}`);
    } catch (e) {
      const code = e instanceof BriefingError ? e.code : "provider_error";
      // Config problems won't fix themselves on retry.
      const final = code === "not_configured" || brief.attempts >= MAX_ATTEMPTS;
      console.error(`brief ${brief.id} attempt ${brief.attempts} failed (${code}):`, e instanceof Error ? e.message : e);
      await admin
        .from("company_briefs")
        .update({ status: final ? "failed" : "pending", error: code, locked_at: null })
        .eq("id", brief.id);
    }
  }
  return processed;
}
