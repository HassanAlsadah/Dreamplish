"use client";

import {
  AlertTriangle,
  Banknote,
  Boxes,
  Users,
  ShieldAlert,
  Building2,
  Globe,
  ExternalLink,
  FlaskConical,
  HeartHandshake,
  Loader2,
  Newspaper,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { BriefItem, BriefView, Confidence, RoleInsights, SalaryEntry, Section, SourceRef, Watchouts } from "@/lib/briefing/types";
import { useI18n } from "@/lib/i18n/client";
import { fmt, formatDate, intlTag, type Dictionary, type Locale } from "@/lib/i18n/config";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefProgress } from "./brief-progress";
import { briefErrorText, useBrief } from "./use-brief";
import { webUrl } from "@/lib/safe-url";

export function BriefingPanel({
  companyId,
  companyName,
  companyWebsite,
  initial,
  initialError,
}: {
  companyId: string;
  companyName: string;
  companyWebsite: string | null;
  initial: BriefView | null;
  initialError?: string | null;
}) {
  const { d, locale } = useI18n();
  const { brief, error, submitting, busy, request } = useBrief(companyId, initial);

  const timeFmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(intlTag(locale), { hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "";
  const requestError = briefErrorText(d, error ?? initialError, { time: timeFmt(brief?.canRefreshAt ?? null) });

  // No brief yet
  if (!brief) {
    return (
      <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-3xl bg-accent/10 text-accent">
          <Sparkles className="size-6" />
        </span>
        <h2 className="font-display text-2xl font-bold">{d.brief.emptyTitle}</h2>
        <p className="max-w-md text-muted">{fmt(d.brief.emptyBody, { company: companyName })}</p>
        {requestError && <Alert>{requestError}</Alert>}
        <Button size="lg" variant="dawn" onClick={() => request(false)} disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {d.brief.generate}
        </Button>
      </Card>
    );
  }

  const hasContent = Boolean(brief.sections);
  const failed = brief.status === "failed";
  // A website the user entered wins over one found by search.
  const website = webUrl(companyWebsite ?? brief.links.website);
  const linkedin = webUrl(brief.links.linkedin);
  const linkClass =
    "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm hover:border-border-strong";

  return (
    <div className="flex flex-col gap-5">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {brief.generatedAt ? fmt(d.brief.generatedOn, { date: formatDate(brief.generatedAt, locale) }) : null}
        </p>
        <div className="flex items-center gap-2">
          {busy ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm">
              <Loader2 className="size-4 animate-spin text-accent" />
              {brief.status === "pending" ? d.brief.pending : d.brief.generating}
            </span>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => request(hasContent)} disabled={submitting}>
              <RefreshCw className={cn("size-4", submitting && "animate-spin")} />
              {failed && !hasContent ? d.brief.retry : d.brief.refresh}
            </Button>
          )}
        </div>
      </div>

      {requestError && <Alert>{requestError}</Alert>}

      {(website || linkedin) && (
        <div className="flex flex-wrap gap-2">
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <Globe className="size-4 text-accent" />
              {d.brief.website}
              <span dir="ltr" className="text-muted">{new URL(website).hostname.replace(/^www\./, "")}</span>
            </a>
          )}
          {linkedin && (
            <a href={linkedin} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-[#0a66c2]">
                <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
              </svg>
              {d.brief.linkedin}
            </a>
          )}
        </div>
      )}

      {brief.provider === "mock" && hasContent && (
        <div className="flex items-start gap-3 rounded-2xl border border-status-interview/40 bg-status-interview/10 px-4 py-3 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0" />
          <p>{d.brief.sampleBanner}</p>
        </div>
      )}

      {failed && (
        <Card className="flex items-start gap-3 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
          <div>
            <p className="font-semibold">{d.brief.failedTitle}</p>
            <p className="mt-1 text-sm text-muted">{briefErrorText(d, brief.error) ?? d.errors.generic}</p>
          </div>
        </Card>
      )}

      {busy && <BriefProgress status={brief.status === "pending" ? "pending" : "generating"} refreshing={hasContent} />}

      {busy && !hasContent && <SkeletonSections />}

      {hasContent && brief.sections && (
        <div className={cn("stagger-children grid gap-5 lg:grid-cols-2", busy && "opacity-60")}>
          {brief.summary && (
            <SectionCard icon={<Building2 className="size-5" />} title={d.brief.overview} className="lg:col-span-2">
              <p dir="auto" className="text-[15px] leading-relaxed">
                {brief.summary.text}
              </p>
              <SourceLinks sources={brief.summary.sources} />
            </SectionCard>
          )}
          <SectionCard icon={<Newspaper className="size-5" />} title={d.brief.news} hint={d.brief.newsHint} className="lg:col-span-2">
            <ItemList section={brief.sections.news} showDates locale={locale} d={d} />
          </SectionCard>
          <RoleCard insights={brief.roleInsights} roles={brief.viewerRoles} company={companyName} locale={locale} d={d} />
          <WatchoutsCard watchouts={brief.watchouts} locale={locale} d={d} />
          <SectionCard icon={<Boxes className="size-5" />} title={d.brief.projects}>
            <ItemList section={brief.sections.projects} locale={locale} d={d} />
          </SectionCard>
          <SectionCard icon={<HeartHandshake className="size-5" />} title={d.brief.values} hint={d.brief.valuesHint}>
            <ItemList section={brief.sections.values} locale={locale} d={d} />
          </SectionCard>
          <SectionCard icon={<Wrench className="size-5" />} title={d.brief.skills} hint={d.brief.skillsHint}>
            <SkillChips section={brief.sections.skills} d={d} />
          </SectionCard>
          <SectionCard icon={<Banknote className="size-5" />} title={d.brief.salary} hint={d.brief.salaryHint}>
            <SalaryList entries={brief.salary} missing={brief.salaryMissingRoles} locale={locale} d={d} />
          </SectionCard>
        </div>
      )}

      {hasContent && <p className="text-center text-xs text-muted">{d.brief.disclaimer}</p>}

      {brief.searchSuggestions && (
        <div>
          <p className="mb-2 text-xs text-muted">{d.brief.searchSuggestions}</p>
          {/* Google's widget HTML, isolated: no scripts, links open in a new tab. */}
          <iframe
            title={d.brief.searchSuggestions}
            srcDoc={`<base target="_blank">${brief.searchSuggestions}`}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="h-20 w-full rounded-2xl border border-border bg-white"
          />
        </div>
      )}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  hint,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function NotFound({ d }: { d: Dictionary }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-4 text-sm">
      <p className="font-medium">{d.brief.notFound}</p>
      <p className="mt-0.5 text-muted">{d.brief.notFoundHint}</p>
    </div>
  );
}

