"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { SPRING_SNAPPY } from "@/lib/motion";

/**
 * Tabs that are links (each tab has its own URL, so it can be shared and opened in a new tab). The
 * underline glides to the selected tab (a shared-layout spring); with reduced motion it just moves.
 */
export function TabLinks({ label, tabs }: { label: string; tabs: { href: string; label: string; current: boolean }[] }) {
  const reduced = useReducedMotion();
  const group = useId();
  return (
    <nav aria-label={label} className="-mb-2 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.current ? "page" : undefined}
          scroll={false}
          className={cn(
            "relative rounded-t-lg px-4 py-3 text-sm whitespace-nowrap [transition-property:color,background-color] duration-150",
            t.current ? "font-semibold text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {t.label}
          {t.current && (
            <motion.span
              layoutId={`tab-underline-${group}`}
              transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
              className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[image:var(--gradient-dawn)]"
            />
          )}
        </Link>
      ))}
    </nav>
  );
}
