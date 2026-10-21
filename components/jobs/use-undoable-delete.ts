"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { removeJob } from "@/lib/actions/jobs";
import type { Job } from "@/lib/types";

/** How long the Undo toast stays before a deleted job is really deleted. */
export const UNDO_MS = 6000;

/**
 * Deleting with Undo instead of a confirmation: the job disappears at once and the server delete
 * happens only when the Undo window has passed (or the user leaves the page).
 * `initial` is a job to start deleting on arrival (the job page's Delete).
 */
export function useUndoableDelete({
  initial,
  onDeleted,
  onFailed,
}: {
  initial?: Job;
  /** The server deleted it: drop it from the list. */
  onDeleted: (id: string) => void;
  /** The server refused: it is shown again. */
  onFailed: () => void;
}) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set(initial ? [initial.id] : []));
  const [undoJob, setUndoJob] = useState<Job | null>(initial ?? null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const unhide = (id: string) =>
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const stopTimer = (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  };

  const commit = (id: string) => {
    stopTimer(id);
    removeJob(id)
      .catch(() => ({ ok: false }))
      .then((result) => {
        unhide(id);
        if (result.ok) onDeleted(id);
        else onFailed();
      });
  };

  const startTimer = (id: string) => timers.current.set(id, setTimeout(() => commit(id), UNDO_MS));

  const requestDelete = (job: Job) => {
    setHiddenIds((prev) => new Set(prev).add(job.id));
    setUndoJob(job);
    startTimer(job.id);
  };

  const undo = () => {
    if (!undoJob) return;
    stopTimer(undoJob.id);
    unhide(undoJob.id);
    setUndoJob(null);
  };

  const startInitial = useEffectEvent(() => {
    if (initial) startTimer(initial.id);
  });
  useEffect(() => startInitial(), []);

  // Leaving the page: deletes still waiting go through.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const id of [...map.keys()]) {
        clearTimeout(map.get(id));
        void removeJob(id);
      }
    };
  }, []);

  return { hiddenIds, undoJob, requestDelete, undo, dismissUndo: () => setUndoJob(null) };
}
