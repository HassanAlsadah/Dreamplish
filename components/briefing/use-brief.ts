"use client";

import { useCallback, useEffect, useState } from "react";
import type { BriefView } from "@/lib/briefing/types";
import type { Dictionary } from "@/lib/i18n/config";

const POLL_MS = 3000;

export type BriefRequestError = string | null;

/** Brief state with polling while it's queued or generating. */
export function useBrief(companyId: string, initial: BriefView | null) {
  const [brief, setBrief] = useState(initial);
  const [error, setError] = useState<BriefRequestError>(null);
  const [submitting, setSubmitting] = useState(false);

  const busy = brief?.status === "pending" || brief?.status === "generating";

  useEffect(() => {
    if (!busy) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/briefs/${companyId}`, { cache: "no-store" });
        const json = (await res.json()) as { brief: BriefView | null };
        if (!cancelled && json.brief) setBrief(json.brief);
      } catch {
        // transient network error — keep polling
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [busy, companyId]);

  const request = useCallback(
    async (force: boolean) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/briefs/${companyId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        });
        const json = (await res.json().catch(() => ({}))) as { brief?: BriefView | null; error?: string };
        if (json.brief) setBrief(json.brief);
        if (!res.ok) setError(json.error ?? "server_error");
        return res.ok;
      } catch {
        setError("network");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [companyId],
  );

  return { brief, error, submitting, busy, request };
}

/** Message for a request error (API) or a stored generation error. */
export function briefErrorText(d: Dictionary, code: string | null | undefined, vars: { time?: string } = {}) {
  switch (code) {
    case null:
    case undefined:
      return null;
    case "not_configured":
      return d.brief.errNotConfigured;
    case "rate_limited":
      return d.brief.errRateLimited;
    case "timeout":
      return d.brief.errTimeout;
    case "invalid_output":
      return d.brief.errInvalidOutput;
    case "provider_error":
      return d.brief.errProvider;
    case "daily_limit":
      return d.brief.errDailyLimit;
    case "monthly_limit":
      return d.brief.errMonthlyLimit;
    case "refresh_too_soon":
      return d.brief.errRefreshTooSoon.replace("{time}", vars.time ?? "");
    case "unauthorized":
      return d.errors.unauthorized;
    case "network":
      return d.errors.network;
    default:
      return d.errors.generic;
  }
}