function SourceLinks({ sources }: { sources: SourceRef[] }) {
  const links = sources.flatMap((s) => {
    const url = webUrl(s.url);
    return url ? [{ ...s, url }] : [];
  });
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {links.map((s) => (
        <a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          title={s.url}
          className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs text-muted hover:text-fg"
        >
          <ExternalLink className="size-3 shrink-0" />
          <span className="truncate">{s.title}</span>
        </a>
      ))}
    </span>
  );
}

function ItemList({
  section,
  showDates,
  locale,
  d,
}: {
  section: Section;
  showDates?: boolean;
  locale: Locale;
  d: Dictionary;
}) {
  if (section.status === "not_found" || section.items.length === 0) return <NotFound d={d} />;
  return (
    <ul className="flex flex-col gap-4">
      {section.items.map((item: BriefItem, i) => (
        <li key={i} className="text-[15px] leading-relaxed">
          {showDates && item.published_at && (
            <p className="mb-0.5 text-xs font-medium text-muted">{formatDate(item.published_at, locale)}</p>
          )}
          {/* Generated text is usually English; dir="auto" keeps it readable inside RTL pages. */}
          {item.name && (
            <p dir="auto" className="font-semibold">
              {item.name}
            </p>
          )}
          <p dir="auto" className={item.name ? "text-muted" : undefined}>
            {item.text}
          </p>
          <SourceLinks sources={item.sources} />
        </li>
      ))}
    </ul>
  );
}

