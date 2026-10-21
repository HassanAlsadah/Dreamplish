"use client";

import { ArrowLeft, ArrowRight, Loader2, Newspaper, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BriefView } from "@/lib/briefing/types";
import { useI18n } from "@/lib/i18n/client";
import { fmt, formatDate } from "@/lib/i18n/config";
import { briefErrorText, useBrief } from "./use-brief";

/** Compact briefing entry point on the job page. Generation only starts on click. */
export function BriefingCard({
  companyId,
  jobId,
  initial,
  initialError,
}: {
  companyId: string;
  /** The job page we came from, so the briefing can link back to it. */
  jobId: string;
  initial: BriefView | null;
  initialError?: string | null;
}) {
  const { d, locale } = useI18n();
  const router = useRouter();
  const { brief, error, submitting, busy, request } = useBrief(companyId, initial);
  const href = `/companies/${companyId}?job=${jobId}`;
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const message = briefErrorText(d, error ?? initialError);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Newspaper className="size-5" />
        </span>
        <h2 className="font-semibold">{d.brief.title}</h2>
      </div>

      {brief?.generatedAt && !busy ? (
        <p className="mt-3 text-sm text-muted">{fmt(d.brief.generatedOn, { date: formatDate(brief.generatedAt, locale) })}</p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">{d.brief.cardBody}</p>
      )}

      {message && (
        <div className="mt-3">
          <Alert>{message}</Alert>
        </div>
      )}

      <div className="mt-4">
        {busy ? (
          <Link
            href={href}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border text-sm hover:bg-surface-2"
          >
            <Loader2 className="size-4 animate-spin text-accent" />
            {brief?.status === "pending" ? d.brief.pending : d.brief.generating}
          </Link>
        ) : brief?.generatedAt ? (
          <Link
            href={href}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-accent-fg hover:opacity-90"
          >
            {d.brief.view}
            <Arrow className="size-4" />
          </Link>
        ) : (
          <Button
            variant="accent"
            className="h-10 w-full rounded-full text-sm"
            disabled={submitting}
            onClick={async () => {
              if (await request(false)) router.push(href);
            }}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {brief?.status === "failed" ? d.brief.retry : d.brief.generate}
          </Button>
        )}
      </div>
    </Card>
  );
}
