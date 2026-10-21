"use client";

import { ScanSearch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { MarkAppliedButton } from "@/components/jobs/mark-applied-button";
import { scoreLabel } from "@/lib/career/types";
import type { Draft } from "@/lib/dal";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/cn";

const SHOWN = 4;
const scoreColor = { strong: "text-status-offer", good: "text-accent", partial: "text-status-interview", low: "text-status-rejected" };

/**
 * Dashboard: jobs the user checked before applying (kept until they apply or delete them). Each opens
 * on Match & CV; "I applied" moves it to the board.
 */
export function DraftsStrip({ drafts }: { drafts: Draft[] }) {
  const { d } = useI18n();
  const [showAll, setShowAll] = useState(false);
  if (!drafts.length) return null;
  const shown = showAll ? drafts : drafts.slice(0, SHOWN);
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ScanSearch aria-hidden className="size-4 text-accent" />
          {d.check.draftsTitle}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted tabular-nums">{drafts.length}</span>
        </h2>
        <p className="text-xs text-muted">{d.check.draftsHint}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {shown.map((draft) => (
          <li key={draft.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0">
            <Link href={`/jobs/${draft.id}?tab=match`} className="group min-w-0 flex-1">
              <span className="block truncate font-medium group-hover:underline" dir="auto">
                {draft.title}
              </span>
              <span className="block truncate text-xs text-muted" dir="auto">
                {draft.company}
              </span>
            </Link>
            <span className={cn("text-sm tabular-nums", draft.score === null ? "text-muted" : cn("font-semibold", scoreColor[scoreLabel(draft.score)]))}>
              {draft.score === null ? d.check.notMatched : fmt(d.check.score, { score: Math.round(draft.score) })}
            </span>
            <MarkAppliedButton jobId={draft.id} size="sm" />
          </li>
        ))}
      </ul>
      {drafts.length > SHOWN && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-medium text-accent hover:underline">
          {showAll ? d.check.showLess : fmt(d.check.more, { count: drafts.length - SHOWN })}
        </button>
      )}
    </Card>
  );
}
