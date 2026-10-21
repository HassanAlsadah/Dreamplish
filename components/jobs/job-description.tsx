"use client";

import { ChevronDown, FileText, Pencil } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";

type Block = { kind: "heading" | "paragraph"; text: string } | { kind: "list"; items: string[] };

const BULLET = /^\s*(?:[-•*▪●◦·–]|\d{1,2}[.)])\s+/;
/** Long descriptions start folded; this is roughly what fits in the folded height. */
const FOLD_AT = 900;

/** Plain posting text → headings, paragraphs and bullet lists. */
export function parseDescription(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim());
  lines.forEach((line, i) => {
    if (!line) return flush();
    if (BULLET.test(line)) {
      flush();
      const item = line.replace(BULLET, "");
      const last = blocks.at(-1);
      if (last?.kind === "list") last.items.push(item);
      else blocks.push({ kind: "list", items: [item] });
      return;
    }
    // A short line that ends with ":" or leads into a list reads as a section heading.
    const next = lines.slice(i + 1).find(Boolean) ?? "";
    const short = line.length <= 60 && !/[.!?؟،,]$/.test(line);
    if (short && (line.endsWith(":") || (!paragraph.length && BULLET.test(next)))) {
      flush();
      blocks.push({ kind: "heading", text: line.replace(/:$/, "") });
      return;
    }
    paragraph.push(line);
  });
  flush();
  return blocks;
}

/**
 * A saved job description, shown as a readable document instead of a text box. Edit swaps in the
 * text box (the form keeps submitting the saved text through the hidden field until then).
 */
export function JobDescriptionView({ value, onEdit }: { value: string; onEdit: () => void }) {
  const { d } = useI18n();
  const bodyId = useId();
  const long = value.length > FOLD_AT;
  const [open, setOpen] = useState(false);
  const blocks = parseDescription(value);
  const words = value.trim().split(/\s+/).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-fg">{d.job.jobDescription}</h3>
        <Button type="button" variant="secondary" size="sm" onClick={onEdit} className="gap-1.5">
          <Pencil aria-hidden className="size-3.5" />
          {d.job.editDescription}
        </Button>
      </div>
      <input type="hidden" name="jobDescription" value={value} />

      <article className="overflow-hidden rounded-2xl border border-border bg-surface-2">
        <div className="flex items-center gap-2 border-b border-border px-5 py-2.5 text-xs text-muted">
          <FileText aria-hidden className="size-3.5" />
          {fmt(d.job.descriptionWords, { count: words })}
        </div>
        <div
          id={bodyId}
          dir="auto"
          className={cn(
            "relative flex flex-col gap-3 px-5 py-4 text-[15px] leading-relaxed text-fg",
            long && !open && "max-h-80 overflow-hidden",
          )}
        >
          {blocks.map((b, i) =>
            b.kind === "heading" ? (
              <h4 key={i} className="pt-1 text-sm font-semibold text-fg first:pt-0">
                {b.text}
              </h4>
            ) : b.kind === "list" ? (
              <ul key={i} className="flex list-disc flex-col gap-1 ps-5 marker:text-muted">
                {b.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className="text-fg/90">
                {b.text}
              </p>
            ),
          )}
          {long && !open && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface-2 to-transparent"
            />
          )}
        </div>
        {long && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2.5 text-sm font-medium text-fg transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {open ? d.job.descriptionLess : d.job.descriptionMore}
            <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
          </button>
        )}
      </article>
    </div>
  );
}
