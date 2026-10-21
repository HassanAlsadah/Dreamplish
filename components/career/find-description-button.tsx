"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { findDescription } from "@/lib/actions/description";
import { useI18n } from "@/lib/i18n/client";

/** Fills an empty job description from the company's careers page or hiring system (never LinkedIn). */
export function FindDescriptionButton({ jobId }: { jobId: string }) {
  const { d } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      setMessage(null);
      const { status } = await findDescription(jobId).catch(() => ({ status: "error" }));
      if (status === "found" || status === "has_description") return router.refresh();
      setMessage(
        status === "not_configured"
          ? d.career.jdNotConfigured
          : status === "not_found"
            ? d.career.jdNotFound
            : status === "rate_limited"
              ? d.errors.tooMany
              : d.errors.generic,
      );
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={run} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {pending ? d.career.findingJd : d.career.findJd}
        </Button>
        <span className="text-xs text-muted">{d.career.findJdHint}</span>
      </div>
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
