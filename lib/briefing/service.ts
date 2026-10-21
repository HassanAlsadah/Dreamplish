import "server-only";
import { after } from "next/server";
import { aiProvider, briefsDailyLimit, briefsMonthlyLimit } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeRole } from "./finalize";
import {
  BRIEF_TTL_DAYS,
  REFRESH_COOLDOWN_MINUTES,
  SECTION_KEYS,
  briefItemSchema,
  watchoutsSchema,
  roleInsightsSchema,
  salaryEntrySchema,
  sectionSchema,
  type BriefErrorCode,
  type BriefStatus,
  type BriefView,
  type SalaryEntry,
  type Section,
  type SectionKey,
} from "./types";
import { runBriefWorker } from "./worker";
import { isUnlimited, type QuotaUser } from "@/lib/rate-limit";

type BriefRow = {
  company_id: string;
  status: BriefStatus;
  provider: string | null;
  news: unknown;
  projects: unknown;
  values: unknown;
  skills: unknown;
  salary_range: unknown;
  search_suggestions: string | null;
  links: { website?: string | null; linkedin?: string | null } | null;
  summary: unknown;
  watchouts: unknown;
  role_insights: unknown;
  error: string | null;
  requested_at: string;
  generated_at: string | null;
  locked_at: string | null;
};

export type RequestError = "not_found" | "daily_limit" | "monthly_limit" | "refresh_too_soon" | "not_configured";

const KICK_AFTER_MS = 20_000;

/** Job titles the signed-in user tracks at this company (RLS-scoped), or null if none. */
async function viewerRoles(companyId: string): Promise<string[] | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("title").eq("company_id", companyId);
  if (!data?.length) return null;
  return data.map((j) => j.title);
}

function parseSection(value: unknown): Section {
  const parsed = sectionSchema.safeParse(value);
  return parsed.success ? parsed.data : { status: "not_found", items: [] };
}

function toView(row: BriefRow, roles: string[]): BriefView {
  const mine = new Set(roles.map(normalizeRole));
  const salaryAll = Array.isArray(row.salary_range)
    ? row.salary_range.flatMap((s) => {
        const p = salaryEntrySchema.safeParse(s);
        return p.success ? [p.data] : [];
      })
    : [];
  // Only show estimates for the viewer's own roles — other users' roles stay private.
  const salary: SalaryEntry[] = salaryAll.filter((s) => mine.has(normalizeRole(s.role)));
  const covered = new Set(salary.map((s) => normalizeRole(s.role)));

  const hasContent = row.generated_at !== null;
  const sections = hasContent
    ? (Object.fromEntries(SECTION_KEYS.map((k) => [k, parseSection(row[k])])) as Record<SectionKey, Section>)
    : null;

  return {
    companyId: row.company_id,
    status: row.status,
    provider: row.provider,
    generatedAt: row.generated_at,
    requestedAt: row.requested_at,
    error: (row.error as BriefErrorCode | null) ?? null,
    sections,
    salary,
    salaryMissingRoles: hasContent ? [...new Set(roles.filter((r) => !covered.has(normalizeRole(r))))] : [],
    searchSuggestions: row.search_suggestions,
    links: { website: row.links?.website ?? null, linkedin: row.links?.linkedin ?? null },
    summary: briefItemSchema.safeParse(row.summary).data ?? null,
    watchouts: watchoutsSchema.safeParse(row.watchouts).data ?? null,
    roleInsights: (() => {
      const ri = roleInsightsSchema.safeParse(row.role_insights).data;
      // Like salary: only show duties for the viewer's own roles.
      return ri ? { ...ri, duties: ri.duties.filter((d) => mine.has(normalizeRole(d.role))) } : null;
    })(),
    viewerRoles: [...new Set(roles)],
    canRefreshAt: row.generated_at
      ? new Date(Date.parse(row.generated_at) + REFRESH_COOLDOWN_MINUTES * 60_000).toISOString()
      : null,
  };
}

// Every column: toView() decides what the browser sees.
const COLUMNS = "*";

function kick(companyId: string) {
  after(async () => {
    try {
      await runBriefWorker({ companyId, max: 1 });
    } catch (e) {
      console.error("brief worker failed", e);
    }
  });
}

/** Current brief for a company the user tracks. Restarts stalled jobs (self-healing queue). */
export async function getBriefView(companyId: string): Promise<{ view: BriefView | null; error?: RequestError }> {
  const roles = await viewerRoles(companyId);
  if (!roles) return { view: null, error: "not_found" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { view: null, error: "not_configured" };
  }
  const { data } = await admin.from("company_briefs").select(COLUMNS).eq("company_id", companyId).maybeSingle();
  if (!data) return { view: null };
  const row = data as BriefRow;

  const stalledPending = row.status === "pending" && Date.now() - Date.parse(row.requested_at) > KICK_AFTER_MS;
  const stalledRun =
    row.status === "generating" && row.locked_at && Date.now() - Date.parse(row.locked_at) > 10 * 60_000;
  if (stalledPending || stalledRun) kick(companyId);

  return { view: toView(row, roles) };
}

/** User clicked Generate / Refresh. */
export async function requestBrief(
  companyId: string,
  user: QuotaUser,
  { force }: { force: boolean },
): Promise<{ view: BriefView | null; error?: RequestError }> {
  const roles = await viewerRoles(companyId);
  if (!roles) return { view: null, error: "not_found" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { view: null, error: "not_configured" };
  }

  const { data: existing } = await admin.from("company_briefs").select(COLUMNS).eq("company_id", companyId).maybeSingle();
  const row = existing as BriefRow | null;

  if (row) {
    const inProgress = row.status === "pending" || row.status === "generating";
    if (inProgress) return { view: toView(row, roles) };

    // Sample (mock) briefs are replaced as soon as a real provider is configured.
    const providerChanged = row.provider !== null && row.provider !== aiProvider();
    const fresh =
      !providerChanged &&
      row.status === "ready" &&
      row.generated_at &&
      Date.now() - Date.parse(row.generated_at) < BRIEF_TTL_DAYS * 86_400_000;
    // A fresh cached brief is reused at no cost — unless the user explicitly refreshes.
    if (fresh && !force) return { view: toView(row, roles) };

    if (
      force &&
      !providerChanged &&
      row.generated_at &&
      Date.now() - Date.parse(row.generated_at) < REFRESH_COOLDOWN_MINUTES * 60_000
    ) {
      return { view: toView(row, roles), error: "refresh_too_soon" };
    }
  }

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from("brief_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= briefsDailyLimit() && !isUnlimited(user)) {
    return { view: row ? toView(row, roles) : null, error: "daily_limit" };
  }

  // Shared monthly cap (everyone's briefings this calendar month): the search quota is shared too.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count: thisMonth } = await admin.from("brief_requests").select("id", { count: "exact", head: true }).gte("created_at", monthStart);
  if (aiProvider() !== "mock" && (thisMonth ?? 0) >= briefsMonthlyLimit()) {
    return { view: row ? toView(row, roles) : null, error: "monthly_limit" };
  }

  await admin.from("brief_requests").insert({ user_id: user.id, company_id: companyId });
  const { data: queued, error } = await admin
    .from("company_briefs")
    .upsert(
      { company_id: companyId, status: "pending", requested_at: new Date().toISOString(), attempts: 0, error: null, locked_at: null },
      { onConflict: "company_id" },
    )
    .select(COLUMNS)
    .single();
  if (error || !queued) throw new Error(`Failed to queue brief: ${error?.message}`);

  kick(companyId);
  return { view: toView(queued as BriefRow, roles) };
}
