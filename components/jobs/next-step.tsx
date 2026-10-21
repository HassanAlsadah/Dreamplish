import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { getJobHistory } from "@/lib/history-server";
import type { Dictionary, Locale } from "@/lib/i18n/config";
import { nextStep } from "@/lib/next-step";
import type { Stage } from "@/lib/stages";
import type { Job } from "@/lib/types";

/** Job page bar: "Applied 16 days ago, no reply. Send a short follow-up." and similar. */
export async function NextStepBar({
  job,
  stage,
  hasAnalysis,
  d,
  locale,
}: {
  job: Job;
  stage: Stage | undefined;
  hasAnalysis: boolean;
  d: Dictionary;
  locale: Locale;
}) {
  const { entries, now } = await getJobHistory(job.id);
  const applied = Date.parse(job.date_applied ? `${job.date_applied}T12:00:00Z` : job.created_at);
  const last = Math.max(applied, ...entries.map((e) => Date.parse(e.changed_at)));
  const step = nextStep({ job, stage, idleDays: Math.max(0, Math.floor((now - last) / 86_400_000)), hasAnalysis, d });
  if (!step) return null;
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const external = step.action?.href.startsWith("http");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm" role="note">
      <Lightbulb className="size-4 shrink-0 text-status-interview" aria-hidden />
      <span className="font-medium">{d.nextStep.title}</span>
      <span className="min-w-0 flex-1 text-muted">{step.text}</span>
      {step.action &&
        (external ? (
          <a href={step.action.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            {step.action.label}
            <Arrow className="size-3.5" />
          </a>
        ) : (
          <Link href={step.action.href} scroll={false} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            {step.action.label}
            <Arrow className="size-3.5" />
          </Link>
        ))}
    </div>
  );
}
