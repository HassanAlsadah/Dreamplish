import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { stepMovesTo } from "@/components/jobs/add-step-dialog";
import { addJobStep } from "@/lib/actions/history";
import { StatusTimeline } from "@/components/jobs/status-timeline";
import { moveKind, type HistoryEntry } from "@/lib/history";
import { I18nProvider } from "@/lib/i18n/client";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const JOB_ID = "0b6c9a8e-3f4d-4b1a-9c2e-7d8f1a2b3c4d";
const entry = (id: string, from: HistoryEntry["from_status"], to: HistoryEntry["to_status"], at: string, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id, from_status: from, to_status: to, to_stage_id: null, to_stage_label: null, changed_at: at, note: null, ...extra,
});

function renderTimeline(entries: HistoryEntry[], locale: "en" | "ar" = "en", currentStatus: HistoryEntry["to_status"] = "applied") {
  return render(
    <I18nProvider locale={locale}>
      <StatusTimeline entries={entries} jobId={JOB_ID} jobCreatedAt="2026-10-01T09:00:00Z" currentStatus={currentStatus} now={NOW} />
    </I18nProvider>,
  );
}

describe("StatusTimeline", () => {
  it("renders one list item and one focusable node per status change", () => {
    renderTimeline([
      entry("a", null, "applied", "2026-10-02T09:00:00Z"),
      entry("b", "applied", "interview", "2026-10-08T09:00:00Z", { to_stage_label: "assessment", note: "HackerRank coding test" }),
      entry("c", "interview", "offer", "2026-10-15T09:00:00Z"),
    ]);
    const list = screen.getByRole("list", { name: /status changes/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    // Each node is a button with an accessible label (status + relative time).
    expect(screen.getAllByRole("button", { name: /^(Application|Assessment|Job offer),/ })).toHaveLength(3);
    // …and each real change has an "Edit date" button.
    expect(screen.getAllByRole("button", { name: /^Edit date/ })).toHaveLength(3);
    // The last one is marked current, and the note is readable without hovering.
    expect(screen.getByRole("button", { name: /Job offer.*Current/ })).toBeInTheDocument();
    expect(screen.getByText("HackerRank coding test")).toBeInTheDocument();
    expect(within(list).getByText("Assessment")).toBeInTheDocument();
  });

  it("shows a single node for the current status when there is no history (empty state)", () => {
    renderTimeline([]);
    const list = screen.getByRole("list", { name: /status changes/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Application.*Current/ })).toBeInTheDocument();
    // The synthetic node can't be edited.
    expect(screen.queryByRole("button", { name: /Edit date/ })).not.toBeInTheDocument();
  });

  it("renders Arabic labels", () => {
    renderTimeline([entry("a", null, "applied", "2026-10-02T09:00:00Z")], "ar");
    expect(screen.getByRole("list", { name: /تغييرات حالة/ })).toBeInTheDocument();
  });
});

describe("moveKind", () => {
  it("treats backward and same-status moves as branches", () => {
    expect(moveKind({ from_status: "interview", to_status: "applied" })).toBe("backward");
    expect(moveKind({ from_status: "applied", to_status: "applied" })).toBe("sideways");
    expect(moveKind({ from_status: "applied", to_status: "interview" })).toBe("forward");
    expect(moveKind({ from_status: "interview", to_status: "rejected" })).toBe("forward");
    expect(moveKind({ from_status: null, to_status: "applied" })).toBe("forward");
  });

  it("detects rounds in the same column and treats Assessment → Interview as forward", () => {
    const interview = { from_status: "interview" as const, to_status: "interview" as const, to_stage_id: null, to_stage_label: null };
    const assessment = { from_status: "applied" as const, to_status: "interview" as const, to_stage_id: "s1", to_stage_label: "assessment" };
    expect(moveKind(interview, interview)).toBe("round");
    expect(moveKind({ ...assessment, from_status: "interview" }, assessment)).toBe("round");
    expect(moveKind(interview, assessment)).toBe("forward");
    expect(moveKind({ ...assessment, from_status: "interview" }, interview)).toBe("sideways");
  });
});

describe("rounds on the timeline", () => {
  it("labels repeated interviews as Round 2, Round 3", () => {
    renderTimeline([
      entry("a", null, "applied", "2026-10-02T09:00:00Z"),
      entry("b", "applied", "interview", "2026-10-05T09:00:00Z", { note: "HR interview" }),
      entry("c", "interview", "interview", "2026-10-09T09:00:00Z", { note: "Technical interview" }),
      entry("d", "interview", "interview", "2026-10-14T09:00:00Z", { note: "Final interview" }),
    ]);
    expect(screen.getByRole("button", { name: /^Interview,/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Interview · Round 2,/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Interview · Round 3,.*Current/ })).toBeInTheDocument();
    expect(screen.getByText("Technical interview")).toBeInTheDocument();
  });
});

describe("steps", () => {
  const interviewJob = [
    entry("a", null, "applied", "2026-10-02T09:00:00Z"),
    entry("b", "applied", "interview", "2026-10-05T09:00:00Z", { step_kind: "interview", step_type: "HR interview" }),
  ];

  it("shows Add step in every phase", () => {
    renderTimeline(interviewJob.slice(0, 1), "en", "applied");
    expect(screen.getByRole("button", { name: "Add step" })).toBeInTheDocument();
  });

  it("labels steps by kind with their type, and counts rounds per kind", () => {
    renderTimeline(
      [
        ...interviewJob,
        entry("c", "interview", "interview", "2026-10-07T09:00:00Z", { step_kind: "call", step_type: "Recruiter screen" }),
        entry("d", "interview", "interview", "2026-10-12T09:00:00Z", { step_kind: "interview", step_type: "Technical interview", note: "Called by Sara" }),
      ],
      "en",
      "interview",
    );
    expect(screen.getByRole("button", { name: /^Call — Recruiter screen,/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Interview · Round 2 — Technical interview,.*Current/ })).toBeInTheDocument();
    expect(screen.getByText("Called by Sara")).toBeInTheDocument();
  });

  it("asks for the kind, then the type, and saves", async () => {
    renderTimeline(interviewJob, "en", "applied");
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    const dialog = screen.getByRole("dialog", { name: "Add a step" });

    // Empty type → validation message, nothing sent.
    fireEvent.click(within(dialog).getByRole("button", { name: "Add step" }));
    expect(within(dialog).getByText(/Choose or type the type/)).toBeInTheDocument();
    expect(addJobStep).not.toHaveBeenCalled();

    // Call never moves the job; Interview from Application does, and says so.
    expect(within(dialog).queryByText(/also moves the job/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Interview" }));
    expect(within(dialog).getByText("This also moves the job to Interview.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Technical interview" }));
    expect(within(dialog).getByLabelText("Type")).toHaveValue("Technical interview");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add step" }));
    await vi.waitFor(() =>
      expect(addJobStep).toHaveBeenCalledWith(expect.objectContaining({ jobId: JOB_ID, kind: "interview", type: "Technical interview" })),
    );
  });

  it("moves only when the job isn't already in that kind of column", () => {
    expect(stepMovesTo("call", "applied", false)).toBeNull();
    expect(stepMovesTo("interview", "applied", false)).toBe("interview");
    expect(stepMovesTo("interview", "interview", false)).toBeNull();
    expect(stepMovesTo("interview", "interview", true)).toBe("interview");
    expect(stepMovesTo("assessment", "interview", false)).toBe("assessment");
    expect(stepMovesTo("assessment", "interview", true)).toBeNull();
    expect(stepMovesTo("interview", "offer", false)).toBe("interview");
  });
});
