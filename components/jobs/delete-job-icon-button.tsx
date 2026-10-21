"use client";

import { Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import type { Job } from "@/lib/types";

/** Small trash button used on Kanban cards and list rows. */
export function DeleteJobIconButton({ job, onDelete, className }: { job: Job; onDelete: (job: Job) => void; className?: string }) {
  const { d } = useI18n();
  const label = d.dashboard.deleteJob.replace("{job}", `${job.title} · ${job.company.name}`);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Keep the click from starting a drag (Kanban) or following the row's link (list).
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete(job);
      }}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-danger-soft hover:text-danger focus-visible:text-danger ${className ?? ""}`}
    >
      <Trash2 className="size-4" />
    </button>
  );
}
