import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * "Nothing here yet" — never a blank space: an icon in a soft colour wash, one sentence, and the
 * action that fills it. `tint` is a colour variable (a status colour, or the accent by default).
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tint = "var(--accent)",
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  tint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <span
        aria-hidden
        className="relative flex size-14 items-center justify-center rounded-2xl"
        style={{ background: `color-mix(in oklab, ${tint} 14%, var(--surface))`, color: tint }}
      >
        <Icon className="size-6" />
        <span
          className="absolute -inset-2 -z-10 rounded-3xl opacity-60 blur-xl"
          style={{ background: `color-mix(in oklab, ${tint} 22%, transparent)` }}
        />
      </span>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {body && <p className="max-w-sm text-pretty text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
