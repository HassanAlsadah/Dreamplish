import { describe, expect, it } from "vitest";
import { decide, type JobLite } from "@/lib/email/match";

const ASSESSMENT = "stage-assessment";
const job = (extra: Partial<JobLite>): JobLite => ({
  id: "j1", title: "Developer", status: "interview", company: { name: "Acme" }, stage_id: null, stage_detail: null, ...extra,
});

describe("email rounds", () => {
  it("suggests a new round when the interview type is new", () => {
    const r = decide(job({ stage_detail: "HR interview" }), "interview", "Technical interview", ASSESSMENT);
    expect(r).toEqual({ action: "update", status: "interview", round: true });
  });

  it("skips the same type again (likely a reminder or reschedule)", () => {
    expect(decide(job({ stage_detail: "Technical interview" }), "interview", "technical interview", ASSESSMENT).action).toBe("none");
    expect(decide(job({ stage_detail: "HR interview" }), "interview", "", ASSESSMENT).action).toBe("none");
  });

  it("suggests a second assessment in the Assessment column", () => {
    const r = decide(job({ stage_id: ASSESSMENT, stage_detail: "HackerRank test" }), "assessment", "Case study", ASSESSMENT);
    expect(r.round).toBe(true);
  });

  it("moves between Assessment and Interview", () => {
    expect(decide(job({ stage_id: ASSESSMENT }), "interview", "", ASSESSMENT)).toEqual({ action: "update", status: "interview" });
  });

  it("leaves the user's own columns and finished jobs alone", () => {
    expect(decide(job({ stage_id: "custom-called" }), "interview", "Technical interview", ASSESSMENT).action).toBe("none");
    expect(decide(job({ status: "offer" }), "interview", "Technical interview", ASSESSMENT).action).toBe("none");
  });
});
