"use client";

import { Check, Copy, FileDown, FileText, Loader2, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import type { TailoredCv } from "@/lib/career/types";
import { useI18n } from "@/lib/i18n/client";
import { fmt, formatDate } from "@/lib/i18n/config";
import { Progress } from "./career-progress";
import { careerErrorText, useCareerAction } from "./use-career-action";

export function TailorCard({
  jobId,
  hasCv,
  initial,
  ready,
  toAdd,
}: {
  jobId: string;
  hasCv: boolean;
  initial: TailoredCv | null;
  /** Match report finished — tailoring depends on it. */
  ready: boolean;
  toAdd: string[];
}) {
  const { d, locale } = useI18n();
  const [tailored, setTailored] = useState(initial);
  const [text, setText] = useState(initial?.text ?? "");
  const [copied, setCopied] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const generate = useCareerAction<TailoredCv>(`/api/jobs/${jobId}/tailor`, (data) => {
    setTailored(data);
    setText(data.text);
  });
  const save = useCareerAction<TailoredCv>(`/api/jobs/${jobId}/tailor`, (data) => {
    setTailored(data);
    setSavedAt(data.editedAt ?? null);
  });
  const dirty = tailored !== null && text !== tailored.text;

  const [wordError, setWordError] = useState<string | null>(null);
  const downloadWord = async () => {
    setWordError(null);
    if (dirty) {
      const ok = await save.run({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!ok) return;
    }
    const res = await fetch(`/api/jobs/${jobId}/cv-docx`).catch(() => null);
    if (!res?.ok) {
      const code = ((await res?.json().catch(() => ({}))) as { error?: string } | undefined)?.error;
      setWordError(
        code === "lines_changed"
          ? d.career.errLinesChanged
          : code === "file_changed"
            ? d.career.errFileChanged
            : code === "no_file"
              ? d.career.errNoFile
              : d.career.errGeneric,
      );
      return;
    }
    const blob = await res.blob();
    const name = decodeURIComponent(res.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? "cv.docx");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    // The PDF is rendered from the saved version, so save edits first.
    if (dirty) {
      const ok = await save.run({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!ok) return;
    }
    window.open(`/cv/${jobId}`, "_blank", "noopener");
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold">{d.career.tailorTitle}</h2>
          <p className="mt-1 text-sm text-muted">{d.career.tailorIntro}</p>
        </div>
        {hasCv && ready && (
          <Button variant={tailored ? "secondary" : "accent"} onClick={() => generate.run()} disabled={generate.pending}>
            {generate.pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {tailored ? d.career.retailor : d.career.tailor}
          </Button>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {!hasCv && (
          <Alert>{d.career.needCv}</Alert>
        )}
        {hasCv && !ready && <Alert>{d.career.needReport}</Alert>}
        {hasCv && ready && toAdd.length > 0 && !generate.pending && (
          <p className="rounded-2xl bg-accent/10 px-4 py-3 text-sm" dir="auto">
            {fmt(d.career.willAdd, { skills: toAdd.join(", ") })}
          </p>
        )}
        {generate.pending && <Progress text={d.career.tailoring} />}
        {generate.error && <Alert>{careerErrorText(d, generate.error)}</Alert>}

        {tailored && !generate.pending && (
          <>
            {tailored.warnings.length > 0 && (
              <Alert>{fmt(d.career.checkNumbers, { numbers: tailored.warnings.join(", ") })}</Alert>
            )}

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              dir="auto"
              className="min-h-[28rem] font-mono text-sm leading-relaxed"
              maxLength={60000}
              aria-label={d.career.tailorTitle}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? d.career.copied : d.career.copy}
              </Button>
              {tailored.mode === "docx" && (
                <Button variant="accent" size="sm" onClick={downloadWord} disabled={save.pending}>
                  <FileDown className="size-4" />
                  {d.career.downloadWord}
                </Button>
              )}
              <Button
                variant={tailored.mode === "docx" ? "secondary" : "accent"}
                size="sm"
                onClick={downloadPdf}
                disabled={save.pending}
              >
                <FileText className="size-4" />
                {d.career.downloadPdf}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!dirty || save.pending}
                onClick={() =>
                  save.run({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
                }
              >
                {save.pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {savedAt && !dirty ? d.career.saved : d.career.saveEdits}
              </Button>
              <span className="ms-auto text-xs text-muted">
                {fmt(d.career.generatedOn, { date: formatDate(tailored.generatedAt, locale) })}
              </span>
            </div>
            {save.error && <Alert>{careerErrorText(d, save.error)}</Alert>}
            {wordError && <Alert>{wordError}</Alert>}
            <p className="text-xs text-muted">{tailored.mode === "docx" ? d.career.wordNote : d.career.pdfNote}</p>

            {tailored.paraphrases && tailored.paraphrases.length > 0 && (
              <details className="rounded-2xl border border-border bg-surface-2 p-4" open>
                <summary className="cursor-pointer font-semibold">
                  {fmt(d.career.paraphrased, { count: tailored.paraphrases.length })}
                </summary>
                <p className="mt-1 text-xs text-muted">{d.career.paraphrasedHint}</p>
                <ul className="mt-3 flex flex-col gap-3">
                  {tailored.paraphrases.map((p, i) => (
                    <li key={i} className="grid gap-2 rounded-xl border border-border bg-surface p-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-medium text-muted uppercase">{d.career.before}</p>
                        <p className="mt-0.5 text-muted line-through decoration-muted/40" dir="auto">
                          {p.original}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-accent uppercase">{d.career.after}</p>
                        <p className="mt-0.5" dir="auto">
                          {p.rewritten}
                        </p>
                        {p.jdTerms.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {p.jdTerms.map((t) => (
                              <span key={t} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent" dir="auto">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              {tailored.changes.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold">{d.career.changes}</h3>
                  <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm text-muted">
                    {tailored.changes.map((c, i) => (
                      <li key={i} dir="auto">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tailored.considerAdding.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold">{d.career.considerAdding}</h3>
                  <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm text-muted">
                    {tailored.considerAdding.map((c, i) => (
                      <li key={i} dir="auto">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
