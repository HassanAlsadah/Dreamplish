"use client";

import { ArrowLeft, ArrowRight, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/client";

/** Screen-only toolbar; opens the print dialog once fonts are ready. */
const TEMPLATES = ["classic", "modern", "compact"] as const;

export function PrintToolbar({ backHref, jobId, template }: { backHref: string; jobId: string; template: string }) {
  const { d, locale } = useI18n();
  const Back = locale === "ar" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    let cancelled = false;
    if (sessionStorage.getItem("cv-print-opened") === jobId) return;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      try {
        sessionStorage.setItem("cv-print-opened", jobId);
      } catch {}
      setTimeout(() => window.print(), 300);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <div className="mx-auto mb-4 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-neutral-700 hover:text-black">
        <Back className="size-4" />
        {d.career.printBack}
      </Link>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-neutral-600">{d.career.template}:</span>
        <div className="flex rounded-xl bg-white p-1 shadow-sm">
          {TEMPLATES.map((t) => (
            <Link
              key={t}
              href={`/cv/${jobId}?template=${t}`}
              replace
              className={`rounded-lg px-3 py-1 ${t === template ? "bg-neutral-900 text-white" : "text-neutral-700 hover:text-black"}`}
            >
              {{ classic: d.career.tplClassic, modern: d.career.tplModern, compact: d.career.tplCompact }[t]}
            </Link>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white hover:opacity-90"
      >
        <Printer className="size-4" />
        {d.career.printSave}
      </button>
    </div>
  );
}
