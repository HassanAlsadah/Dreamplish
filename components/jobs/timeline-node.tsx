"use client";

import { Bookmark, ClipboardCheck, MessagesSquare, Phone, Send, Trophy, XCircle, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties, Ref } from "react";
import { entryColorVar, type HistoryEntry } from "@/lib/history";
import { timeline } from "@/lib/motion";
import type { JobStatus } from "@/lib/types";

const ICONS: Record<JobStatus, LucideIcon> = {
  saved: Bookmark,
  applied: Send,
  interview: MessagesSquare,
  offer: Trophy,
  rejected: XCircle,
};

/**
 * One commit on the graph. The current status is larger with a soft pulsing ring; Offer glows
 * softly; Rejected is a muted red. Focusable so the details card works from the keyboard.
 */
export function TimelineNode({
  entry,
  current,
  isNew,
  delay,
  reduced,
  label,
  describedBy,
  onOpen,
  onClose,
  buttonRef,
}: {
  entry: HistoryEntry;
  current: boolean;
  isNew: boolean;
  delay: number;
  reduced: boolean;
  label: string;
  describedBy?: string;
  onOpen: () => void;
  onClose: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  // Steps show what happened (a call, an assessment, an interview); plain moves show the column.
  const Icon =
    entry.step_kind === "call"
      ? Phone
      : entry.step_kind === "assessment" || (!entry.step_kind && entry.to_stage_label === "assessment")
        ? ClipboardCheck
        : entry.step_kind === "interview"
          ? MessagesSquare
          : ICONS[entry.to_status];
  const color = entryColorVar(entry);
  const size = current ? 28 : 20;

  const style: CSSProperties = {
    width: size,
    height: size,
    background:
      entry.to_status === "rejected" ? `color-mix(in srgb, ${color} 62%, var(--surface))` : color,
    // Offer: soft glow (static — only transform/opacity animate).
    boxShadow:
      entry.to_status === "offer"
        ? `0 0 0 4px color-mix(in srgb, ${color} 22%, transparent), 0 0 16px color-mix(in srgb, ${color} 45%, transparent)`
        : "0 0 0 3px var(--surface)",
  };

  const enter = !isNew
    ? false
    : reduced
      ? { opacity: 0 }
      : { opacity: 0, scale: 0.6 };
  const transition = reduced ? { ...timeline.reduced, delay } : { ...timeline.nodeSpring, delay };

  return (
    <span className="relative inline-flex items-center justify-center">
      {current && !reduced && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: color }}
          initial={{ scale: 1, opacity: 0 }}
          animate={{ scale: [1, 1.6], opacity: [0.35, 0] }}
          transition={{ ...timeline.pulse, delay: delay + 0.4 }}
        />
      )}
      <motion.button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={describedBy}
        className="relative inline-flex items-center justify-center rounded-full text-white"
        style={style}
        initial={enter}
        animate={{ opacity: 1, scale: 1 }}
        transition={transition}
        whileHover={reduced ? undefined : { scale: timeline.hoverScale, transition: timeline.hover }}
        whileFocus={reduced ? undefined : { scale: timeline.hoverScale, transition: timeline.hover }}
        onMouseEnter={onOpen}
        onMouseLeave={onClose}
        onFocus={onOpen}
        onBlur={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <Icon aria-hidden className={current ? "size-3.5" : "size-3"} strokeWidth={2.5} />
      </motion.button>
    </span>
  );
}
