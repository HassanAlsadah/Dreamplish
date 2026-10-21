"use client";

import { ClipboardCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { JobAnalysis, SelfAssessment } from "@/lib/career/types";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { Progress } from "./career-progress";
import { careerErrorText, useCareerAction } from "./use-career-action";

export function needsSkillCheck(a: JobAnalysis) {
  const hasGaps = a.cvUsed && a.requirements.some((r) => !r.matched);
  return hasGaps && (!a.skillCheck || a.skillCheck.status === "pending");
}

export function SkillCheckCard({
  jobId,
  analysis,
  onDone,
}: {
  jobId: string;
  analysis: JobAnalysis;
  onDone: (a: JobAnalysis) => void;
}) {
  const { d } = useI18n();
  const questions = analysis.skillCheck?.questions ?? [];
  const [answers, setAnswers] = useState<Array<number | undefined>>([]);
  const start = useCareerAction<JobAnalysis>(`/api/jobs/${jobId}/skill-check`, onDone);
  const submit = useCareerAction<JobAnalysis>(`/api/jobs/${jobId}/skill-check`, onDone);
  const gaps = analysis.requirements
    .filter((r) => !r.matched)
    .sort((a, b) => (a.importance === b.importance ? 0 : a.importance === "must" ? -1 : 1));
  const [assessment, setAssessment] = useState<Record<string, SelfAssessment>>({});
  const assessed = gaps.filter((g) => assessment[g.name]).length;
  const answered = answers.filter((a) => a !== undefined).length;
  const put = (body: object) =>
    submit.run({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface-2 p-5">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-accent" />
        <div>
          <h3 className="font-semibold">{d.career.checkTitle}</h3>
          <p className="mt-1 text-sm text-muted">{questions.length ? d.career.unsureIntro : d.career.assessIntro}</p>
        </div>
      </div>

      {questions.length === 0 ? (
        start.pending ? (
          <Progress text={d.career.checkCreating} />
        ) : (
          <>
            {/* Step 1: do you know this skill? */}
            <ul className="flex flex-col gap-2">
              {gaps.map((g) => (
                <li
                  key={g.name}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium" dir="auto">
                      {g.name}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        g.importance === "must" ? "bg-primary text-primary-fg" : "bg-border text-fg",
                      )}
                    >
                      {g.importance === "must" ? d.career.must : d.career.nice}
                    </span>
                  </div>
                  <div role="radiogroup" aria-label={g.name} className="flex rounded-xl border border-border bg-surface-2 p-1">
                    {(
                      [
                        ["yes", d.career.assessYes],
                        ["unsure", d.career.assessUnsure],
                        ["no", d.career.assessNo],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={assessment[g.name] === value}
                        onClick={() => setAssessment((prev) => ({ ...prev, [g.name]: value }))}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-sm transition",
                          assessment[g.name] === value ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="accent"
                disabled={assessed < gaps.length}
                onClick={() =>
                  start.run({
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ assessment }),
                  })
                }
              >
                <ClipboardCheck className="size-4" />
                {d.career.assessContinue}
              </Button>
              <Button variant="ghost" onClick={() => put({ skip: true })} disabled={submit.pending}>
                {d.career.checkSkip}
              </Button>
              <span className="text-sm text-muted">{fmt(d.career.assessProgress, { answered: assessed, total: gaps.length })}</span>
            </div>
          </>
        )
      ) : (
        <>
          <ol className="flex flex-col gap-4">
            {questions.map((q, qi) => (
              <li key={qi} className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs font-medium text-muted" dir="auto">
                  {qi + 1}. {q.skill}
                </p>
                <p className="mt-1 font-medium" dir="auto">
                  {q.question}
                </p>
                <div role="radiogroup" className="mt-3 flex flex-col gap-2">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                        answers[qi] === oi ? "border-accent bg-accent/10" : "border-border hover:border-border-strong",
                      )}
                    >
                      <input
                        type="radio"
                        name={`q${qi}`}
                        className="mt-0.5 accent-[var(--accent)]"
                        checked={answers[qi] === oi}
                        onChange={() => setAnswers((prev) => Object.assign([...prev], { [qi]: oi }))}
                      />
                      <span dir="auto">{opt}</span>
                    </label>
                  ))}
                  {/* "I don't know" — always offered, always counted as wrong (sent as -1). */}
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted transition",
                      answers[qi] === -1 ? "border-accent bg-accent/10 text-fg" : "border-border hover:border-border-strong",
                    )}
                  >
                    <input
                      type="radio"
                      name={`q${qi}`}
                      className="mt-0.5 accent-[var(--accent)]"
                      checked={answers[qi] === -1}
                      onChange={() => setAnswers((prev) => Object.assign([...prev], { [qi]: -1 }))}
                    />
                    <span>{d.career.idk}</span>
                  </label>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={answered < questions.length || submit.pending}
              onClick={() => put({ answers })}
            >
              {submit.pending && <Loader2 className="size-4 animate-spin" />}
              {d.career.checkSubmit}
            </Button>
            <Button variant="ghost" onClick={() => put({ skip: true })} disabled={submit.pending}>
              {d.career.checkSkip}
            </Button>
            <span className="text-sm text-muted">
              {fmt(d.career.checkProgress, { answered, total: questions.length })}
            </span>
          </div>
        </>
      )}
      {(start.error || submit.error) && <Alert>{careerErrorText(d, start.error ?? submit.error)}</Alert>}
    </div>
  );
}
