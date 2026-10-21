"use client";

import { Lightbulb, Loader2, MessagesSquare, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { InterviewPrep, InterviewQuestion } from "@/lib/career/types";
import { useI18n } from "@/lib/i18n/client";
import { fmt, formatDate } from "@/lib/i18n/config";
import { Progress } from "./career-progress";
import { careerErrorText, useCareerAction } from "./use-career-action";

export function PrepPanel({
  jobId,
  hasBrief,
  initial,
}: {
  jobId: string;
  hasBrief: boolean;
  initial: InterviewPrep | null;
}) {
  const { d, locale } = useI18n();
  const [prep, setPrep] = useState(initial);
  const action = useCareerAction<InterviewPrep>(`/api/jobs/${jobId}/prep`, setPrep);

  const categories: Array<[InterviewQuestion["category"], string]> = [
    ["role", d.career.catRole],
    ["behavioral", d.career.catBehavioral],
    ["company", d.career.catCompany],
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        {d.career.privacyNote}
      </p>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold">{d.career.tabPrep}</h2>
            <p className="mt-1 text-sm text-muted">{d.career.prepIntro}</p>
            {!hasBrief && <p className="mt-2 text-xs text-muted">{d.career.prepNoBrief}</p>}
          </div>
          <Button variant={prep ? "secondary" : "accent"} onClick={() => action.run()} disabled={action.pending}>
            {action.pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {prep ? d.career.reprep : d.career.prep}
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {action.pending && <Progress text={d.career.preparing} />}
          {action.error && <Alert>{careerErrorText(d, action.error)}</Alert>}
        </div>
      </Card>

      {prep && !action.pending && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card className="p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <MessagesSquare className="size-5 text-accent" />
              {d.career.questions}
            </h3>
            <p className="-mt-2 mb-4 text-xs text-muted">{d.career.answerNote}</p>
            <div className="flex flex-col gap-6">
              {categories.map(([cat, label]) => {
                const qs = prep.questions.filter((q) => q.category === cat);
                if (!qs.length) return null;
                return (
                  <div key={cat}>
                    <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
                    <ol className="flex flex-col gap-3">
                      {qs.map((q, i) => (
                        <li key={i} className="rounded-2xl border border-border bg-surface-2 p-4">
                          <p className="font-medium" dir="auto">
                            {q.question}
                          </p>
                          {q.why && (
                            <p className="mt-1 text-sm text-muted" dir="auto">
                              <span className="font-medium">{d.career.why}:</span> {q.why}
                            </p>
                          )}
                          {q.suggestedAnswer && (
                            <details className="group mt-3 rounded-xl border border-border bg-surface p-3">
                              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-accent">
                                {d.career.suggestedAnswer}
                                <span
                                  className={
                                    q.cvBasis
                                      ? "rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent"
                                      : "rounded-full bg-border px-2 py-0.5 text-[11px] text-muted"
                                  }
                                >
                                  {q.cvBasis ? d.career.fromYourCv : d.career.generalApproach}
                                </span>
                              </summary>
                              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line" dir="auto">
                                {q.suggestedAnswer}
                              </p>
                              {q.cvBasis && (
                                <p className="mt-2 text-xs text-muted" dir="auto">
                                  <span className="font-medium">{d.career.basedOn}:</span> “{q.cvBasis}”
                                </p>
                              )}
                            </details>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="h-fit p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <Lightbulb className="size-5 text-accent" />
              {d.career.talkingPoints}
            </h3>
            {prep.talkingPoints.length === 0 ? (
              <p className="text-sm text-muted">{d.career.needCv}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {prep.talkingPoints.map((t, i) => (
                  <li key={i} className="border-s-2 border-accent ps-4">
                    <p dir="auto">{t.point}</p>
                    <p className="mt-1.5 text-xs text-muted" dir="auto">
                      <span className="font-medium">{d.career.basedOn}:</span> “{t.cvEvidence}”
                    </p>
                    {t.companyFact && (
                      <p className="mt-1 text-xs text-muted" dir="auto">
                        <span className="font-medium">{d.career.connectsTo}:</span> {t.companyFact}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 text-xs text-muted">{fmt(d.career.generatedOn, { date: formatDate(prep.generatedAt, locale) })}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
