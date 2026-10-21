import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, filteredBy, type Respond } from "./fake-supabase";

const USER = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const ASSESSMENT = "44444444-4444-4444-8444-444444444444";
const NEW_JOB = "55555555-5555-4555-8555-555555555555";

let db: ReturnType<typeof fakeSupabase>;
let admin: ReturnType<typeof fakeSupabase>;
const later: Array<() => Promise<void>> = [];
const fillJobDescription = vi.fn(async () => {});
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.client }));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => later.push(fn) }));
vi.mock("@/lib/career/find-description", () => ({ fillJobDescription: (...args: unknown[]) => fillJobDescription(...(args as [])) }));
vi.mock("@/lib/email/gmail", () => ({ GMAIL_PREFIX: "gmail:" }));

const { acceptEvent } = await import("@/lib/email/service");

const event = (overrides: Record<string, unknown> = {}) => ({
  id: EVENT,
  user_id: USER,
  state: "pending",
  action: "create",
  job_id: null,
  kind: "applied",
  company: "Aramco",
  role: "Data Analyst",
  detail: null,
  subject: "Thank you for applying",
  received_at: "2026-10-01T09:00:00Z",
  job_link: "https://careers.aramco.com/job/1",
  job_description: null,
  applied_via: "linkedin",
  ...overrides,
});

function setup(ev: ReturnType<typeof event> | null, extra: Respond = () => undefined) {
  db = fakeSupabase((call) => {
    const answer = extra(call);
    if (answer) return answer;
    if (call.table === "email_events" && call.op === "select") return { data: ev };
    if (call.table === "board_stages") return { data: [{ id: "core", preset: null }, { id: ASSESSMENT, preset: "assessment" }] };
    if (call.table === "get_or_create_company") return { data: "company-1" };
    if (call.table === "jobs" && call.op === "insert") return { data: { id: NEW_JOB } };
  });
  admin = fakeSupabase();
}

beforeEach(() => {
  later.length = 0;
  fillJobDescription.mockClear();
});

describe("acceptEvent: new job", () => {
  it("creates the job from the email in the Application column and marks the suggestion accepted", async () => {
    setup(event());
    expect(await acceptEvent(USER, EVENT, {})).toEqual({ ok: true, jobId: NEW_JOB });
    expect(db.find("jobs", "insert")[0].payload).toMatchObject({
      user_id: USER,
      title: "Data Analyst",
      status: "applied",
      stage_id: null,
      stage_detail: null,
      date_applied: "2026-10-01",
      source: "email",
      link: "https://careers.aramco.com/job/1",
      applied_via: "linkedin",
    });
    const [mark] = admin.find("email_events", "update");
    expect(mark.payload).toEqual({ state: "accepted", job_id: NEW_JOB });
    expect(filteredBy(mark, "user_id", USER)).toBe(true);
  });

  it("uses the user's edits, and an assessment goes to the Assessment column with its type", async () => {
    setup(event({ kind: "applied", detail: "HackerRank test" }));
    await acceptEvent(USER, EVENT, { company: "Aramco Digital", role: "Analyst", kind: "assessment" });
    expect(db.find("get_or_create_company", "rpc")[0].payload).toEqual({ p_name: "Aramco Digital" });
    expect(db.find("jobs", "insert")[0].payload).toMatchObject({
      title: "Analyst",
      status: "interview",
      stage_id: ASSESSMENT,
      stage_detail: "HackerRank test",
    });
  });

  it("needs a company name", async () => {
    setup(event({ company: null }));
    expect(await acceptEvent(USER, EVENT, {})).toEqual({ ok: false, error: "company_required" });
    expect(db.find("jobs", "insert")).toHaveLength(0);
    expect(admin.find("email_events", "update")).toHaveLength(0);
  });

  it("looks for the job description afterwards when the email had none", async () => {
    setup(event({ job_description: null }));
    await acceptEvent(USER, EVENT, {});
    expect(later).toHaveLength(1);
    await later[0]();
    expect(fillJobDescription).toHaveBeenCalledWith(USER, NEW_JOB);

    later.length = 0;
    setup(event({ job_description: "We are hiring…" }));
    await acceptEvent(USER, EVENT, {});
    expect(later).toHaveLength(0);
  });
});

describe("acceptEvent: existing job", () => {
  const existing = (job: Record<string, unknown>) => (call: { table: string; op: string }) =>
    call.table === "jobs" && call.op === "select" ? { data: job } : undefined;

  it("moves the job and fills in only what it doesn't have yet", async () => {
    setup(
      event({ action: "update", job_id: JOB, kind: "interview", detail: "Technical interview", job_description: "From the email" }),
      existing({ link: "https://kept.example/job", job_description: null, applied_via: null }),
    );
    expect(await acceptEvent(USER, EVENT, {})).toEqual({ ok: true, jobId: JOB });
    const [update] = db.find("jobs", "update");
    expect(filteredBy(update, "id", JOB)).toBe(true);
    expect(update.payload).toEqual({
      status: "interview",
      stage_id: null,
      stage_detail: "Technical interview",
      job_description: "From the email", // was empty
      applied_via: "linkedin", // was empty
      // link: the job already had one, so the email's isn't used
    });
    expect(db.find("jobs", "insert")).toHaveLength(0);
  });

  it("fails without marking the suggestion when the job can't be read", async () => {
    setup(event({ action: "update", job_id: JOB }), existing(null as never));
    expect(await acceptEvent(USER, EVENT, {})).toEqual({ ok: false, error: "save_failed" });
    expect(admin.find("email_events", "update")).toHaveLength(0);
  });
});

it("acceptEvent: a suggestion that isn't pending (or isn't the user's) is not found", async () => {
  setup(null);
  expect(await acceptEvent(USER, EVENT, {})).toEqual({ ok: false, error: "not_found" });
  expect(db.find("jobs", "insert")).toHaveLength(0);
});
