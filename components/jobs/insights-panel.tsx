"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { APPLIED_VIA_ICONS } from "@/components/jobs/applied-via";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/history";
import { useI18n } from "@/lib/i18n/client";
import { fmt, getDir, intlTag, type Dictionary, type Locale } from "@/lib/i18n/config";
import { computeInsights, FOLLOW_UP_DAYS, type HistoryLite, type Insights } from "@/lib/insights";
import { insights as timing } from "@/lib/motion";
import { STAGE_HEX, stageLabel, type Stage } from "@/lib/stages";
import type { Job } from "@/lib/types";

const percent = (rate: number) => Math.round(rate * 100);

/**
 * Right-hand panel on the dashboard: how the search is going. Uses the live job list (so a drag on
 * the board updates the pipeline) and the status history loaded with the page.
 */
export function InsightsPanel({ jobs, history, stages, now }: { jobs: Job[]; history: HistoryLite[]; stages: Stage[]; now: number }) {
  const { d, locale } = useI18n();
  const reduced = Boolean(useReducedMotion());
  const data = useMemo(() => computeInsights({ jobs, history, stages, now }), [jobs, history, stages, now]);
  const rtl = getDir(locale) === "rtl";

  return (
    <section aria-labelledby="insights-title" className="rounded-3xl border border-border bg-surface">
      <div className="p-5 pb-4">
        <h2 id="insights-title" className="text-sm font-semibold">
          {d.insights.title}
        </h2>
        <ReplyRate data={data} reduced={reduced} d={d} />
      </div>

      <Section title={d.insights.pipeline} aside={fmt(d.insights.active, { count: data.active })}>
        <Pipeline data={data} reduced={reduced} rtl={rtl} d={d} />
      </Section>

      <Section title={d.insights.followUp} aside={data.followUpTotal ? String(data.followUpTotal) : undefined}>
        <FollowUps data={data} d={d} />
      </Section>

      <Section title={d.insights.activity} aside={fmt(d.insights.activityTotal, { count: data.weeks.reduce((n, w) => n + w.count, 0) })}>
        <Activity data={data} reduced={reduced} d={d} locale={locale} />
      </Section>

      <Section title={d.insights.channels}>
        <Channels data={data} d={d} />
      </Section>

      <Section title={d.insights.recent} last>
        <Recent data={data} d={d} intl={intlTag(locale)} now={now} />
      </Section>
    </section>
  );
}

function Section({ title, aside, last, children }: { title: string; aside?: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("border-t border-border px-5 pt-4", last ? "pb-5" : "pb-4")}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {aside && <span className="text-xs text-muted tabular-nums">{aside}</span>}
      </div>
      {children}
    </div>
  );
}