function SkillChips({ section, d }: { section: Section; d: Dictionary }) {
  if (section.status === "not_found" || section.items.length === 0) return <NotFound d={d} />;
  const sources = [...new Map(section.items.flatMap((i) => i.sources).map((s) => [s.url, s])).values()];
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {section.items.map((item, i) => (
          <li key={i} dir="auto" className="rounded-full bg-accent/10 px-3 py-1 text-sm text-fg">
            {item.text}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">{d.brief.sources}</p>
      <SourceLinks sources={sources} />
    </div>
  );
}

const confidenceStyle: Record<Confidence, string> = {
  low: "bg-status-rejected/10 text-status-rejected",
  medium: "bg-status-interview/15 text-fg",
  high: "bg-status-offer/15 text-status-offer",
};

function SalaryList({
  entries,
  missing,
  locale,
  d,
}: {
  entries: SalaryEntry[];
  missing: string[];
  locale: Locale;
  d: Dictionary;
}) {
  const money = (n: number, currency: string) => {
    try {
      return new Intl.NumberFormat(intlTag(locale), { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${n.toLocaleString(intlTag(locale))} ${currency}`;
    }
  };
  const period = { year: d.brief.perYear, month: d.brief.perMonth, hour: d.brief.perHour };
  const confidence = { low: d.brief.confidenceLow, medium: d.brief.confidenceMedium, high: d.brief.confidenceHigh };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <NotFound d={d} />
        {missing.length > 0 && <p className="text-xs text-muted">{fmt(d.brief.salaryMissing, { roles: missing.join(", ") })}</p>}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-5">
      {entries.map((e, i) => (
        <li key={i}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium" dir="auto">
              {e.role}
            </p>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", confidenceStyle[e.confidence])}>
              {d.brief.confidence}: {confidence[e.confidence]}
            </span>
          </div>
          <p className="mt-1 text-xl font-semibold tabular-nums" dir="ltr">
            {e.min && e.max ? `${money(e.min, e.currency)} – ${money(e.max, e.currency)}` : money((e.min ?? e.max)!, e.currency)}
            <span className="ms-2 text-sm font-normal text-muted">{period[e.period]}</span>
          </p>
          {e.note && (
            <p className="text-sm text-muted" dir="auto">
              {e.note}
            </p>
          )}
          <SourceLinks sources={e.sources} />
        </li>
      ))}
      {missing.length > 0 && <p className="text-xs text-muted">{fmt(d.brief.salaryMissing, { roles: missing.join(", ") })}</p>}
    </ul>
  );
}

/** Where each section will appear: the same grid as the finished briefing, shimmering. */
function SkeletonSections() {
  return (
    <div className="grid gap-5 lg:grid-cols-2" aria-hidden>
      {[true, false, false, false, false].map((wide, i) => (
        <div key={i} className={cn("flex flex-col gap-3 rounded-3xl border border-border bg-surface p-6", wide && "lg:col-span-2")}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          {wide && <Skeleton className="h-3 w-2/3" />}
        </div>
      ))}
    </div>
  );
}

const woStatusStyle = {
  confirmed: "bg-status-rejected/15 text-status-rejected",
  alleged: "bg-status-interview/20 text-fg",
  reported: "bg-border text-fg",
};

function WatchoutsCard({ watchouts, locale, d }: { watchouts: Watchouts | null; locale: Locale; d: Dictionary }) {
  const category = {
    layoffs: d.brief.woLayoffs,
    legal: d.brief.woLegal,
    financial: d.brief.woFinancial,
    workplace: d.brief.woWorkplace,
    leadership: d.brief.woLeadership,
    reputation: d.brief.woReputation,
  };
  const status = { reported: d.brief.woReported, alleged: d.brief.woAlleged, confirmed: d.brief.woConfirmed };

  return (
    <Card className="border-status-interview/40 bg-status-interview/5 p-6 lg:col-span-2">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-status-interview/20 text-fg">
          <ShieldAlert className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">{d.brief.watchouts}</h2>
          <p className="text-xs text-muted">{d.brief.watchoutsHint}</p>
        </div>
      </div>

      {!watchouts ? (
        <p className="text-sm text-muted">{d.brief.watchoutsRefresh}</p>
      ) : watchouts.items.length === 0 ? (
        <p className="text-sm">{d.brief.watchoutsNone}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {watchouts.items.map((w, i) => (
            <li key={i} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-medium">{category[w.category]}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 font-medium", woStatusStyle[w.status])}>{status[w.status]}</span>
                <span className="text-muted">{formatDate(w.published_at, locale)}</span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed" dir="auto">
                {w.text}
              </p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-muted">{d.brief.woQuote}</summary>
                <p className="mt-1 border-s-2 border-border ps-3 text-muted italic" dir="auto">
                  “{w.quote}”
                </p>
              </details>
              {w.interview_tip && (
                <p className="mt-2 text-sm" dir="auto">
                  <span className="font-medium">{d.brief.woAsk}:</span> <span className="text-muted">{w.interview_tip}</span>
                </p>
              )}
              <SourceLinks sources={w.sources} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">{d.brief.watchoutsDisclaimer}</p>
    </Card>
  );
}

function RoleCard({
  insights,
  roles,
  company,
  locale,
  d,
}: {
  insights: RoleInsights | null;
  roles: string[];
  company: string;
  locale: Locale;
  d: Dictionary;
}) {
  const empty = insights && !insights.duties.length && !insights.team_work.length && !insights.tools.length;
  // A plain LinkedIn people search the user opens themselves — the app never reads LinkedIn.
  const peopleSearch = (role: string) =>
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${role} ${company}`)}`;

  return (
    <Card className="p-6 lg:col-span-2">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Users className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">{d.brief.roleTitle}</h2>
          <p className="text-xs text-muted">{d.brief.roleHint}</p>
        </div>
      </div>

      {!insights ? (
        <p className="text-sm text-muted">{d.brief.roleRefresh}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {roles.map((role) => {
            const duties = insights.duties.filter((x) => x.role === role);
            return (
              <div key={role}>
                <h3 className="mb-2 font-medium" dir="auto">
                  {fmt(d.brief.roleDuties, { role })}
                </h3>
                {duties.length ? (
                  <ul className="flex flex-col gap-3">
                    {duties.map((x, i) => (
                      <li key={i} className="text-[15px] leading-relaxed">
                        <p dir="auto">{x.text}</p>
                        <SourceLinks sources={x.sources} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{d.brief.roleDutiesNone}</p>
                )}
                <a
                  href={peopleSearch(role)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 text-sm hover:border-border-strong"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-[#0a66c2]">
                    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
                  </svg>
                  {d.brief.rolePeople}
                </a>
                <p className="mt-1 text-xs text-muted">{d.brief.rolePeopleNote}</p>
              </div>
            );
          })}

          {insights.team_work.length > 0 && (
            <div>
              <h3 className="mb-2 font-medium">{d.brief.roleTeamWork}</h3>
              <ul className="flex flex-col gap-3">
                {insights.team_work.map((x, i) => (
                  <li key={i} className="text-[15px] leading-relaxed">
                    {x.published_at && <p className="mb-0.5 text-xs text-muted">{formatDate(x.published_at, locale)}</p>}
                    <p dir="auto">{x.text}</p>
                    <SourceLinks sources={x.sources} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.tools.length > 0 && (
            <div>
              <h3 className="mb-2 font-medium">{d.brief.roleTools}</h3>
              <ul className="flex flex-wrap gap-2">
                {insights.tools.map((x) => (
                  <li key={x.text} dir="auto" className="rounded-full bg-accent/10 px-3 py-1 text-sm">
                    {x.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {empty && roles.length === 0 && <p className="text-sm text-muted">{d.brief.roleNone}</p>}
        </div>
      )}
    </Card>
  );
}
