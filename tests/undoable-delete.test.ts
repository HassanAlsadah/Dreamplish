import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNDO_MS, useUndoableDelete } from "@/components/jobs/use-undoable-delete";
import { removeJob } from "@/lib/actions/jobs";
import type { Job } from "@/lib/types";

vi.mock("@/lib/actions/jobs", () => ({ removeJob: vi.fn() }));
const remove = vi.mocked(removeJob);
const job = { id: "j1", title: "Engineer", company: { id: "c", name: "Acme", website: null } } as Job;

function setup(initial?: Job) {
  const onDeleted = vi.fn();
  const onFailed = vi.fn();
  const hook = renderHook(() => useUndoableDelete({ initial, onDeleted, onFailed }));
  return { ...hook, onDeleted, onFailed };
}

describe("useUndoableDelete", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    remove.mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.useRealTimers());

  it("hides the job at once and deletes it on the server only after the Undo window", async () => {
    const { result, onDeleted } = setup();
    act(() => result.current.requestDelete(job));
    expect(result.current.hiddenIds.has("j1")).toBe(true);
    expect(result.current.undoJob).toBe(job);
    expect(remove).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(UNDO_MS));
    expect(remove).toHaveBeenCalledWith("j1");
    expect(onDeleted).toHaveBeenCalledWith("j1");
  });

  it("Undo brings the job back and never deletes it", async () => {
    const { result, unmount } = setup();
    act(() => result.current.requestDelete(job));
    act(() => result.current.undo());
    expect(result.current.hiddenIds.has("j1")).toBe(false);
    expect(result.current.undoJob).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(UNDO_MS * 2));
    unmount();
    expect(remove).not.toHaveBeenCalled();
  });

  it("shows the job again and reports when the server refuses", async () => {
    remove.mockResolvedValueOnce({ ok: false, error: "generic" });
    const { result, onDeleted, onFailed } = setup();
    act(() => result.current.requestDelete(job));
    await act(async () => vi.advanceTimersByTimeAsync(UNDO_MS));
    expect(result.current.hiddenIds.has("j1")).toBe(false);
    expect(onFailed).toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("starts deleting a job passed on arrival, and finishes pending deletes when leaving the page", () => {
    const { result, unmount } = setup(job);
    expect(result.current.hiddenIds.has("j1")).toBe(true);
    expect(result.current.undoJob).toBe(job);
    unmount();
    expect(remove).toHaveBeenCalledWith("j1");
  });
});
