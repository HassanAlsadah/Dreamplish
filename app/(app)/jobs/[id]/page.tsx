import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink, Globe } from "lucide-react";
import { Suspense } from "react";
import { StatusTimelineSkeleton } from "@/components/jobs/status-timeline";
import { StatusTimelineSection } from "@/components/jobs/status-timeline-section";
import { BriefingCard } from "@/components/briefing/briefing-card";
import { DeleteJobButton } from "@/components/jobs/delete-job-button";
import { MarkAppliedButton } from "@/components/jobs/mark-applied-button";
import { JobForm } from "@/components/jobs/job-form";
import { NextStepBar } from "@/components/jobs/next-step";
import { FindDescriptionButton } from "@/components/career/find-description-button";
import { AppliedViaCard } from "@/components/jobs/applied-via";
import { Breadcrumbs, withNames } from "@/components/ui/breadcrumbs";
import { TabLinks } from "@/components/ui/tab-links";
import { Card } from "@/components/ui/card";
import { updateJob } from "@/lib/actions/jobs";
import { getBriefView } from "@/lib/briefing/service";
import { getCareerData } from "@/lib/career/service";
import { MatchPanel } from "@/components/career/match-panel";
import { PrepPanel } from "@/components/career/prep-panel";
import { getJob, getProfile, listStages } from "@/lib/dal";
import { STAGE_HEX, stageLabel, stageOf } from "@/lib/stages";
import { fmt, formatDate } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { todayIso } from "@/lib/schemas/job";

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const job = await getJob((await params).id);
  return { title: job ? `${job.title} · ${job.company.name}` : undefined };
}

export default async function JobPage({ params, searchParams }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const tabParam = (await searchParams).tab;
  const tab = tabParam === "match" || tabParam === "prep" ? tabParam : "details";
  const [{ locale, d }, job, stages] = await Promise.all([getI18n(), getJob(id), listStages()]);
  if (!job) notFound();
  const [brief, career, profile] = await Promise.all([getBriefView(job.company.id), getCareerData(job.id), getProfile()]);
  const hasCv = Boolean(profile?.cv_text?.trim());
  const tabs = [
    { key: "details", label: d.career.tabDetails },
    { key: "match", label: d.career.tabMatch },
    { key: "prep", label: d.career.tabPrep },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        label={d.nav.breadcrumb}
        items={[
          { label: d.dashboard.title, href: "/dashboard" },
          // Company and role together as one item: "Abyan Capital – Software Engineering"; each name
          // keeps its own direction (Arabic or English) inside the page's.
          {
            label: withNames("{company} – {role}", { company: job.company.name, role: job.title }),
            text: `${job.company.name} – ${job.title}`,
          },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted">{job.company.name}</p>
          <h1 className="mt-1 font-display text-3xl font-bold break-words sm:text-4xl">{job.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
            {(() => {
              const stage = stageOf(job, stages);
              return (
                // Status chip on a soft wash of the column's colour (fades when the status changes).
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium text-fg [transition-property:background-color,border-color] duration-200"
                  style={{
                    background: `color-mix(in oklab, ${stage ? STAGE_HEX[stage.color] : "var(--muted)"} 12%, var(--surface))`,
                    borderColor: `color-mix(in oklab, ${stage ? STAGE_HEX[stage.color] : "var(--muted)"} 30%, transparent)`,
                  }}
                  dir="auto"
                >
                  <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: stage ? STAGE_HEX[stage.color] : undefined }} />
                  {stage ? stageLabel(stage, d) : d.status[job.status]}
                  {job.stage_detail && <span className="text-xs text-muted">· {job.stage_detail}</span>}
                </span>
              );
            })()}
            <span>{job.date_applied ? fmt(d.job.appliedOn, { date: formatDate(job.date_applied, locale) }) : d.job.notApplied}</span>
            {job.applied_via && <span>· {d.appliedVia[job.applied_via]}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {job.status === "saved" && <MarkAppliedButton jobId={job.id} />}
          {job.link && (
            <a
              href={job.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-medium text-accent-fg hover:opacity-90"
            >
              <ExternalLink className="size-4" />
              {d.job.openLink}
            </a>
          )}
          <DeleteJobButton jobId={job.id} />
        </div>
      </div>

      <Suspense fallback={null}>
        <NextStepBar job={job} stage={stageOf(job, stages)} hasAnalysis={Boolean(career.analysis)} d={d} locale={locale} />
      </Suspense>

      {/* Status history: sticky rail on the start side (desktop), compact card above the tabs (mobile). */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <Card className="p-5">
            <Suspense fallback={<StatusTimelineSkeleton />}>
              <StatusTimelineSection job={job} />
            </Suspense>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-4 lg:hidden">
            <Suspense fallback={<StatusTimelineSkeleton compact />}>
              <StatusTimelineSection job={job} compact />
            </Suspense>
          </Card>

          <TabLinks
            label={d.career.tabDetails}
            tabs={tabs.map((t) => ({
              href: t.key === "details" ? `/jobs/${job.id}` : `/jobs/${job.id}?tab=${t.key}`,
              label: t.label,
              current: tab === t.key,
            }))}
          />

          {tab === "match" ? (
            <MatchPanel
              jobId={job.id}
              hasJobDescription={Boolean(job.job_description?.trim())}
              hasCv={hasCv}
              initialAnalysis={career.analysis}
              initialTailored={career.tailored}
            />
          ) : tab === "prep" ? (
            <PrepPanel jobId={job.id} hasBrief={Boolean(brief.view?.sections)} initial={career.prep} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <Card className="p-6 sm:p-8">
                <h2 className="mb-6 text-lg font-semibold">{d.job.editTitle}</h2>
                <JobForm action={updateJob.bind(null, job.id)} job={job} today={todayIso()} stages={stages} />
              </Card>

              <aside className="flex flex-col gap-4">
                <AppliedViaCard job={job} d={d} locale={locale} />
                <BriefingCard companyId={job.company.id} jobId={job.id} initial={brief.view} initialError={brief.error} />
                {!job.job_description?.trim() && (
                  <Card className="p-5">
                    <h2 className="mb-1 font-semibold">{d.career.noJdTitle}</h2>
                    <p className="mb-3 text-sm text-muted">{d.career.noJdText}</p>
                    <FindDescriptionButton jobId={job.id} />
                  </Card>
                )}
                {job.company.website && (
                  <a
                    href={job.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="inline-flex max-w-full items-center gap-2 truncate px-2 text-sm text-accent hover:underline"
                  >
                    <Globe className="size-4 shrink-0" />
                    {job.company.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
