"use client";

import { FileUp, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadErrorText } from "@/components/profile-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n/client";

/** Upload or paste a CV without leaving the page; saves straight to the profile. */
export function CvQuickAdd({ onSaved }: { onSaved: () => void }) {
  const { d } = useI18n();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    onSaved();
    router.refresh();
  };

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) return setError(d.profile.errFileTooLarge);
    setBusy("upload");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/cv/extract", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { saved?: boolean; error?: string };
      if (!res.ok || !json.saved) return setError(uploadErrorText(d, json.error ?? "extract_failed"));
      done();
    } catch {
      setError(uploadErrorText(d, "network"));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function savePasted() {
    setError(null);
    setBusy("save");
    try {
      const res = await fetch("/api/cv", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setError(json.error === "too_short" ? d.profile.errTooShort : d.profile.errSaveFailed);
      done();
    } catch {
      setError(uploadErrorText(d, "network"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-border-strong bg-surface-2 p-5">
      <div>
        <p className="font-semibold">{d.profile.quickTitle}</p>
        <p className="mt-0.5 text-sm text-muted">{d.profile.quickBody}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="sr-only"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <Button type="button" variant="accent" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
          {busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {busy === "upload" ? d.profile.uploading : d.profile.upload}
        </Button>
        <span className="text-xs text-muted">{d.profile.uploadHint}</span>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="quick-cv" className="text-sm font-medium">
          {d.profile.quickPaste}
        </label>
        <Textarea
          id="quick-cv"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={d.profile.cvPlaceholder}
          maxLength={50000}
          dir="auto"
          className="min-h-40 bg-surface"
        />
        <div>
          <Button type="button" variant="secondary" disabled={busy !== null || text.trim().length < 30} onClick={savePasted}>
            {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {d.profile.quickSave}
          </Button>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
