"use client";

import { FileCheck2, FileUp, Loader2, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Toast, useActionToast } from "@/components/ui/toast";
import { updateProfile } from "@/lib/actions/profile";
import { useI18n } from "@/lib/i18n/client";
import { fmt, intlTag, type Dictionary } from "@/lib/i18n/config";
import { errorText } from "@/lib/i18n/errors";
import type { Profile } from "@/lib/types";

export function uploadErrorText(d: Dictionary, code: string) {
  switch (code) {
    case "file_too_large":
      return d.profile.errFileTooLarge;
    case "unsupported_type":
      return d.profile.errUnsupported;
    case "no_text":
      return d.profile.errNoText;
    case "save_failed":
      return d.profile.errSaveFailed;
    case "unauthorized":
      return d.errors.unauthorized;
    case "network":
      return d.errors.network;
    default:
      return d.profile.errExtract;
  }
}

export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const { d, locale } = useI18n();
  const [state, action, pending] = useActionState(updateProfile, { ok: false });
  const [cvText, setCvText] = useState(profile.cv_text ?? "");
  const [toast, closeToast] = useActionToast(state, (s) => (s.ok ? d.profile.saved : null));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [stored, setStored] = useState<{ name: string; type: string } | null>(
    profile.cv_file_name && profile.cv_file_type ? { name: profile.cv_file_name, type: profile.cv_file_type } : null,
  );
  const fe = state.fieldErrors ?? {};

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploadNote(null);
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(d.profile.errFileTooLarge);
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/cv/extract", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
        file?: { name: string; type: string } | null;
      };
      if (!res.ok || !json.text) {
        setUploadError(uploadErrorText(d, json.error ?? "extract_failed"));
        return;
      }
      setCvText(json.text);
      if (json.file) setStored(json.file);
      setUploadNote(d.profile.uploaded);
    } catch {
      setUploadError(uploadErrorText(d, "network"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {state.error && <Alert>{errorText(d, state.error)}</Alert>}
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={d.profile.name} htmlFor="name" error={errorText(d, fe.name)}>
          <Input id="name" name="name" defaultValue={state.values?.name ?? profile.name ?? ""} maxLength={100} autoComplete="name" />
        </Field>
        <Field label={d.profile.email} htmlFor="email">
          <Input id="email" value={email} dir="ltr" readOnly disabled />
        </Field>
      </div>

      {/* CV upload: extract text from PDF / DOCX / TXT into the field below */}
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2 p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-semibold">{d.profile.upload}</p>
          <p className="mt-0.5 text-sm text-muted">{d.profile.uploadHint}</p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="sr-only"
          id="cvFile"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button type="button" variant="secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {uploading ? d.profile.uploading : d.profile.upload}
        </Button>
      </div>
      {stored && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
          <FileCheck2 className="size-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" dir="auto">
              {fmt(d.profile.storedFile, { name: stored.name })}
            </p>
            <p className="text-xs text-muted">{stored.type === "docx" ? d.profile.storedDocx : d.profile.storedOther}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-danger"
            onClick={async () => {
              const res = await fetch("/api/cv/extract", { method: "DELETE" }).catch(() => null);
              if (res?.ok) setStored(null);
            }}
          >
            <Trash2 className="size-4" />
            {d.profile.removeFile}
          </Button>
        </div>
      )}
      {uploadError && <Alert>{uploadError}</Alert>}
      {uploadNote && <Alert tone="success">{uploadNote}</Alert>}

      <Field
        label={d.profile.cv}
        htmlFor="cvText"
        error={errorText(d, fe.cvText)}
        hint={fmt(d.profile.cvHint, { count: new Intl.NumberFormat(intlTag(locale)).format(cvText.length) })}
      >
        <Textarea
          id="cvText"
          name="cvText"
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          placeholder={d.profile.cvPlaceholder}
          maxLength={50000}
          dir="auto"
          className="min-h-80"
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:min-w-48">
          {pending ? d.job.saving : d.profile.save}
        </Button>
      </div>
      <Toast message={toast} onClose={closeToast} />
    </form>
  );
}
