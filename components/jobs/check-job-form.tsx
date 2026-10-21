"use client";

import { Loader2, ScanSearch } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useDescriptionFromLink } from "@/components/jobs/use-description-from-link";
import { checkJob } from "@/lib/actions/jobs";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/i18n/errors";
import { useFocusFirstError } from "@/components/ui/use-focus-first-error";

/**
 * "Check a job": just what Match & CV needs. Pasting the link fills in the description (and the
 * role and company when the posting names them); saving opens the job's Match & CV tab.
 */
export function CheckJobForm() {
  const { d } = useI18n();
  const [state, action, pending] = useActionState(checkJob, { ok: false });
  const { formRef, status, message, run, runAfterPaste } = useDescriptionFromLink();
  useFocusFirstError(formRef, state);
  const fe = state.fieldErrors ?? {};
  const err = (k: string) => errorText(d, fe[k]);
  const v = state.values;

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-6" noValidate>
      {state.error && <Alert>{errorText(d, state.error)}</Alert>}

      <Field label={d.job.link} htmlFor="link" optionalLabel={d.job.optional} hint={d.check.linkHint} error={err("link")}>
        <Input
          id="link"
          name="link"
          type="url"
          dir="ltr"
          inputMode="url"
          placeholder={d.job.linkPlaceholder}
          defaultValue={v?.link ?? ""}
          invalid={!!fe.link}
          onPaste={runAfterPaste}
          onBlur={run}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={d.job.company} htmlFor="company" error={err("company")}>
          <Input id="company" name="company" placeholder={d.job.companyPlaceholder} defaultValue={v?.company ?? ""} invalid={!!fe.company} maxLength={200} required onBlur={run} />
        </Field>
        <Field label={d.job.role} htmlFor="title" error={err("title")}>
          <Input id="title" name="title" placeholder={d.job.rolePlaceholder} defaultValue={v?.title ?? ""} invalid={!!fe.title} maxLength={200} required onBlur={run} />
        </Field>
      </div>

      <Field label={d.job.jobDescription} htmlFor="jobDescription" error={err("jobDescription")}>
        <Textarea
          id="jobDescription"
          name="jobDescription"
          placeholder={d.job.jobDescriptionPlaceholder}
          defaultValue={v?.jobDescription ?? ""}
          invalid={!!fe.jobDescription}
          maxLength={30000}
          required
          className="min-h-48"
        />
        <p role="status" aria-live="polite" className="mt-2 flex min-h-5 items-center gap-1.5 text-xs text-muted">
          {status?.kind === "loading" && <Loader2 className="size-3.5 animate-spin" />}
          {message}
        </p>
      </Field>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <ButtonLink href="/dashboard" variant="secondary" size="lg" className="sm:min-w-32">
          {d.job.cancel}
        </ButtonLink>
        <Button type="submit" variant="accent" size="lg" disabled={pending} className="sm:min-w-48">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
          {pending ? d.job.saving : d.check.submit}
        </Button>
      </div>
    </form>
  );
}
