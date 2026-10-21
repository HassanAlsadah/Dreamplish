import { Gauge } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { fmt, type Dictionary } from "@/lib/i18n/config";
import type { Usage } from "@/lib/rate-limit";

/** Profile: what's left of each free limit, as a bar per limit. */
export function UsageCard({ usage, d }: { usage: Usage[]; d: Dictionary }) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
          <Gauge aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">{d.usage.title}</h2>
          <p className="mt-1 text-sm text-muted">{d.usage.intro}</p>
        </div>
      </div>
      <ul className="mt-5 flex flex-col gap-4">
        {usage.map(({ key, used, max, window, unlimited }) => {
          const left = Math.max(0, max - used);
          const share = max ? left / max : 0;
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{d.usage.labels[key]}</span>
                <span className={cn("tabular-nums", left === 0 && !unlimited ? "font-medium text-danger" : "text-muted")}>
                  {unlimited ? d.usage.unlimited : fmt(window === "hour" ? d.usage.leftHour : d.usage.leftDay, { left, max })}
                </span>
              </div>
              <div
                role="meter"
                aria-label={d.usage.labels[key]}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={left}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
              >
                <div
                  className={cn("h-full rounded-full", unlimited ? "bg-accent" : share === 0 ? "bg-danger" : share < 0.25 ? "bg-status-interview" : "bg-accent")}
                  style={{ width: `${unlimited ? 100 : share * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
