"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setStatusChangeDate } from "@/lib/actions/history";
import { entryLabel, type HistoryEntry } from "@/lib/history";
import { useI18n } from "@/lib/i18n/client";
import { changeDateSchema } from "@/lib/schemas/history";

/** Local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
function toLocalInput(iso: string) {
  const dt = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

/** Change when a status change happened (logging after the fact) and its note. */
export function EditChangeDateDialog({
  entry,
  jobId,
  jobCreatedAt,
  onClose,
}: {
  entry: HistoryEntry | null;
  jobId: string;
  jobCreatedAt: string;
  onClose: () => void;
}) {
  const { d } = useI18n();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEntry, setLastEntry] = useState<HistoryEntry | null>(null);

  // Reset the form when a different change is opened.
  if (entry !== lastEntry) {
    setLastEntry(entry);
    if (entry) {
      setValue(toLocalInput(entry.changed_at));
      setNote(entry.note ?? "");
      setConfirm(false);
      setError(null);
    }
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (entry && !dialog.open) dialog.showModal();
    if (!entry && dialog.open) dialog.close();
  }, [entry]);

  const message = (code: string) =>
    code === "futureDate" ? d.history.errFuture : code === "beforeCreated" ? d.history.errBefore : code === "tooLong" ? d.history.errTooLong : d.history.errGeneric;

  const save = () => {
    if (!entry) return;
    // localDate: the day as picked here, so Date applied matches it in the user's time zone.
    const input = { id: entry.id, changedAt: new Date(value).toISOString(), note, confirmBeforeCreated: confirm, localDate: value.slice(0, 10) };
    const check = changeDateSchema(jobCreatedAt).safeParse(input);
    if (!check.success) return setError(check.error.issues[0]?.message ?? "generic");
    startTransition(async () => {
      const result = await setStatusChangeDate({ ...input, jobId }).catch(() => ({ ok: false, error: "generic" }));
      if (!result.ok) return setError(result.error ?? "generic");
      onClose();
      router.refresh();
    });
  };

  const needsConfirm = error === "beforeCreated" || confirm;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="edit-change-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-border bg-surface p-6 text-fg backdrop:bg-black/50"
    >
      <h2 id="edit-change-title" className="text-lg font-semibold">
        {d.history.editTitle}
      </h2>
      {entry && (
        <p className="mt-1 text-sm text-muted" dir="auto">
          {entryLabel(entry, d)}
        </p>
      )}
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {d.history.date}
          <input
            type="datetime-local"
            value={value}
            max={toLocalInput(new Date().toISOString())}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 rounded-xl border border-border bg-surface-2 px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {d.history.note}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            dir="auto"
            placeholder={d.history.notePlaceholder}
            className="min-h-20 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
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
          {d.history.save}
        </Button>
      </div>
    </dialog>
  );
}
