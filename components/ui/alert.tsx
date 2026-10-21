import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  danger: { icon: CircleAlert, className: "border-danger/25 bg-danger-soft text-danger" },
  success: { icon: CircleCheck, className: "border-status-offer/25 bg-[var(--status-offer-soft)] text-status-offer" },
  info: { icon: Info, className: "border-accent/25 bg-accent/8 text-accent" },
};

/** Inline message with an icon (colour is never the only signal). */
export function Alert({ tone = "danger", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  const { icon: Icon, className } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm", className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-pretty">{children}</div>
    </div>
  );
}
