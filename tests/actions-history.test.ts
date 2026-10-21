import { describe, expect, it, vi } from "vitest";
import { fakeSupabase, type Respond } from "./fake-supabase";

const USER = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";
const ROW = "33333333-3333-4333-8333-333333333333";

let db: ReturnType<typeof fakeSupabase>;
vi.unmock("@/lib/actions/history"); // tests/setup.ts mocks it for component tests
vi.mock("@/lib/dal", () => ({ getUserClient: async () => ({ user: { id: USER }, supabase: db.client }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { addJobStep, setStatusChangeDate } = await import("@/lib/actions/history");

/** The job was added on 1 Oct; the given RPC answer for the database function. */
function setup(rpc: Respond = () => undefined) {
  db = fakeSupabase((call) =>
    call.op === "rpc" ? rpc(call) : call.table === "jobs" ? { data: { created_at: "2026-10-01T10:00:00Z" } } : undefined,
  );
}
const step = { jobId: JOB, kind: "call" as const, type: "HR call", changedAt: "2026-10-05T09:00:00Z" };

describe("addJobStep", () => {
  it("calls add_job_step with the validated step; a missing note is left out, not sent as null", async () => {
    setup();
    expect(await addJobStep(step)).toEqual({ ok: true });
    expect(db.find("add_job_step", "rpc")[0].payload).toEqual({
      p_job_id: JOB,
      p_kind: "call",
      p_type: "HR call",
      p_changed_at: "2026-10-05T09:00:00.000Z",
      p_note: undefined,
      p_allow_before_created: false,
    });
  });

  it("turns the database's refusals into messages the dialog shows", async () => {
    for (const [message, error] of [
      ["future_date", "futureDate"],
      ["before_created", "beforeCreated"],
      ["something else", "generic"],
    ]) {
      setup(() => ({ error: { message } }));
      expect(await addJobStep(step)).toEqual({ ok: false, error });
    }
  });

  it("checks the job belongs to the user before calling the database", async () => {
    db = fakeSupabase(() => ({ data: null }));
    expect(await addJobStep(step)).toMatchObject({ ok: false });
    expect(db.find("add_job_step", "rpc")).toHaveLength(0);
  });
});

describe("setStatusChangeDate", () => {
  it("sends the user's local date along so Date applied can follow the application point", async () => {
    setup();
    expect(await setStatusChangeDate({ id: ROW, jobId: JOB, changedAt: "2026-10-03T12:00:00Z", localDate: "2026-10-03" })).toEqual({ ok: true });
    expect(db.find("set_status_change_date", "rpc")[0].payload).toMatchObject({ p_id: ROW, p_local_date: "2026-10-03" });
  });
});
