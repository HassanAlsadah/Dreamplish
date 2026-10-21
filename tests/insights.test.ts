import { describe, expect, it } from "vitest";
import { computeInsights, type HistoryLite } from "@/lib/insights";
import { coreStages } from "./fixtures";
import type { Job } from "@/lib/types";

const NOW = Date.parse("2026-10-17T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const job = (id: string, status: Job["status"], applied: number | null, extra: Partial<Job> = {}): Job =>
  ({
    id,
    title: `Role ${id}`,
    status,
    link: null,
    notes: null,
    job_description: null,
    position: 0,
    date_applied: applied === null ? null : daysAgo(applied).slice(0, 10),
    created_at: daysAgo(applied ?? 1),
    updated_at: daysAgo(0),
    company: { id: `c${id}`, name: `Company ${id}`, website: null },
    stage_id: null,
    ...extra,
  }) as Job;
const h = (job_id: string, from: HistoryLite["from_status"], to: HistoryLite["to_status"], ago: number, extra: Partial<HistoryLite> = {}): HistoryLite => ({
  job_id, from_status: from, to_status: to, to_stage_label: null, changed_at: daysAgo(ago), ...extra,
});

const jobs = [
  job("a", "applied", 30, { applied_via: "linkedin" }), // waiting 30 days → follow up
  job("b", "interview", 20, { applied_via: "linkedin" }),
  job("c", "rejected", 10, { applied_via: "company_website" }),
  job("d", "applied", 3, { applied_via: "email" }), // recent, still waiting
  job("e", "saved", null),
];
const history = [
  h("a", null, "applied", 30),
  h("b", null, "applied", 20),
  h("b", "applied", "applied", 16, { step_kind: "call", step_type: "HR call" }),
  h("b", "applied", "interview", 12, { step_kind: "interview", step_type: "Technical interview" }),
  h("c", null, "applied", 10),
  h("c", "applied", "rejected", 4),
  h("d", null, "applied", 3),
];
const data = computeInsights({ jobs, history, stages: coreStages(), now: NOW });

describe("dashboard insights", () => {
  it("counts applications, replies and interviews (saved jobs aren't applications)", () => {
    expect(data.applications).toBe(4);
    expect(data.replied).toBe(2);
    expect(data.replyRate).toBe(0.5);
    expect(data.interviewed).toBe(1);
    expect(data.interviewRate).toBe(0.25);
  });

  it("measures time to the first reply (median, in days)", () => {
    // b: call 4 days after applying; c: rejection 6 days after.
    expect(data.medianDaysToReply).toBe(5);
    expect(data.replySample).toBe(2);
  });

  it("lists applications waiting two weeks or more, oldest first", () => {
    expect(data.followUps.map((f) => f.job.id)).toEqual(["a"]);
    expect(data.followUps[0].days).toBe(30);
  });

  it("shows the pipeline in board order with counts, and the active total", () => {
    const counts = Object.fromEntries(data.pipeline.map((p) => [p.stage.category, p.count]));
    expect(counts).toMatchObject({ rejected: 1, applied: 2, interview: 1, offer: 0 });
    expect(data.active).toBe(3);
  });

  it("buckets applications into the last 8 weeks", () => {
    expect(data.weeks).toHaveLength(8);
    expect(data.weeks.reduce((n, w) => n + w.count, 0)).toBe(4);
    expect(data.weeks[7].count).toBe(1); // d, 3 days ago
  });

  it("compares reply rates by how you applied", () => {
    const linkedin = data.channels.find((c) => c.via === "linkedin");
    expect(linkedin).toMatchObject({ total: 2, replied: 1, rate: 0.5 });
    expect(data.channels[0].via).toBe("company_website"); // 1 of 1
  });

  it("shows the latest steps and replies first", () => {
    expect(data.recent.map((r) => r.entry.to_status)).toEqual(["rejected", "interview", "applied"]);
    expect(data.recent[2].entry.step_kind).toBe("call");
  });

  it("has no rates (not 0%) before any application", () => {
    const empty = computeInsights({ jobs: [job("e", "saved", null)], history: [], stages: coreStages(), now: NOW });
    expect(empty.replyRate).toBeNull();
    expect(empty.medianDaysToReply).toBeNull();
  });
});
