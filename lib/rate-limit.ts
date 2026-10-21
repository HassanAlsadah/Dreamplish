import "server-only";
import { briefsDailyLimit } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Things a user can do that cost money (AI, paid search) or load other sites, so each is metered. */
export type MeteredKind = "analyze" | "tailor" | "prep" | "email_sync" | "email_reread" | "find_description" | "link_lookup";

function aiDailyLimit() {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

/**
 * Each limit counts the user's recent requests of the listed kinds. The three AI career tools share
 * one daily allowance (AI_DAILY_LIMIT); the rest have their own.
 */
const LIMITS: Array<{ kinds: MeteredKind[]; max: () => number; windowMs: number }> = [
  { kinds: ["analyze", "tailor", "prep"], max: aiDailyLimit, windowMs: DAY },
  { kinds: ["email_sync"], max: () => 12, windowMs: HOUR }, // "Sync now"; the hourly background sync isn't counted
  { kinds: ["email_reread"], max: () => 3, windowMs: DAY }, // re-reads every job email and searches for descriptions
  { kinds: ["find_description"], max: () => 30, windowMs: DAY }, // a paid web search each
  { kinds: ["link_lookup"], max: () => 60, windowMs: HOUR }, // fetches the pasted link
];

export type QuotaUser = { id: string; email?: string | null };

/**
 * Accounts with no per-user limits (the owner, testers): UNLIMITED_EMAILS, comma-separated. Set on the
 * server, not in code, so addresses don't end up in the public repository. Shared caps still apply.
 */
export function isUnlimited(user: QuotaUser): boolean {
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  return (process.env.UNLIMITED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email);
}

/**
 * Records one request of this kind and returns true, or returns false (recording nothing) when the
 * user has reached the limit. Stored in ai_requests, which only the server can read or write.
 */
export async function takeQuota(user: QuotaUser, kind: MeteredKind): Promise<boolean> {
  const userId = user.id;
  const limit = LIMITS.find((l) => l.kinds.includes(kind))!;
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("kind", limit.kinds)
    .gte("created_at", new Date(Date.now() - limit.windowMs).toISOString());
  if (error) throw new Error(`rate limit check failed: ${error.message}`);
  if ((count ?? 0) >= limit.max() && !isUnlimited(user)) return false;
  await admin.from("ai_requests").insert({ user_id: userId, kind });
  return true;
}

export type UsageKey = "ai" | "briefs" | "email_sync" | "email_reread" | "find_description" | "link_lookup";
export type Usage = { key: UsageKey; used: number; max: number; window: "day" | "hour"; unlimited: boolean };

/** How much of each limit the user has used in its current window (for the profile page). */
export async function getUsage(user: QuotaUser): Promise<Usage[]> {
  const userId = user.id;
  const unlimited = isUnlimited(user);
  const admin = createAdminClient();
  const since = (windowMs: number) => new Date(Date.now() - windowMs).toISOString();
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;
  const metered = LIMITS.map(async (limit) => ({
    key: (limit.kinds.length > 1 ? "ai" : limit.kinds[0]) as UsageKey,
    used: await count(
      admin.from("ai_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).in("kind", limit.kinds).gte("created_at", since(limit.windowMs)),
    ),
    max: limit.max(),
    window: limit.windowMs === HOUR ? ("hour" as const) : ("day" as const),
    unlimited,
  }));
  const briefs = count(
    admin.from("brief_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since(DAY)),
  ).then((used) => ({ key: "briefs" as const, used, max: briefsDailyLimit(), window: "day" as const, unlimited }));
  const all = await Promise.all([...metered, briefs]);
  // The order people care about: AI tools, briefings, then the rest.
  const order: UsageKey[] = ["ai", "briefs", "find_description", "email_sync", "email_reread", "link_lookup"];
  return all.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}
