"use client";

import { useRef, useState } from "react";
import { getDescriptionFromLink } from "@/lib/actions/description";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";

type LinkStatus = "loading" | "found" | "never_read" | "not_allowed" | "not_found" | "rate_limited" | "error";

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * Pasting a job link fills the description automatically (when it's still empty): the posting is
 * read from the company's careers page or hiring system — never LinkedIn or Glassdoor. Nothing is
 * saved until the form is.
 */
export function useDescriptionFromLink() {
  const { d } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const tried = useRef("");
  const [status, setStatus] = useState<{ kind: LinkStatus; host: string } | null>(null);

  const run = () => {
    const form = formRef.current;
    if (!form) return;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    const link = field("link")?.value.trim() ?? "";
    const description = field("jobDescription");
    if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(link) || !description || description.value.trim()) return;
    const input = {
      link,
      company: field("company")?.value ?? "",
      title: field("title")?.value ?? "",
      website: field("companyWebsite")?.value ?? "",
    };
    const key = `${input.link}|${input.company.trim()}|${input.title.trim()}`;
    if (tried.current === key) return;
    tried.current = key;
    const host = hostOf(link);
    setStatus({ kind: "loading", host });
    getDescriptionFromLink(input)
      .then((r) => {
        // The link changed meanwhile, or the user started typing a description: leave it.
        if (field("link")?.value.trim() !== link) return setStatus(null);
        if (r.status !== "found") return setStatus({ kind: r.status === "unauthorized" ? "error" : r.status, host });
        if (description.value.trim()) return setStatus(null);
        description.value = r.description;
        for (const [name, value] of [["title", r.title], ["company", r.company]] as const) {
          const el = field(name);
          if (el && !el.value.trim() && value) el.value = value;
        }
        setStatus({ kind: "found", host });
      })
      .catch(() => setStatus({ kind: "error", host }));
  };

  const message = status
    ? {
        loading: d.job.linkReading,
        found: fmt(d.job.linkFound, { host: status.host }),
        never_read: d.job.linkNeverRead,
        not_allowed: d.job.linkNotAllowed,
        not_found: d.job.linkNotFound,
        rate_limited: d.errors.tooMany,
        error: d.job.linkError,
      }[status.kind]
    : null;

  return { formRef, status, message, run, runAfterPaste: () => setTimeout(run, 0) };
}
