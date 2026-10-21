"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const MIN_PT = 7.5;
const MAX_PT = 12.5;
const STEP_PT = 0.25;
const PX_PER_MM = 96 / 25.4;
/** Upper bound for the extra space added between sections, so a short CV doesn't look stretched. */
const MAX_EXTRA_GAP_PX = 22;

/**
 * Makes the CV fill exactly one page: picks the largest font size whose content still fits the
 * page height (shrinking long CVs, growing short ones), then shares any space that's left between
 * the sections. Every size inside uses em, so spacing scales with the text.
 */
export function FitOnePage({ pageHeightMm, children }: { pageHeightMm: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ pt: 10.5, extra: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => {
      const limit = pageHeightMm * PX_PER_MM;
      el.style.setProperty("--cv-extra", "0px");
      const fits = (pt: number) => {
        el.style.fontSize = `${pt}pt`;
        return el.scrollHeight <= limit;
      };
      // Largest size that fits (binary search over 0.25pt steps).
      let lo = 0;
      let hi = Math.round((MAX_PT - MIN_PT) / STEP_PT);
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (fits(MIN_PT + mid * STEP_PT)) lo = mid;
        else hi = mid - 1;
      }
      const pt = MIN_PT + lo * STEP_PT;
      el.style.fontSize = `${pt}pt`;
      // Share the leftover height between section gaps.
      const gaps = Math.max(1, el.querySelectorAll("section").length);
      const extra = Math.max(0, Math.min(MAX_EXTRA_GAP_PX, Math.floor((limit - el.scrollHeight) / gaps)));
      setFit({ pt, extra });
    };
    run();
    // Re-fit once web fonts have loaded (they change line widths).
    document.fonts?.ready.then(run);
  }, [pageHeightMm, children]);

  return (
    <div ref={ref} style={{ fontSize: `${fit.pt}pt`, "--cv-extra": `${fit.extra}px` } as CSSProperties}>
      {children}
    </div>
  );
}
