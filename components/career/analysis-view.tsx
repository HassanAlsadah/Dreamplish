"use client";

import { BadgeCheck, Check, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";
import { scoreLabel, type JobAnalysis, type Requirement } from "@/lib/career/types";
import { useI18n } from "@/lib/i18n/client";
import { fmt, formatDate, type Dictionary } from "@/lib/i18n/config";

const scoreColor = { strong: "text-status-offer", good: "text-accent", partial: "text-status-interview", low: "text-status-rejected" };

function ScoreRing({ score, d }: { score: number; d: Dictionary }) {
  const label = scoreLabel(score);
  const text = { strong: d.career.scoreStrong, good: d.career.scoreGood, partial: d.career.scorePartial, low: d.career.scoreLow }[label];
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <div className={cn("relative size-28 shrink-0", scoreColor[label])}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - score / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-fg tabular-nums" dir="ltr">
          {score}%
        </span>
      </div>
      <div>
        <p className={cn("text-xl font-semibold", scoreColor[label])}>{text}</p>
        <p className="mt-1 max-w-sm text-xs text-muted">{d.career.scoreHow}</p>
      </div>
    </div>
  );
}

export function AnalysisView({ analysis, hasCv, d }: { analysis: JobAnalysis; hasCv: boolean; d: Dictionary }) {
  const { locale } = useI18n();
  const seniority = {
    junior: d.career.seniorityJunior,
    mid: d.career.seniorityMid,
    senior: d.career.senioritySenior,
    lead: d.career.seniorityLead,
    unknown: d.career.seniorityUnknown,
  }[analysis.seniority.level];
  const matched = analysis.requirements.filter((r) => r.matched);
  const gaps = analysis.requirements.filter((r) => !r.matched);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        {analysis.score !== null ? (
          <ScoreRing score={analysis.score} d={d} />
        ) : (
          !hasCv && (
            <Alert>{d.career.needCv}</Alert>
          )
        )}
        <div className="text-sm">
          <p className="text-muted">{d.career.seniority}</p>
          <p className="text-lg font-semibold">{seniority}</p>
          {analysis.seniority.evidence && (
            <p className="mt-0.5 max-w-xs text-xs text-muted" dir="auto">
              “{analysis.seniority.evidence}”
            </p>
          )}
        </div>
      </div>

      <CheckResults analysis={analysis} d={d} />

      {analysis.requirements.length === 0 ? (
        <p className="text-sm text-muted">{d.career.noRequirements}</p>
      ) : analysis.cvUsed ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <RequirementList title={`${d.career.matched} (${matched.length})`} items={matched} tone="match" d={d} />
          <RequirementList title={`${d.career.gaps} (${gaps.length})`} items={gaps} tone="gap" d={d} />
        </div>
      ) : (
        <RequirementList title={d.career.fromJd} items={analysis.requirements} tone="neutral" d={d} />
      )}

      <p className="text-xs text-muted">{fmt(d.career.generatedOn, { date: formatDate(analysis.generatedAt, locale) })}</p>
    </div>
  );
}

function RequirementList({
  title,
  items,
  tone,
  d,
}: {
  title: string;
  items: Requirement[];
  tone: "match" | "gap" | "neutral";
  d: Dictionary;
}) {
  const sorted = [...items].sort((a, b) => (a.importance === b.importance ? 0 : a.importance === "must" ? -1 : 1));
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        {tone === "match" && <Check className="size-4 text-status-offer" />}
        {tone === "gap" && <X className="size-4 text-status-rejected" />}
        {title}
      </h3>
      <ul className="flex flex-col gap-2">
        {sorted.map((r) => (
          <li key={r.name} className="rounded-2xl border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium" dir="auto">
                {r.name}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  r.importance === "must" ? "bg-primary text-primary-fg" : "bg-border text-fg",
                )}
              >
                {r.importance === "must" ? d.career.must : d.career.nice}
              </span>
              <span className="text-[11px] text-muted">{r.kind === "tool" ? d.career.tool : d.career.skill}</span>
              {r.verifiedBy === "self" && (
                <span className="rounded-full bg-status-interview/15 px-2 py-0.5 text-[11px] font-medium text-fg">
                  {d.career.selfReported}
                </span>
              )}
              {r.verifiedBy === "test" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                  <BadgeCheck className="size-3" />
                  {d.career.verifiedByTest}
                </span>
              )}
            </div>
            {r.alternatives && r.alternatives.length > 1 && (
              <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted" dir="auto">
                <span>{d.career.anyOne}:</span>
                {r.alternatives.map((a) => (
                  <span
                    key={a}
                    className={cn(
                      "rounded-full px-2 py-0.5",
                      r.matchedVia && a.toLowerCase() === r.matchedVia.toLowerCase()
                        ? "bg-status-offer/15 font-medium text-status-offer"
                        : "bg-border text-fg",
                    )}
                  >
                    {a}
                  </span>
                ))}
                {r.matchedVia && <span className="ms-1">· {fmt(d.career.matchedVia, { option: r.matchedVia })}</span>}
              </p>
            )}
            {r.verifiedBy === "test" ? (
              <p className="mt-1.5 text-xs text-muted">{d.career.passedCheck}</p>
            ) : r.verifiedBy === "self" ? (
              <p className="mt-1.5 text-xs text-muted">{d.career.selfNote}</p>
            ) : r.cvEvidence ? (
              <p className="mt-1.5 text-xs text-muted" dir="auto">
                <span className="font-medium text-fg">{d.career.fromCv}:</span> “{r.cvEvidence}”
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted" dir="auto">
                <span className="font-medium text-fg">{d.career.fromJd}:</span> “{r.jdQuote}”
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckResults({ analysis, d }: { analysis: JobAnalysis; d: Dictionary }) {
  const check = analysis.skillCheck;
  if (check?.status !== "done" || !check.results?.length) return null;
  const passed = check.results.filter((r) => r.correct).length;
  const skills = [...new Set(check.results.map((r) => r.skill))];
  const verified = analysis.requirements.filter((r) => r.verifiedBy === "test").length;
  return (
    <details className="rounded-2xl border border-border bg-surface-2 p-4">
      <summary className="cursor-pointer text-sm font-medium">
        {fmt(d.career.skillsPassed, { passed: verified, total: skills.length })} ·{" "}
        {fmt(d.career.checkResult, { passed, total: check.results.length })} · {d.career.reviewAnswers}
      </summary>
      <ol className="mt-3 flex flex-col gap-3 text-sm">
        {check.results.map((r, i) => {
          const q = check.questions[i];
          return (
            <li key={i}>
              <p className="flex items-center gap-2 font-medium" dir="auto">
                {r.correct ? <Check className="size-4 text-status-offer" /> : <X className="size-4 text-status-rejected" />}
                {q?.question}
              </p>
              {!r.correct && q && (
                <p className="mt-1 text-muted" dir="auto">
                  {d.career.yourAnswer}: {r.chosen === -1 ? d.career.idk : q.options[r.chosen]} · {d.career.correctAnswer}:{" "}
                  {q.options[r.answerIndex]}
                </p>
              )}
              {r.explanation && (
                <p className="mt-1 text-muted" dir="auto">
                  {r.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
