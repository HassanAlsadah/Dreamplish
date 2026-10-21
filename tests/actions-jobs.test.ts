import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, filteredBy, type Respond } from "./fake-supabase";

const USER = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";
const CORE_INTERVIEW = "33333333-3333-4333-8333-333333333333";
const CUSTOM_CALL = "44444444-4444-4444-8444-444444444444"; // a user's "Call" column, counts as Application
const COMPANY = "55555555-5555-4555-8555-555555555555";

const stages: Record<string, { id: string; category: string; is_core: boolean }> = {
  [CORE_INTERVIEW]: { id: CORE_INTERVIEW, category: "interview", is_core: true },
  [CUSTOM_CALL]: { id: CUSTOM_CALL, category: "applied", is_core: false },
};

let db: ReturnType<typeof fakeSupabase>;
let signedIn = true;
vi.mock("@/lib/dal", () => ({
  getUserClient: async () => (signedIn ? { user: { id: USER }, supabase: db.client } : null),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const { createJob, updateJob, moveJob, removeJob, checkJob, markApplied } = await import("@/lib/actions/jobs");

/** A database with the two columns above, an existing job in Application, and the given extras. */
function setup(extra: Respond = () => undefined, current = { status: "applied", stage_id: null as string | null }) {
  db = fakeSupabase((call) => {
    const answer = extra(call);
    if (answer) return answer;
    if (call.table === "board_stages" && call.op === "select") {
      const id = call.filters.find(([m, col]) => m === "eq" && col === "id")?.[2] as string;
      return { data: stages[id] ?? null };
    }
    if (call.table === "get_or_create_company") return { data: COMPANY };
    if (call.table === "jobs" && call.op === "select" && call.columns === "status, stage_id") return { data: current };
    if (call.table === "jobs" && call.op === "select" && call.columns === "position") return { data: { position: 5 } };
    if (call.table === "jobs" && (call.op === "update" || call.op === "delete")) return { count: 1 };
  });
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries({ company: "Aramco", title: "Engineer", status: "applied", stage: "", ...fields })) data.set(k, v);
  return data;
};

beforeEach(() => {
  signedIn = true;
  setup();
});

describe("createJob", () => {
  it("returns field errors and the typed values when the form is invalid, writing nothing", async () => {
    const state = await createJob({ ok: false }, form({ company: "", link: "not a url" }));
    expect(state).toMatchObject({ ok: false, error: "fixFields", fieldErrors: { company: "required", link: "invalidUrl" } });
    expect(state.values?.link).toBe("not a url");
    expect(db.find("jobs", "insert")).toHaveLength(0);
  });

  it("refuses when signed out", async () => {
    signedIn = false;
    expect(await createJob({ ok: false }, form({}))).toMatchObject({ ok: false, error: "unauthorized" });
  });

  it("inserts the job at the top of its column and redirects to the dashboard", async () => {
    await expect(createJob({ ok: false }, form({ appliedVia: "linkedin", appliedViaDetail: "Easy Apply" }))).rejects.toThrow(
      "redirect:/dashboard?saved=1",
    );
    const [insert] = db.find("jobs", "insert");
    expect(insert.payload).toMatchObject({
      user_id: USER,
      company_id: COMPANY,
      title: "Engineer",
      status: "applied",
      applied_via: "linkedin",
      applied_via_detail: "Easy Apply",
      position: 4, // one above the current top (5)
    });
    expect(insert.payload).not.toHaveProperty("stage_id"); // no column picked: the core column of its status
  });

  it("takes the status from a custom column and stores the column", async () => {
    await expect(createJob({ ok: false }, form({ status: "offer", stage: CUSTOM_CALL }))).rejects.toThrow("redirect:");
    expect(db.find("jobs", "insert")[0].payload).toMatchObject({ status: "applied", stage_id: CUSTOM_CALL });
  });

  it("stores a core column as stage_id null", async () => {
    await expect(createJob({ ok: false }, form({ stage: CORE_INTERVIEW }))).rejects.toThrow("redirect:");
    expect(db.find("jobs", "insert")[0].payload).toMatchObject({ status: "interview", stage_id: null });
  });

  it("drops the how-you-applied detail when no channel is set", async () => {
    await expect(createJob({ ok: false }, form({ appliedViaDetail: "orphan detail" }))).rejects.toThrow("redirect:");
    expect(db.find("jobs", "insert")[0].payload).toMatchObject({ applied_via: null, applied_via_detail: null });
  });

  it("reports a generic error when the company can't be saved", async () => {
    setup((call) => (call.table === "get_or_create_company" ? { error: { message: "boom" } } : undefined));
    expect(await createJob({ ok: false }, form({}))).toMatchObject({ ok: false, error: "generic" });
    expect(db.find("jobs", "insert")).toHaveLength(0);
  });
});

describe("updateJob", () => {
  it("keeps the email's interview type when the job stays in its column", async () => {
    const state = await updateJob(JOB, { ok: false }, form({ notes: "Called back" }));
    expect(state).toMatchObject({ ok: true, message: "updated" });
    const [update] = db.find("jobs", "update");
    expect(filteredBy(update, "id", JOB)).toBe(true);
    expect(update.payload).toMatchObject({ notes: "Called back", status: "applied" });
    expect(update.payload).not.toHaveProperty("stage_detail");
    expect(update.payload).not.toHaveProperty("position");
  });

  it("clears the interview type and moves the job to the top when its status changes", async () => {
    await updateJob(JOB, { ok: false }, form({ stage: CORE_INTERVIEW }));
    expect(db.find("jobs", "update")[0].payload).toMatchObject({ status: "interview", stage_id: null, stage_detail: null, position: 4 });
  });

  it("clears the interview type when only the column changes", async () => {
    await updateJob(JOB, { ok: false }, form({ stage: CUSTOM_CALL }));
    const payload = db.find("jobs", "update")[0].payload;
    expect(payload).toMatchObject({ status: "applied", stage_id: CUSTOM_CALL, stage_detail: null });
    expect(payload).not.toHaveProperty("position"); // same status: keeps its place
  });

  it("fails without writing when the job isn't the user's", async () => {
    setup((call) => (call.table === "jobs" && call.op === "select" ? { data: null } : undefined));
    expect(await updateJob(JOB, { ok: false }, form({}))).toMatchObject({ ok: false, error: "generic" });
    expect(db.find("jobs", "update")).toHaveLength(0);
  });
});

describe("moveJob", () => {
  it("moves to a custom column, keeping the position from the board", async () => {
    expect(await moveJob({ id: JOB, stageId: CUSTOM_CALL, position: 2.5 })).toEqual({ ok: true });
    expect(db.find("jobs", "update")[0].payload).toEqual({ status: "applied", stage_id: CUSTOM_CALL, position: 2.5, stage_detail: null });
  });

  it("reorders within the same column without touching the interview type", async () => {
    setup(undefined, { status: "interview", stage_id: null });
    await moveJob({ id: JOB, stageId: CORE_INTERVIEW, position: 1 });
    expect(db.find("jobs", "update")[0].payload).toEqual({ status: "interview", stage_id: null, position: 1 });
  });

  it("rejects an unknown column or a malformed id", async () => {
    expect(await moveJob({ id: JOB, stageId: "55555555-0000-4000-8000-000000000000", position: 0 })).toMatchObject({ ok: false });
    expect(await moveJob({ id: "nope", stageId: CUSTOM_CALL, position: 0 })).toMatchObject({ ok: false });
    expect(db.find("jobs", "update")).toHaveLength(0);
  });
});

describe("removeJob", () => {
  it("deletes the user's job", async () => {
    expect(await removeJob(JOB)).toEqual({ ok: true });
    expect(filteredBy(db.find("jobs", "delete")[0], "id", JOB)).toBe(true);
  });

  it("fails when nothing was deleted (not found or not theirs), and never queries for a malformed id", async () => {
    setup((call) => (call.op === "delete" ? { count: 0 } : undefined));
    expect(await removeJob(JOB)).toMatchObject({ ok: false });
    expect(await removeJob("../etc")).toMatchObject({ ok: false });
    expect(db.find("jobs", "delete")).toHaveLength(1);
  });
});

describe("checkJob (check a job before applying)", () => {
  const checkForm = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries({ company: "Aramco", title: "Data Analyst", jobDescription: "SQL, Python", link: "", ...fields })) data.set(k, v);
    return data;
  };

  it("saves a draft (not applied, no date) and opens its Match & CV tab", async () => {
    setup((call) => (call.table === "jobs" && call.op === "insert" ? { data: { id: JOB } } : undefined));
    await expect(checkJob({ ok: false }, checkForm({ link: "https://careers.aramco.com/1" }))).rejects.toThrow(`redirect:/jobs/${JOB}?tab=match`);
    const payload = db.find("jobs", "insert")[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({ user_id: USER, company_id: COMPANY, title: "Data Analyst", status: "saved", job_description: "SQL, Python", link: "https://careers.aramco.com/1" });
    expect(payload).not.toHaveProperty("date_applied");
  });

  it("needs the description (that's what gets matched), company and role", async () => {
    const state = await checkJob({ ok: false }, checkForm({ jobDescription: " ", company: "" }));
    expect(state).toMatchObject({ ok: false, error: "fixFields", fieldErrors: { jobDescription: "required", company: "required" } });
    expect(db.find("jobs", "insert")).toHaveLength(0);
  });
});

describe("markApplied (\"I applied\" on a draft)", () => {
  const withJob = (job: { status: string; date_applied: string | null }) =>
    setup((call) => {
      if (call.table === "jobs" && call.op === "select" && call.columns === "status, date_applied") return { data: job };
      if (call.table === "jobs" && call.op === "update") return { count: 1 };
    });

  it("moves the draft to the top of Application, dated on the user's local day", async () => {
    withJob({ status: "saved", date_applied: null });
    expect(await markApplied(JOB, "2026-10-18")).toEqual({ ok: true });
    expect(db.find("jobs", "update")[0].payload).toEqual({ status: "applied", stage_id: null, date_applied: "2026-10-18", position: 4 });
  });

  it("keeps a date the user already set", async () => {
    withJob({ status: "saved", date_applied: "2026-10-10" });
    await markApplied(JOB, "2026-10-18");
    expect(db.find("jobs", "update")[0].payload).toMatchObject({ date_applied: "2026-10-10" });
  });

  it("does nothing to a job that's already been applied to (e.g. a second click)", async () => {
    withJob({ status: "interview", date_applied: "2026-10-01" });
    expect(await markApplied(JOB, "2026-10-18")).toEqual({ ok: true });
    expect(db.find("jobs", "update")).toHaveLength(0);
  });

  it("rejects a future or malformed date and a malformed id, without writing", async () => {
    withJob({ status: "saved", date_applied: null });
    expect(await markApplied(JOB, "2999-01-01")).toMatchObject({ ok: false, error: "futureDate" });
    expect(await markApplied(JOB, "yesterday")).toMatchObject({ ok: false, error: "invalidDate" });
    expect(await markApplied("nope", "2026-10-18")).toMatchObject({ ok: false });
    expect(db.find("jobs", "update")).toHaveLength(0);
  });
});
