/**
 * Shared motion settings (animate skill: ease-out for entering, exits ~75% of enter time,
 * 200–300 ms for UI, snappy springs for interruptible motion, transform/opacity/stroke only).
 * Every animation in the app should take its timing from here.
 */
export const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_CUBIC = [0.32, 0, 0.67, 0] as const;

export const SPRING_SNAPPY = { type: "spring", stiffness: 400, damping: 30 } as const;

export const timeline = {
  /** The graph line draws itself from the first node to the last. */
  lineDraw: { duration: 0.6, ease: EASE_OUT_QUINT },
  /** Extending the line to a newly added node. */
  lineExtend: { duration: 0.3, ease: EASE_OUT_QUINT },
  /** Nodes pop in after the line has started drawing. */
  nodesStart: 0.15,
  nodeStagger: 0.06,
  nodeSpring: SPRING_SNAPPY,
  /** Text next to a node follows it. */
  labelDelay: 0.12,
  label: { duration: 0.2, ease: EASE_OUT_QUINT },
  /** Soft ring around the current node. */
  pulse: { duration: 2, repeat: Infinity, ease: "easeOut" },
  /** Hover / focus. */
  hoverScale: 1.12,
  hover: { duration: 0.15, ease: EASE_OUT_QUINT },
  tooltipIn: { duration: 0.15, ease: EASE_OUT_QUINT },
  tooltipOut: { duration: 0.11, ease: EASE_IN_CUBIC },
  /** prefers-reduced-motion: a single fade, nothing else. */
  reduced: { duration: 0.2, ease: "linear" },
} as const;

/**
 * Dashboard insights: one load sequence. The reply rate counts up while the pipeline strip fills,
 * then the weekly bars rise. Only transform (scale) and the number animate; reduced motion shows
 * the final state at once.
 */
export const insights = {
  count: { duration: 0.9, ease: EASE_OUT_QUINT },
  segment: { duration: 0.5, ease: EASE_OUT_QUINT },
  segmentStagger: 0.05,
  barsStart: 0.25,
  bar: { duration: 0.45, ease: EASE_OUT_QUINT },
  barStagger: 0.04,
} as const;

/**
 * Everyday interface motion. CSS mirrors these in globals.css (--dur-*, --ease-*), so components
 * animated with classes and with motion/react feel the same.
 */
export const ui = {
  press: { duration: 0.1, ease: EASE_OUT_QUINT },
  hover: { duration: 0.18, ease: EASE_OUT_QUINT },
  enter: { duration: 0.22, ease: EASE_OUT_QUINT },
  exit: { duration: 0.16, ease: EASE_IN_CUBIC },
  /** Lists: first items stagger in, then the rest appear together (long lists don't drag on). */
  stagger: 0.04,
  staggerMax: 8,
  /** Page / route change: fade + small rise. */
  page: { duration: 0.22, ease: EASE_OUT_QUINT, distance: 8 },
  /** prefers-reduced-motion: a short fade only. */
  reduced: { duration: 0.15, ease: "linear" },
} as const;
