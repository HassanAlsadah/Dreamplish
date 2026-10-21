import { STATUS_ICONS } from "@/components/jobs/status-dot";
import type { JobStatus } from "@/lib/types";

/**
 * Landing focal point: the journey a job takes, Saved → Applied → Interview → Offer, as connected
 * status nodes on one line (the same idea as the status timeline). Reads in order for screen
 * readers; the connector flips in Arabic.
 */
export function JourneyRibbon({ label, steps }: { label: string; steps: { status: JobStatus; label: string }[] }) {
  return (
    <ol aria-label={label} className="journey relative mx-auto mt-16 flex max-w-2xl items-start justify-between">
      {/* Connector: a line in the dawn gradient behind the nodes (draws itself once, from the start side). */}
      <span aria-hidden className="journey-line absolute inset-x-[12%] top-6 h-0.5 rounded-full opacity-70" />
      {steps.map(({ status, label: text }, i) => {
        const Icon = STATUS_ICONS[status];
        const last = i === steps.length - 1;
        return (
          <li key={status} className="journey-step relative flex w-1/4 flex-col items-center gap-2.5" style={{ "--i": i } as React.CSSProperties}>
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-2xl border-2 bg-surface shadow-[var(--shadow-card)]"
              style={{
                borderColor: `color-mix(in oklab, var(--status-${status}) 45%, transparent)`,
                color: `var(--status-${status})`,
                boxShadow: last ? `0 0 0 6px color-mix(in oklab, var(--status-${status}) 16%, transparent), var(--shadow-lift)` : undefined,
              }}
            >
              <Icon className="size-5" />
            </span>
            <span className={last ? "text-sm font-semibold" : "text-sm text-muted"}>{text}</span>
          </li>
        );
      })}
    </ol>
  );
}
