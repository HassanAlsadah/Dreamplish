import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, filteredBy } from "./fake-supabase";

const USER = "11111111-1111-4111-8111-111111111111";
let admin: ReturnType<typeof fakeSupabase>;
let used = 0; // what the count query returns
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.client }));

const { takeQuota } = await import("@/lib/rate-limit");

beforeEach(() => {
  used = 0;
  admin = fakeSupabase((call) => (call.op === "select" ? { count: used } : undefined));
});

const countQuery = () => admin.find("ai_requests", "select")[0];
const filter = (method: string) => countQuery().filters.find(([m]) => m === method);

describe("takeQuota", () => {
  it("records the request and allows it while under the limit", async () => {
    used = 11;
    expect(await takeQuota({ id: USER }, "email_sync")).toBe(true);
    expect(admin.find("ai_requests", "insert")[0].payload).toEqual({ user_id: USER, kind: "email_sync" });
    expect(filteredBy(countQuery(), "user_id", USER)).toBe(true);
  });

  it("refuses at the limit and records nothing", async () => {
    used = 12; // Sync now: 12 an hour
    expect(await takeQuota({ id: USER }, "email_sync")).toBe(false);
    expect(admin.find("ai_requests", "insert")).toHaveLength(0);
  });

  it("counts only the user's requests of the same limit, in its window", async () => {
    const before = Date.now();
    await takeQuota({ id: USER }, "email_sync");
    expect(filter("in")).toEqual(["in", "kind", ["email_sync"]]);
    const since = Date.parse(filter("gte")![2] as string);
    expect(before - since).toBeGreaterThanOrEqual(3_600_000 - 1000); // one hour
    expect(before - since).toBeLessThan(3_600_000 + 1000);
  });

  it("the AI career tools share one daily allowance (AI_DAILY_LIMIT)", async () => {
    vi.stubEnv("AI_DAILY_LIMIT", "5");
    used = 4;
    expect(await takeQuota({ id: USER }, "tailor")).toBe(true);
    expect(filter("in")).toEqual(["in", "kind", ["analyze", "tailor", "prep"]]);
    used = 5;
    expect(await takeQuota({ id: USER }, "prep")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("paid searches and email re-reads have their own daily limits", async () => {
    used = 30;
    expect(await takeQuota({ id: USER }, "find_description")).toBe(false);
    used = 3;
    expect(await takeQuota({ id: USER }, "email_reread")).toBe(false);
    used = 2;
    expect(await takeQuota({ id: USER }, "email_reread")).toBe(true);
  });

  it("fails closed when the count can't be read", async () => {
    admin = fakeSupabase(() => ({ error: { message: "db down" } }));
    await expect(takeQuota({ id: USER }, "link_lookup")).rejects.toThrow("rate limit check failed");
  });
});
