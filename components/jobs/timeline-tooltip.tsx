"use client";

import { AnimatePresence, motion } from "motion/react";
import { timeline } from "@/lib/motion";

/**
 * Details card next to a node on hover / focus. Everything in it is also in the list text,
 * so nothing depends on hovering.
 */
export function TimelineTooltip({
  id,
  open,
  reduced,
  children,
}: {
  id: string;
  open: boolean;
  reduced: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id={id}
          role="tooltip"
          className="absolute top-0 start-full z-20 ms-3 w-64 rounded-2xl border border-border bg-surface p-3 text-sm shadow-[var(--shadow-card)] origin-[left_top] rtl:origin-[right_top]"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, x: -4 }}
          animate={{ opacity: 1, scale: 1, x: 0, transition: reduced ? timeline.reduced : timeline.tooltipIn }}
          exit={{ opacity: 0, scale: reduced ? 1 : 0.98, transition: reduced ? timeline.reduced : timeline.tooltipOut }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
