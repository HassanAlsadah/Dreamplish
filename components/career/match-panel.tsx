"use client";

import { Loader2, ScanSearch, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { confirmedSkills, reportReady, type JobAnalysis, type TailoredCv } from "@/lib/career/types";
import { useI18n } from "@/lib/i18n/client";
import { AnalysisView } from "./analysis-view";
import { Progress } from "./career-progress";
import { CvQuickAdd } from "./cv-quick-add";
import { FindDescriptionButton } from "./find-description-button";
import { needsSkillCheck, SkillCheckCard } from "./skill-check-card";
import { TailorCard } from "./tailor-card";
import { careerErrorText, useCareerAction } from "./use-career-action";

export function MatchPanel({
  jobId,
  hasJobDescription,
  hasCv,
  initialAnalysis,
  initialTailored,
}: {
  jobId: string;
  hasJobDescription: boolean;
  hasCv: boolean;
  initialAnalysis: JobAnalysis | null;
  initialTailored: TailoredCv | null;
}) {
  const { d } = useI18n();
  const [analysis, setAnalysis] = useState(initialAnalysis);
  // Lets the user add a CV right here; the page refreshes with it afterwards.
  const [cvAdded, setCvAdded] = useState(false);
  const cvReady = hasCv || cvAdded;
  const analyze = useCareerAction<JobAnalysis>(`/api/jobs/${jobId}/analyze`, setAnalysis);

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        {d.career.privacyNote}
      </p>

      {!cvReady && <CvQuickAdd onSaved={() => setCvAdded(true)} />}

      {/* Analysis + score */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold">{d.career.score}</h2>
            <p className="mt-1 text-sm text-muted">{d.career.analyzeIntro}</p>
          </div>
          {hasJobDescription && (
            <Button variant={analysis ? "secondary" : "accent"} onClick={() => analyze.run()} disabled={analyze.pending}>
              {analyze.pending ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
              {analysis ? d.career.reanalyze : d.career.analyze}
            </Button>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {!hasJobDescription && (
            <>
              <Alert>{d.career.needJd}</Alert>
              <FindDescriptionButton jobId={jobId} />
            </>
          )}
          {analyze.pending && <Progress text={d.career.analyzing} />}
          {analyze.error && <Alert>{careerErrorText(d, analyze.error)}</Alert>}
          {analysis && !analyze.pending && (
            // The report waits until the gaps have been tested (or the user skips the check).
            needsSkillCheck(analysis) ? (
              <SkillCheckCard jobId={jobId} analysis={analysis} onDone={setAnalysis} />
            ) : (
              <AnalysisView analysis={analysis} hasCv={cvReady} d={d} />
            )
          )}
        </div>
      </Card>

      {/* Tailored CV */}
      <TailorCard
        jobId={jobId}
        hasCv={cvReady}
        initial={initialTailored}
        ready={Boolean(analysis?.cvUsed) && reportReady(analysis)}
        toAdd={confirmedSkills(analysis)}
      />
    </div>
  );
}
