import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Surface for grouped content. `interactive`: the card leads somewhere, so it lifts on hover with a
 * soft shadow in its own colour (pass `tint`, e.g. a status colour variable).
 */
export function Card({
  className,
  interactive,
  tint,
  style,
  ...props
}: ComponentProps<"div"> & { interactive?: boolean; tint?: string }) {
  return (
    <div
      className={cn("rounded-3xl border border-border bg-surface shadow-[var(--shadow-card)]", interactive && "card-lift", className)}
      style={tint ? ({ ...style, "--tint": tint } as React.CSSProperties) : style}
      {...props}
    />
  );
}
