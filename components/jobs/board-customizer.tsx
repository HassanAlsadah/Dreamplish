"use client";

import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createStage, deleteStage, reorderStages, updateStage } from "@/lib/actions/stages";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { isEmailStage, isFixedStage, MAX_STAGES, STAGE_COLORS, STAGE_HEX, stageLabel, stageOf, type Stage, type StageColor } from "@/lib/stages";
import type { ActionState, Job } from "@/lib/types";

/** Row of colour swatches. */
function Swatches({ value, onChange, label }: { value: StageColor; onChange: (c: StageColor) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {STAGE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn("size-6 rounded-full border-2 transition", value === c ? "border-fg" : "border-transparent")}
          style={{ background: STAGE_HEX[c] }}
        />
      ))}
    </div>
  );
}

/** "Customize board" dialog: rename, recolour, reorder, hide, add and delete columns. */
export function BoardCustomizer({
  open,
  onClose,
  stages,
  jobs,
}: {
  open: boolean;
  onClose: () => void;
  stages: Stage[];
  jobs: Job[];
}) {
  const { d } = useI18n();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; moveTo: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<StageColor>("teal");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /** Run an action, refresh the page data, and show a message if it failed. */
  const run = (action: () => Promise<ActionState>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await action().catch(() => ({ ok: false, error: "generic" }) as ActionState);
      if (!result.ok) setError(result.error === "tooManyStages" ? d.stages.tooMany : d.stages.saveFailed);
      else after?.();
      router.refresh();
    });

  const move = (index: number, dir: -1 | 1) => {
    const ids = stages.map((s) => s.id);
    const to = index + dir;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    run(() => reorderStages(ids));
  };

  const saveName = (stage: Stage, value: string) => {
    const name = value.trim();
    const current = stage.name?.trim() ?? "";
    if (name === current || (!name && !current)) return;
    // Clearing the name of a fixed column brings back its default name.
    if (!name && !isFixedStage(stage)) return;
    run(() => updateStage({ id: stage.id, name: name || null }));
  };

  const jobsIn = (stageId: string) => jobs.filter((j) => stageOf(j, stages)?.id === stageId).length;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="customize-title"
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl rounded-3xl border border-border bg-surface p-0 text-fg backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border p-6">
        <div>
          <h2 id="customize-title" className="text-lg font-semibold">
            {d.stages.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{d.stages.hint}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={d.common.close} className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto p-6" style={{ maxHeight: "calc(90vh - 7rem)" }}>
        {error && <Alert>{error}</Alert>}

        <ul className="flex flex-col gap-2">
          {stages.map((stage, i) => {
            const count = jobsIn(stage.id);
            return (
              <li key={stage.id} className={cn("rounded-2xl border border-border bg-surface-2 p-3", stage.hidden && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setColorFor(colorFor === stage.id ? null : stage.id)}
                    aria-label={d.stages.color}
                    className="size-7 shrink-0 rounded-full border-2 border-surface shadow-sm"
                    style={{ background: STAGE_HEX[stage.color] }}
                  />
                  <input
                    key={`${stage.id}-${stage.name ?? ""}`}
                    defaultValue={stage.name ?? ""}
                    placeholder={stageLabel({ ...stage, name: null }, d)}
                    maxLength={40}
                    dir="auto"
                    aria-label={d.stages.name}
                    onBlur={(e) => saveName(stage, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm font-medium focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
                  />
                  {isEmailStage(stage) && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent" title={d.stages.emailTag}>
                      {d.stages.core}
                    </span>
                  )}
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">{count}</span>
                  <div className="ms-auto flex items-center">
                    <IconBtn label={d.stages.moveUp} disabled={pending || i === 0} onClick={() => move(i, -1)}>
                      <ArrowLeft className="size-4 rtl:rotate-180" />
                    </IconBtn>
                    <IconBtn label={d.stages.moveDown} disabled={pending || i === stages.length - 1} onClick={() => move(i, 1)}>
                      <ArrowRight className="size-4 rtl:rotate-180" />
                    </IconBtn>
                    <IconBtn
                      label={stage.hidden ? d.stages.show : d.stages.hide}
                      disabled={pending}
                      onClick={() => run(() => updateStage({ id: stage.id, hidden: !stage.hidden }))}
                    >
                      {stage.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </IconBtn>
                    {!isFixedStage(stage) && (
                      <IconBtn
                        label={d.stages.delete}
                        disabled={pending}
                        danger
                        onClick={() => {
                          const fallback = stages.find((s) => s.is_core && s.category === stage.category) ?? stages.find((s) => s.id !== stage.id)!;
                          setDeleting({ id: stage.id, moveTo: fallback.id });
                        }}
                      >
                        <Trash2 className="size-4" />
                      </IconBtn>
                    )}
                  </div>
                </div>

                {colorFor === stage.id && (
                  <div className="mt-3">
                    <Swatches
                      value={stage.color}
                      label={d.stages.color}
                      onChange={(c) => run(() => updateStage({ id: stage.id, color: c }), () => setColorFor(null))}
                    />
                  </div>
                )}

                {deleting?.id === stage.id && (
                  <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3">
                    <p className="w-full text-sm font-medium" dir="auto">
                      {fmt(d.stages.deleteTitle, { name: stageLabel(stage, d) })}
                    </p>
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      {d.stages.moveJobsTo}
                      <select
                        value={deleting.moveTo}
                        onChange={(e) => setDeleting({ id: stage.id, moveTo: e.target.value })}
                        className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg"
                      >
                        {stages
                          .filter((s) => s.id !== stage.id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {stageLabel(s, d)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className="ms-auto flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(null)} disabled={pending}>
                        {d.job.cancel}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={pending}
                        onClick={() => run(() => deleteStage(stage.id, deleting.moveTo), () => setDeleting(null))}
                      >
                        {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        {d.stages.deleteConfirm}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">{d.stages.coreNote}</p>

        {/* Add a column */}
        <form
          className="flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            run(
              () => createStage({ name: newName, color: newColor }),
              () => setNewName(""),
            );
          }}
        >
          <p className="font-medium">{d.stages.addTitle}</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted">
              {d.stages.name}
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={d.stages.namePlaceholder}
                maxLength={40}
                dir="auto"
                className="h-10 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
              />
            </label>
          </div>
          <Swatches value={newColor} onChange={setNewColor} label={d.stages.color} />
          <div>
            <Button type="submit" disabled={pending || !newName.trim() || stages.length >= MAX_STAGES}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {d.stages.add}
            </Button>
            {stages.length >= MAX_STAGES && <span className="ms-3 text-xs text-muted">{d.stages.tooMany}</span>}
          </div>
        </form>
      </div>
    </dialog>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-fg disabled:opacity-40",
        danger && "hover:bg-danger-soft hover:text-danger",
      )}
    >
      {children}
    </button>
  );
}