/** The one big number: share of applications that got a reply (counts up once on load). */
function ReplyRate({ data, reduced, d }: { data: Insights; reduced: boolean; d: Dictionary }) {
  const target = data.replyRate === null ? 0 : percent(data.replyRate);
  const value = useMotionValue(reduced ? target : 0);
  const shown = useTransform(value, (v) => `${Math.round(v)}%`);
  useEffect(() => {
    if (reduced) {
      value.set(target);
      return;
    }
    const controls = animate(value, target, timing.count);
    return () => controls.stop();
  }, [target, reduced, value]);

  if (data.replyRate === null) return <p className="mt-3 text-sm text-muted">{d.insights.noApplications}</p>;

  const days = data.medianDaysToReply;
  return (
    <div className="mt-3">
      <p className="flex items-baseline gap-3">
        <motion.span aria-hidden className="font-display text-5xl leading-none font-bold tabular-nums">
          {shown}
        </motion.span>
        <span className="text-sm text-muted">{d.insights.replyRate}</span>
      </p>
      <p className="sr-only">{`${target}% ${d.insights.replyRate}`}</p>
      <p className="mt-2 text-sm text-muted">{fmt(d.insights.replyCaption, { replied: data.replied, count: data.applications })}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">{d.insights.interviewRate}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {percent(data.interviewRate ?? 0)}%
            <span className="ms-1 text-xs font-normal text-muted">({data.interviewed})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{d.insights.timeToReply}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {days === null ? (
              <span className="font-normal text-muted">{d.insights.noReplies}</span>
            ) : days < 1 ? (
              d.insights.underADay
            ) : (
              fmt(d.insights.days, { count: Math.round(days) })
            )}
            {days !== null && <span className="ms-1 text-xs font-normal text-muted">{fmt(d.insights.fromReplies, { count: data.replySample })}</span>}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Board columns as one strip (same colours as the board), with a labelled count for each. */
function Pipeline({ data, reduced, rtl, d }: { data: Insights; reduced: boolean; rtl: boolean; d: Dictionary }) {
  const filled = data.pipeline.filter((p) => p.count > 0);
  return (
    <>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {filled.map((p, i) => (
          <motion.div
            key={p.stage.id}
            className="h-full first:rounded-s-full last:rounded-e-full"
            style={{ flexGrow: p.count, background: STAGE_HEX[p.stage.color], transformOrigin: rtl ? "right" : "left" }}
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ ...timing.segment, delay: i * timing.segmentStagger }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        {data.pipeline.map((p) => (
          <li key={p.stage.id} className={cn("flex items-center gap-2", p.count === 0 && "text-muted")}>
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: STAGE_HEX[p.stage.color], opacity: p.count ? 1 : 0.45 }} />
            <span className="min-w-0 flex-1 truncate" dir="auto">
              {stageLabel(p.stage, d)}
            </span>
            <span className="tabular-nums">{p.count}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function FollowUps({ data, d }: { data: Insights; d: Dictionary }) {
  if (!data.followUps.length) return <p className="text-[13px] text-muted">{fmt(d.insights.followUpEmpty, { days: FOLLOW_UP_DAYS })}</p>;
  return (
    <>
      <p className="mb-2 text-xs text-muted">{fmt(d.insights.followUpHint, { days: FOLLOW_UP_DAYS })}</p>
      <ul className="-mx-2 flex flex-col">
        {data.followUps.map(({ job, days }) => (
          <li key={job.id}>
            <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-[13px] transition-colors hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium" dir="auto">
                  {job.title}
                </span>
                <span className="block truncate text-xs text-muted" dir="auto">
                  {job.company.name}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{fmt(d.insights.days, { count: days })}</span>
            </Link>
          </li>
        ))}
      </ul>
      {data.followUpTotal > data.followUps.length && (
        <p className="mt-1 text-xs text-muted">{fmt(d.insights.more, { count: data.followUpTotal - data.followUps.length })}</p>
      )}
    </>
  );
}

/** Applications per week (8 weeks); bars rise once on load, hover or focus shows the number. */
function Activity({ data, reduced, d, locale }: { data: Insights; reduced: boolean; d: Dictionary; locale: Locale }) {
  const max = Math.max(1, ...data.weeks.map((w) => w.count));
  const day = new Intl.DateTimeFormat(intlTag(locale), { day: "numeric", month: "short" });
  return (
    <div>
      <ol className="flex h-16 items-end gap-1.5 border-b border-border" aria-label={d.insights.activity}>
        {data.weeks.map((w, i) => {
          const label = fmt(d.insights.weekLabel, { count: w.count, date: day.format(w.start) });
          return (
            <li key={w.start} tabIndex={0} aria-label={label} className="group relative flex h-full flex-1 items-end rounded-t-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <motion.span
                aria-hidden
                className={cn("block w-full rounded-t-[4px]", w.count ? "bg-accent" : "bg-border")}
                style={{ height: w.count ? `${(w.count / max) * 100}%` : 2, transformOrigin: "bottom" }}
                initial={reduced ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ ...timing.bar, delay: timing.barsStart + i * timing.barStagger }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-full start-1/2 mb-1 -translate-x-1/2 rounded-md bg-fg px-1.5 py-0.5 text-[11px] whitespace-nowrap text-bg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:translate-x-1/2"
              >
                {w.count}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{day.format(data.weeks[0].start)}</span>
        <span>{d.insights.thisWeek}</span>
      </div>
    </div>
  );
}

function Channels({ data, d }: { data: Insights; d: Dictionary }) {
  if (!data.channels.length) return <p className="text-[13px] text-muted">{d.insights.channelsEmpty}</p>;
  const small = Math.max(...data.channels.map((c) => c.total)) < 5;
  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {data.channels.map((c) => {
          const Icon = APPLIED_VIA_ICONS[c.via];
          return (
            <li key={c.via} className="text-[13px]">
              <div className="flex items-center gap-2">
                <Icon aria-hidden className="size-3.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">{d.appliedVia[c.via]}</span>
                <span className="font-semibold tabular-nums">{percent(c.rate)}%</span>
                <span className="w-12 text-end text-xs text-muted tabular-nums">{fmt(d.insights.ofTotal, { replied: c.replied, total: c.total })}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-surface-2" aria-hidden>
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(c.rate * 100, c.replied ? 4 : 0)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {small && <p className="mt-2 text-xs text-muted">{d.insights.smallSample}</p>}
    </>
  );
}

function Recent({ data, d, intl, now }: { data: Insights; d: Dictionary; intl: string; now: number }) {
  if (!data.recent.length) return <p className="text-[13px] text-muted">{d.insights.recentEmpty}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {data.recent.map(({ job, entry }) => {
        const what = entry.step_kind
          ? d.history.kinds[entry.step_kind]
          : entry.to_stage_label === "assessment"
            ? d.stages.assessment
            : d.status[entry.to_status];
        return (
          <li key={`${entry.job_id}-${entry.changed_at}`} className="text-[13px]">
            <Link href={`/jobs/${job.id}`} className="group block">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium group-hover:underline" dir="auto">
                  {what}
                  {entry.step_type && <span className="font-normal text-muted"> — {entry.step_type}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                  {relativeTime(entry.changed_at, now, intl)}
                </span>
              </span>
              <span className="block truncate text-xs text-muted" dir="auto">
                {job.title} · {job.company.name}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
