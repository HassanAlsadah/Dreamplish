import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Placeholder that holds the layout while content loads (no layout shift). A light band slides
 * across; it stays still with reduced motion. Hidden from screen readers — wrap the loading area in
 * aria-busy instead.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}
