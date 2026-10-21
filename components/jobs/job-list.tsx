"use client";

import { ArrowLeft, ArrowRight, Hourglass } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { fmt, formatDate } from "@/lib/i18n/config";
import type { Job } from "@/lib/types";
import { APPLIED_VIA_ICONS } from "./applied-via";
import { DeleteJobIconButton } from "./delete-job-icon-button";
import { STAGE_HEX, stageLabel, stageOf, type Stage } from "@/lib/stages";

/** Row cards modelled on the reference list design. */
export function JobList({
  jobs,
  stages,
  onDelete,
  waiting,
}: {
  jobs: Job[];
  stages: Stage[];
  onDelete: (job: Job) => void;
  /** Days without a reply, for jobs at Applied waiting two weeks or more. */
  waiting?: Map<string, number>;
}) {
  const { d, locale } = useI18n();
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const sorted = [...jobs].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((job, index) => {
        const stage = stageOf(job, stages);
        const color = stage ? STAGE_HEX[stage.color] : undefined;
        const label = stage ? stageLabel(stage, d) : d.status[job.status];
        const Via = job.applied_via ? APPLIED_VIA_ICONS[job.applied_via] : null;
        const days = waiting?.get(job.id);
        return (
        <li key={job.id} className="rise-in flex items-center gap-2" style={{ "--i": index } as React.CSSProperties}>
          <Link
            href={`/jobs/${job.id}`}
            className="card-lift group grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] transition hover:border-border-strong sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:px-7"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden className="inline-block size-3 shrink-0 rounded-full" style={{ background: color }} />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold" dir="auto">
                  {job.company.name}
                </p>
                <p className="truncate text-sm text-muted" dir="auto">
                  {job.title}
                </p>
                {(job.stage_detail || Via || days) && (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    {job.stage_detail && <span dir="auto">{job.stage_detail}</span>}
                    {Via && job.applied_via && (
                      <span className="inline-flex items-center gap-1">
                        <Via className="size-3" aria-hidden />
                        {d.appliedVia[job.applied_via]}
                      </span>
                    )}
                    {days ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-interview/15 px-2 py-0.5 font-medium text-fg">
                        <Hourglass className="size-3" aria-hidden />
                        {fmt(d.dashboard.waiting, { days })}
                      </span>
                    ) : null}
                  </p>
                )}
              </div>
            </div>

            <div className="hidden min-w-0 sm:block">
              <p className="text-xs text-muted">{d.dashboard.colApplied}</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {job.date_applied ? formatDate(job.date_applied, locale) : "—"}
              </p>
            </div>

            <div className="hidden sm:block">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm" dir="auto">
                <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: color }} />
                {label}
              </span>
            </div>

            <span className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition group-hover:opacity-90">
              <span className="sm:hidden">{label}</span>
              <span className="hidden sm:inline">{d.job.details}</span>
              <Arrow className="size-4" />
            </span>
          </Link>
          <DeleteJobIconButton job={job} onDelete={onDelete} className="size-10" />
        </li>
        );
      })}
    </ul>
  );
}
