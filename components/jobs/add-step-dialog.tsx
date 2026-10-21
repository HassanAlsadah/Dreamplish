"use client";

import { ClipboardCheck, Loader2, MessagesSquare, Phone, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { addJobStep } from "@/lib/actions/history";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { addStepSchema, STEP_KINDS, type StepKind } from "@/lib/schemas/history";
import type { JobStatus } from "@/lib/types";

const KIND_ICONS: Record<StepKind, LucideIcon> = { call: Phone, assessment: ClipboardCheck, interview: MessagesSquare };

/** Local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
function toLocalInput(dt: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

/**
 * Where an Assessment / Interview step would move the job (mirrors add_job_step() in the database),
 * or null if it stays put. A Call never moves it.
 */
export function stepMovesTo(kind: StepKind, status: JobStatus, inAssessment: boolean): "assessment" | "interview" | null {
  if (kind === "interview" && !(status === "interview" && !inAssessment)) return "interview";
  if (kind === "assessment" && !inAssessment) return "assessment";
  return null;
}

/** Log a step by hand: first the kind (Call / Assessment / Interview), then its type. */
export function AddStepDialog({
  open,
  jobId,
  jobCreatedAt,
  currentStatus,
  inAssessment,
  onClose,
}: {
  open: boolean;
  jobId: string;
  jobCreatedAt: string;
  currentStatus: JobStatus;
  /** The job is in the Assessment column. */
  inAssessment: boolean;
  onClose: () => void;
}) {
  const { d } = useI18n();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<StepKind>("call");
  const [type, setType] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  // Fresh form each time it opens, dated now.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setKind("call");
      setType("");
      setValue(toLocalInput(new Date()));
      setNote("");
      setConfirm(false);
      setError(null);
    }
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const presets = d.history.presets[kind];
  const moveTo = stepMovesTo(kind, currentStatus, inAssessment);

  const message = (code: string) =>
    ({
      futureDate: d.history.errFuture,
      beforeCreated: d.history.errBefore,
      tooLong: d.history.errStepTooLong,
      typeRequired: d.history.errTypeRequired,
    })[code] ?? d.history.errGeneric;

  const chooseKind = (k: StepKind) => {
    setKind(k);
    // A quick pick from the other kind no longer fits; a typed value is kept.
    if (Object.values(d.history.presets).some((list) => list.includes(type))) setType("");
  };

  const save = () => {
    const input = { jobId, kind, type, changedAt: value ? new Date(value).toISOString() : "", note, confirmBeforeCreated: confirm };
    const check = addStepSchema(jobCreatedAt).safeParse(input);
    if (!check.success) return setError(check.error.issues[0]?.message ?? "generic");
    startTransition(async () => {
      const result = await addJobStep(input).catch(() => ({ ok: false, error: "generic" }));
      if (!result.ok) return setError(result.error ?? "generic");
      onClose();
      router.refresh();
    });
  };

  const needsConfirm = error === "beforeCreated" || confirm;
  const field = "rounded-xl border border-border bg-surface-2 px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="add-step-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-border bg-surface p-6 text-fg backdrop:bg-black/50"
    >
      <h2 id="add-step-title" className="text-lg font-semibold">
        {d.history.addStepTitle}
      </h2>
      <p className="mt-1 text-sm text-muted">{d.history.addStepHint}</p>
      <div className="mt-5 flex flex-col gap-4">
        {/* 1. The kind of step. */}
        <div className="flex flex-col gap-1.5">
          <span id="step-kind-label" className="text-sm font-medium">
            {d.history.stepKind}
          </span>
          <div role="radiogroup" aria-labelledby="step-kind-label" className="grid grid-cols-3 gap-2">
            {STEP_KINDS.map((k) => {
              const Icon = KIND_ICONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => chooseKind(k)}
                  className={cn(
                    "flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition-colors",
                    kind === k ? "border-accent bg-accent/10 text-fg" : "border-border text-muted hover:text-fg",
                  )}
                >
                  <Icon className="size-4" />
                  {d.history.kinds[k]}
                </button>
              );
            })}
          </div>
          {moveTo && <p className="text-xs text-muted">{fmt(d.history.willMove, { column: moveTo === "assessment" ? d.stages.assessment : d.status.interview })}</p>}
        </div>

        {/* 2. Its type: a quick pick or your own. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="step-type" className="text-sm font-medium">
            {d.history.stepType}
          </label>
          <input
            id="step-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            maxLength={80}
            dir="auto"
            placeholder={presets[0]}
            className={cn("h-11", field)}
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={d.history.quickPicks}>
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setType(p)}
                aria-pressed={type === p}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  type === p ? "border-accent bg-accent/10 text-fg" : "border-border text-muted hover:text-fg",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {d.history.date}
          <input
            type="datetime-local"
            value={value}
            max={toLocalInput(new Date())}
            onChange={(e) => setValue(e.target.value)}
            className={cn("h-11", field)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {d.history.note}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={400}
            dir="auto"
            placeholder={d.history.stepNotePlaceholder}
            className={cn("min-h-20 py-2", field)}
          />
        </label>
        {needsConfirm && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
            {d.history.confirmBefore}
          </label>
        )}
        {error && !(error === "beforeCreated" && confirm) && <Alert>{message(error)}</Alert>}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
          {d.history.cancel}
        </Button>
        <Button type="button" onClick={save} disabled={pending || !value}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {d.history.addStepSave}
        </Button>
      </div>
    </dialog>
  );
}
