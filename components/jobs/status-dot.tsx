import { Bookmark, MessagesSquare, Send, Trophy, XCircle, type LucideIcon } from "lucide-react";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

export const statusColor: Record<JobStatus, string> = {
  saved: "bg-status-saved",
  applied: "bg-status-applied",
  interview: "bg-status-interview",
  offer: "bg-status-offer",
  rejected: "bg-status-rejected",
};

/** One icon per status, so status is never shown by colour alone. */
export const STATUS_ICONS: Record<JobStatus, LucideIcon> = {
  saved: Bookmark,
  applied: Send,
  interview: MessagesSquare,
  offer: Trophy,
  rejected: XCircle,
};

export function StatusDot({ status, className }: { status: JobStatus; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-3 shrink-0 rounded-full", statusColor[status], className)} />;
}

/** Tinted pill: status icon + label on a soft wash of the status colour (fades when it changes). */
export function StatusBadge({ status, label }: { status: JobStatus; label: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium [transition-property:background-color,border-color,color] duration-200"
      style={{
        background: `var(--status-${status}-soft)`,
        borderColor: `color-mix(in oklab, var(--status-${status}) 30%, transparent)`,
        color: `var(--status-${status})`,
      }}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="text-fg">{label}</span>
    </span>
  );
}
