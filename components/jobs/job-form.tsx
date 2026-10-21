"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Toast, useActionToast } from "@/components/ui/toast";
import { JobDescriptionView } from "@/components/jobs/job-description";
import { useDescriptionFromLink } from "@/components/jobs/use-description-from-link";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { errorText } from "@/lib/i18n/errors";
import { stageLabel, stageOf, type Stage } from "@/lib/stages";
import { APPLIED_VIA, type ActionState, type Job } from "@/lib/types";
import { useFocusFirstError } from "@/components/ui/use-focus-first-error";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
export function JobForm({ action, job, today, stages }: { action: Action; job?: Job; today: string; stages: Stage[] }) {
  const { d } = useI18n();
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const [toast, closeToast] = useActionToast(state, (s) => (s.ok && s.message === "updated" ? d.job.updated : null));
  const fe = state.fieldErrors ?? {};
  const err = (k: string) => errorText(d, fe[k]);
  const { formRef, status: linkStatus, message: linkMessage, run: readLink, runAfterPaste: readLinkAfterPaste } = useDescriptionFromLink();
  useFocusFirstError(formRef, state);

  // A saved description shows as a document; Edit swaps in the text box until the next save.
  const [editingDescription, setEditingDescription] = useState(false);
  const [savedState, setSavedState] = useState(state);
  if (state !== savedState) {
    setSavedState(state);
    if (state.ok) setEditingDescription(false);
  }

  // After a submit, React resets the form to these defaults — so prefer the submitted values.
  const v = state.values;
  const initial = {
    company: v?.company ?? job?.company.name ?? "",
    companyWebsite: v?.companyWebsite ?? job?.company.website ?? "",
    title: v?.title ?? job?.title ?? "",
    link: v?.link ?? job?.link ?? "",
    status: v?.status ?? job?.status ?? "applied",
    // Board column: the job's current one, or the core "Applied" column for a new job.
    stage:
      v?.stage ??
      (job ? stageOf(job, stages)?.id : stages.find((s) => s.is_core && s.category === "applied")?.id) ??
      "",
    dateApplied: v?.dateApplied ?? job?.date_applied ?? (job ? "" : today),
    notes: v?.notes ?? job?.notes ?? "",
    jobDescription: v?.jobDescription ?? job?.job_description ?? "",
    appliedVia: v?.appliedVia ?? job?.applied_via ?? "",
    appliedViaDetail: v?.appliedViaDetail ?? job?.applied_via_detail ?? "",
  };

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-6" noValidate>
      {state.error && <Alert>{errorText(d, state.error)}</Alert>}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={d.job.company} htmlFor="company" error={err("company")}>
          <Input
            id="company"
            name="company"
            placeholder={d.job.companyPlaceholder}
            defaultValue={initial.company}
            invalid={!!fe.company}
            maxLength={200}
            required
            onBlur={readLink}
          />
        </Field>
        <Field label={d.job.role} htmlFor="title" error={err("title")}>
          <Input
            id="title"
            name="title"
            placeholder={d.job.rolePlaceholder}
            defaultValue={initial.title}
            invalid={!!fe.title}
            maxLength={200}
            required
            onBlur={readLink}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={d.stages.column} htmlFor="stage" error={err("status")}>
          {/* The column decides the status: each column counts as one of the five core stages. */}
          <Select id="stage" name="stage" defaultValue={initial.stage} invalid={!!fe.status}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {stageLabel(s, d)}
                {s.is_core ? "" : ` · ${d.status[s.category]}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={d.job.dateApplied} htmlFor="dateApplied" optionalLabel={d.job.optional} error={err("dateApplied")}>
          <Input
            id="dateApplied"
            name="dateApplied"
            type="date"
            max={today}
            defaultValue={initial.dateApplied}
            invalid={!!fe.dateApplied}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={d.job.link} htmlFor="link" optionalLabel={d.job.optional} error={err("link")}>
          <Input
            id="link"
            name="link"
            type="url"
            dir="ltr"
            inputMode="url"
            placeholder={d.job.linkPlaceholder}
            defaultValue={initial.link}
            invalid={!!fe.link}
            onPaste={readLinkAfterPaste}
            onBlur={readLink}
          />
        </Field>
        <Field label={d.job.companyWebsite} htmlFor="companyWebsite" optionalLabel={d.job.optional} error={err("companyWebsite")}>
          <Input
            id="companyWebsite"
            name="companyWebsite"
            type="url"
            dir="ltr"
            inputMode="url"
            placeholder={d.job.companyWebsitePlaceholder}
            defaultValue={initial.companyWebsite}
            invalid={!!fe.companyWebsite}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={d.job.appliedVia} htmlFor="appliedVia" optionalLabel={d.job.optional} error={err("appliedVia")}>
          <Select id="appliedVia" name="appliedVia" defaultValue={initial.appliedVia} invalid={!!fe.appliedVia}>
            <option value="">{d.job.appliedViaNone}</option>
            {APPLIED_VIA.map((via) => (
              <option key={via} value={via}>
                {d.appliedVia[via]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={d.job.appliedViaDetail} htmlFor="appliedViaDetail" optionalLabel={d.job.optional} error={err("appliedViaDetail")}>
          <Input
            id="appliedViaDetail"
            name="appliedViaDetail"
            dir="auto"
            placeholder={d.job.appliedViaDetailPlaceholder}
            defaultValue={initial.appliedViaDetail}
            invalid={!!fe.appliedViaDetail}
            maxLength={200}
          />
        </Field>
      </div>

      <Field label={d.job.notes} htmlFor="notes" optionalLabel={d.job.optional} error={err("notes")}>
        <Textarea
          id="notes"
          name="notes"
          placeholder={d.job.notesPlaceholder}
          defaultValue={initial.notes}
          invalid={!!fe.notes}
          maxLength={10000}
        />
      </Field>

      {job && initial.jobDescription.trim() && !editingDescription && !fe.jobDescription ? (
        <JobDescriptionView value={initial.jobDescription} onEdit={() => setEditingDescription(true)} />
      ) : (
        <Field label={d.job.jobDescription} htmlFor="jobDescription" optionalLabel={d.job.optional} error={err("jobDescription")}>
          <Textarea
            id="jobDescription"
            name="jobDescription"
            placeholder={d.job.jobDescriptionPlaceholder}
            defaultValue={initial.jobDescription}
            invalid={!!fe.jobDescription}
            maxLength={30000}
            className={editingDescription ? "min-h-96" : "min-h-40"}
            autoFocus={editingDescription}
          />
          <p role="status" aria-live="polite" className="mt-2 flex min-h-5 items-center gap-1.5 text-xs text-muted">
            {linkStatus?.kind === "loading" && <Loader2 className="size-3.5 animate-spin" />}
            {linkMessage}
          </p>
        </Field>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <ButtonLink href={job ? `/jobs/${job.id}` : "/dashboard"} variant="secondary" size="lg" className="sm:min-w-32">
          {d.job.cancel}
        </ButtonLink>
        <Button type="submit" size="lg" disabled={pending} className="sm:min-w-48">
          {pending ? d.job.saving : job ? d.job.saveChanges : d.job.save}
        </Button>
      </div>

      <Toast message={toast} onClose={closeToast} />
    </form>
  );
}
