"use client";

import { motion } from "motion/react";
import type { Move } from "@/lib/history";
import { timeline } from "@/lib/motion";

export type ConnectorPoint = { y: number; move: Move };

/**
 * The graph line: one SVG path through every node, top to bottom. Forward moves are straight;
 * backward / sideways moves bend out toward the content side (mirrored in RTL), like a git branch.
 * Drawn with stroke-dashoffset on a path normalised to length 1 (pathLength=1).
 */
export function TimelineConnector({
  points,
  x,
  width,
  height,
  rtl,
  startOffset,
  reduced,
}: {
  points: ConnectorPoint[];
  x: number;
  width: number;
  height: number;
  rtl: boolean;
  /** 1 = draw the whole line; a smaller value = only extend the end (new node). */
  startOffset: number;
  reduced: boolean;
}) {
  if (points.length < 2) return null;
  const bulge = (rtl ? -1 : 1) * Math.min(12, width / 2 - 3);
  let d = `M ${x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const { y, move } = points[i];
    const prev = points[i - 1].y;
    if (move === "forward" || move === "round") d += ` L ${x} ${y}`;
    else {
      const span = y - prev;
      d += ` C ${x + bulge} ${prev + span * 0.2}, ${x + bulge} ${prev + span * 0.8}, ${x} ${y}`;
    }
  }

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0 start-0 overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <motion.path
        d={d}
        fill="none"
        // Muted text colour, softened: visible on white and dark cards (≥3:1 for graphics).
        stroke="color-mix(in srgb, var(--muted) 75%, var(--surface))"
        strokeWidth={2}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        initial={reduced ? { strokeDashoffset: 0, opacity: 0 } : { strokeDashoffset: startOffset, opacity: 1 }}
        animate={{ strokeDashoffset: 0, opacity: 1 }}
        transition={reduced ? timeline.reduced : startOffset >= 1 ? timeline.lineDraw : timeline.lineExtend}
      />
    </svg>
  );
}
