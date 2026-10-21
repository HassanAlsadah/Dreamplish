"use client";

import { Trash2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

/**
 * Job page "Delete": goes to the dashboard, which removes the job with an Undo toast and deletes it
 * for real only after the toast has gone (no "are you sure?" dialog).
 */
export function DeleteJobButton({ jobId }: { jobId: string }) {
  const { d } = useI18n();
  return (
    <ButtonLink href={`/dashboard?delete=${jobId}`} variant="ghost" className="text-danger">
      <Trash2 className="size-4" />
      {d.job.delete}
    </ButtonLink>
  );
}
