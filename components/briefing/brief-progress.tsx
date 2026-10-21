"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { ui } from "@/lib/motion";

/**
 * Briefing generation as steps instead of a spinner. Only what's known is marked: the request is
 * queued, then research is running; the later steps show as coming next (the worker doesn't report
 * them separately). An elapsed timer shows it's alive. role="status" so screen readers hear changes.
 */
export function BriefProgress({ status, refreshing }: { status: "pending" | "generating"; refreshing: boolean }) {
  const { d } = useI18n();
  const reduced = useReducedMotion();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const steps = [
    { key: "queued", label: d.brief.stepQueued, state: status === "pending" ? "active" : "done" },
    { key: "research", label: d.brief.stepResearch, state: status === "generating" ? "active" : "next" },
    { key: "checking", label: d.brief.stepChecking, state: "next" },
    { key: "writing", label: d.brief.stepWriting, state: "next" },
  ] as const;

  return (
    <div role="status" aria-live="polite" className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-dawn)]" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-lg font-semibold">{d.brief.progressTitle}</p>
        <span className="text-xs text-muted tabular-nums">{fmt(d.brief.elapsed, { s: seconds })}</span>
      </div>
      <p className="mt-1 text-sm text-pretty text-muted">{refreshing ? d.brief.refreshingNote : d.brief.progressBody}</p>
      <ol className="mt-5 grid gap-3 sm:grid-cols-4">
        {steps.map((step, i) => (
          <motion.li
            key={step.key}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ui.enter, delay: reduced ? 0 : i * 0.08 }}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-sm",
              step.state === "active" ? "border-accent/40 bg-accent/8 font-medium" : step.state === "done" ? "border-border" : "border-dashed border-border text-muted",
            )}
            aria-current={step.state === "active" ? "step" : undefined}
          >
            <span aria-hidden className="relative flex size-6 shrink-0 items-center justify-center">
              <AnimatePresence initial={false} mode="wait">
                {step.state === "done" ? (
                  <motion.span
                    key="done"
                    initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex size-6 items-center justify-center rounded-full bg-status-offer text-white dark:text-[#06140d]"
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </motion.span>
                ) : step.state === "active" ? (
                  <motion.span key="active" className="relative flex size-6 items-center justify-center">
                    <span className="absolute inset-0 rounded-full border-2 border-accent/25" />
                    <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent motion-reduce:animate-none" />
                    <span className="size-2 rounded-full bg-accent" />
                  </motion.span>
                ) : (
                  <span className="size-2 rounded-full bg-border-strong/50" />
                )}
              </AnimatePresence>
            </span>
            <span>
              <span className="sr-only">{step.state === "done" ? d.brief.stepDone : step.state === "active" ? d.brief.stepActive : d.brief.stepNext}: </span>
              {step.label}
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
