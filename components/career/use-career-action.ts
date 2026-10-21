"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/config";

/** POSTs to a career tool route and tracks loading/error. */
export function useCareerAction<T>(url: string, onDone: (data: T) => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(init: RequestInit = { method: "POST" }) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
      if (!res.ok || !json.data) {
        setError(json.error ?? "server_error");
        return false;
      }
      onDone(json.data);
      return true;
    } catch {
      setError("network");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, run };
}

export function careerErrorText(d: Dictionary, code: string | null) {
  switch (code) {
    case null:
      return null;
    case "no_job_description":
      return d.career.errNoJd;
    case "no_cv":
      return d.career.errNoCv;
    case "need_report":
      return d.career.needReport;
    case "no_gaps":
      return d.career.errNoGaps;
    case "bad_answers":
      return d.career.errBadAnswers;
    case "daily_limit":
      return d.career.errDailyLimit;
    case "rate_limited":
      return d.career.errBusy;
    case "not_configured":
      return d.career.errNotConfigured;
    case "timeout":
      return d.career.errTimeout;
    case "unauthorized":
      return d.errors.unauthorized;
    case "network":
      return d.errors.network;
    default:
      return d.career.errGeneric;
  }
}
